import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ordersService } from '../services/orders.service';
import { nursesService } from '../services/nurses.service';
import { signalRService } from '../services/signalr.service';
import { documentsService } from '../services/documents.service';
import { pushService } from '../services/push.service';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import OrderChat from '../components/OrderChat';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import './NurseDashboard.css';
import './LoginPage.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:30px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">📍</div>',
  iconSize: [30, 30], iconAnchor: [15, 30],
});

function OrderMap({ lat, lng, height = 200 }) {
  if (!lat || !lng) return null;
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #e2e8f0', marginTop: 10 }}>
      <MapContainer center={[lat, lng]} zoom={16}
        style={{ width: '100%', height }}
        scrollWheelZoom={false} dragging={true} zoomControl={true}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://openstreetmap.org">OSM</a>' />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
    </div>
  );
}

const STATUS_FLOW = [
  { status: 'Assigned',   label: 'მიღება',      next: 'EnRoute' },
  { status: 'EnRoute',    label: 'მივდივარ',    next: 'Arrived' },
  { status: 'Arrived',    label: 'მივედი',      next: 'InProgress' },
  { status: 'InProgress', label: 'მიმდინარე',  next: 'Completed' },
  { status: 'Completed',  label: 'დასრულდა',   next: null },
];

const STATUS_OPTIONS = [
  { value: 'Active',   label: '🟢 აქტიური',    cls: 'badge-active' },
  { value: 'Busy',     label: '🟡 დაკავებული', cls: 'badge-busy' },
  { value: 'Vacation', label: '🔴 შვებულება',  cls: 'badge-vacation' },
  { value: 'Offline',  label: '⚫ ოფლაინ',     cls: 'badge-offline' },
];

// ── Service descriptions — ექთანი რას გააკეთებს ──────────────────────────
const SERVICE_DETAILS = {
  'კუნთში ინექცია': {
    steps: ['დაიბანე ხელები / ჩაიცვი ხელთათმანები','შეამოწმე პრეპარატი (სახელი, ვადა, დოზა)','შეარჩიე ადგილი (დელტა, ბარძაყი)','გაასუფთავე კანი სპირტიანი ბამბით','შეიყვანე ნემსი 90°-ით, შეიწოვე','შეიყვანე პრეპარატი ნელა','ამოიყვანე ნემსი, დააჭირე ბამბა'],
    duration: '15–20 წუთი',
    equipment: ['სირინჯი', 'ნემსი', 'სპირტი', 'ბამბა', 'ხელთათმანები', 'პლასტირი'],
    warning: 'კლიენტმა პრეპარატი თვითონ უნდა მოამზადოს (რეცეპტი/ექიმის ბარათი)',
  },
  'ვენაში ინექცია': {
    steps: ['ხელთათმანები + ტურნიკეტი','შეაფასე ვენა (ყველაზე კარგად ჩანს კიდური)','გაასუფთავე კანი სპირტით','შეიყვანე ნემსი 15–30°-ით, სისხლის შემოდინება = სწორ ვენაში','ამოხსენი ტურნიკეტი','შეიყვანე პრეპარატი ნელა','ამოიყვანე, დააჭირე 2–3 წუთი'],
    duration: '20–30 წუთი',
    equipment: ['IV სირინჯი', 'ნემსი 21G', 'ტურნიკეტი', 'სპირტი', 'ბამბა', 'ხელთათმანები', 'პლასტირი'],
    warning: 'თუ ვენა ვერ მოიძებნა 2 მცდელობის შემდეგ — შეატყობინე კლიენტს და დაუკავშირდი ექიმს',
  },
  'გადასხმა': {
    steps: ['შეამოწმე ხსნარი (სახელი, ვადა, სიმღვრივე)','მოამზადე IV სისტემა (ჰაერი ამოყვანე)','ჩართე ვენაში (ან არსებულ კათეტერში)','მიარგუნე სიჩქარე (ჩვეულებრივ 40–60 წ/წთ)','დაყენე ტაიმერი, 15 წუთში შეამოწმე','დასრულების შემდეგ სისტემა ამოიღე, დააჭირე'],
    duration: '1–3 საათი (ხსნარის მოცულობაზე)',
    equipment: ['IV სისტემა', 'ხსნარი (კლიენტის)', 'ტურნიკეტი', 'IV კათეტერი / ნემსი', 'პლასტირი', 'ბამბა'],
    warning: 'კლიენტი მთელ პროცედურაში ახლოს უნდა იყოს — ალერგია, ჰიპოთენზია, შეშუპება = STOP',
  },
  'ჭრილობის დამუშავება': {
    steps: ['შეაფასე ჭრილობა (სიღრმე, ინფექციის ნიშნები)','გარე დაბინძურება გარეცხე ფიზ.ხსნარით','დაამუშავე ანტისეპტიკით (H₂O₂ / ბეტადინი)','ამოიღე მკვდარი ქსოვილი (თუ საჭიროა)','დაადე სტერილური სახვევი','მიეცი ინსტრუქცია — სახვევის შეცვლის სიხშირე'],
    duration: '20–45 წუთი',
    equipment: ['სახვევი', 'ბეტადინი / H₂O₂', 'ფიზ. ხსნარი', 'პინცეტი', 'მაკრატელი', 'ხელთათმანები', 'პლასტირი'],
    warning: 'თუ ჭრილობა ღრმა, პულსირებული სისხლდენა ან ნეკნოზი — გადაიყვანე სასწრაფოში',
  },
  'წნევის გაზომვა': {
    steps: ['კლიენტი 5 წუთი დასვენებული','მკლავი გულის დონეზე','მანჟეტი მკლავზე ზემოდან 2 სმ','გაბერე 180–200 მმHg-მდე','ნელა გაუშვი ჰაერი (2 მმHg/წმ)','ჩაიწერე სისტოლური + დიასტოლური','გაიმეორე მეორე მხარეს'],
    duration: '10–15 წუთი',
    equipment: ['ტონომეტრი', 'ფონენდოსკოპი', 'ჩასაწერი'],
    warning: '140/90-ზე მაღალი — ეკითხე კლიენტს ისტორია, შეატყობინე ექიმს',
  },
  'მოხუცის მოვლა': {
    steps: ['შეაფასე ზოგადი მდგომარეობა (ორიენტაცია, ტკივილი)','ჰიგიენური პროცედურები (საჭიროებისამებრ)','მედიკამენტების მიცემა სიის მიხედვით','საწოლის მოწესრიგება / პოზიციის შეცვლა (წნეხვის წყლულის პრევენცია)','ვიტალური ნიშნების გაზომვა','ოჯახს გადასცე ინფორმაცია მდგომარეობაზე'],
    duration: '1–2 საათი',
    equipment: ['ხელთათმანები', 'ტონომეტრი', 'თერმომეტრი', 'მედიკამენტების სია (კლიენტის)'],
    warning: 'ნებისმიერი სტატუსის გაუარესება (ცნობიერება, ტემპ > 38.5°, SpO₂ < 92%) — სასწრაფო 112',
  },
};

const DEFAULT_DETAILS = {
  steps: ['კლიენტის მდგომარეობის შეფასება', 'პროცედურის შესრულება სტანდარტების მიხედვით', 'შედეგების ჩაწერა', 'ინსტრუქციის გადაცემა'],
  duration: '30–60 წუთი',
  equipment: ['საჭირო სამედიცინო ინვენტარი'],
  warning: null,
};

export default function NurseDashboard() {
  const { currentUser } = useApp();
  const ALL_DISTRICTS = ['ვაკე','საბურთალო','გლდანი','დიდუბე','ნაძალადევი','ისანი','სამგორი','კრწანისი','დიღომი','ვარკეთილი'];
  const [nurseStatus, setNurseStatus] = useState('Active');
  const [nurseId, setNurseId] = useState(null);
  const [myDistricts, setMyDistricts] = useState([]);
  const [showDistrictEdit, setShowDistrictEdit] = useState(false);
  const [myDocs, setMyDocs] = useState([]);
  const [previewOrder, setPreviewOrder] = useState(null); // modal-ი
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  // Load nurse profile + orders on mount
  useEffect(() => {
    const load = async () => {
      try {
        // Get nurse profile
        const nurses = await nursesService.getAll();
        const me = nurses.find(n => n.userId === currentUser?.id || n.user?.id === currentUser?.id);
        if (me) {
          // Push notification ნებართვა
          if (pushService.isSupported() && !pushService.isGranted()) {
            pushService.requestPermission().then(granted => {
              if (granted) toast('🔔 შეტყობინებები ჩართულია', { duration: 2000 });
            });
          }
          setNurseId(me.id);
          setNurseStatus(me.status || 'Active');
          const dList = me.districts ? me.districts.split(',').map(d => d.trim()).filter(Boolean)
                      : me.district ? [me.district] : [];
          setMyDistricts(dList);

          if (navigator.geolocation) {
            const sendLocation = (nId) => {
              navigator.geolocation.getCurrentPosition(pos => {
                nursesService.updateLocation(nId, pos.coords.latitude, pos.coords.longitude).catch(() => {});
              }, () => {});
            };
            sendLocation(me.id);
            const gpsInterval = setInterval(() => sendLocation(me.id), 30000);
            window._nurseGpsInterval = gpsInterval;
          }
        }

        // ჩემი მიმდინარე + ისტორია
        const myOrders = await ordersService.getMyOrders();
        const active  = myOrders.find(o => ['Assigned','EnRoute','Arrived','InProgress'].includes(o.status));
        const history = myOrders.filter(o => o.status === 'Completed' || o.status === 'Cancelled');
        setActiveOrder(active || null);
        setHistoryOrders(history.slice(0, 10));

        // ხელმისაწვდომი შეკვეთები (Pending) — ჩემი + სხვა უბანი
        try {
          const avail = await ordersService.getAvailable();
          const same  = (avail.sameDistrict  || []).map(o => ({ ...o, _isOther: false }));
          const other = (avail.otherDistrict || []).map(o => ({ ...o, _isOther: true  }));
          setPendingOrders([...same, ...other]);
        } catch { /* თუ ჯერ არარის endpoint */ }

      } catch {
        toast.error('მონაცემები ვერ ჩაიტვირთა');
      } finally {
        setLoading(false);
      }
    };

    load();
    pollRef.current = setInterval(load, 20000);

    // SignalR
    const initSignalR = async (nId) => {
      try {
        await signalRService.connect();
        if (nId) await signalRService.joinNurse(nId);

        signalRService.on('NewOrder', (data) => {
          const isOther = data?.isOtherDistrict;
          toast(
            isOther
              ? `📥 შეკვეთა სხვა უბანში — ${data?.district}`
              : `📥 ახალი შეკვეთა — ${data?.district}!`,
            { icon: '🔔', duration: 6000 }
          );
          // Browser push notification
          pushService.notifyNewOrder(data);
          load();
        });

        signalRService.on('OrderTaken', (id) => {
          // სხვა ექთანმა მიიღო — სიიდან ამოვიღოთ
          setPendingOrders(prev => prev.filter(o => o.id !== id));
        });

        signalRService.on('OrderCancelled', (id) => {
          toast(`შეკვეთა #${id} გაუქმდა`, { icon: '❌' });
          pushService.notifyOrderCancelled(id);
          load();
        });
      } catch { /* silent */ }
    };

    const nurseIdPromise = nursesService.getAll().then(nurses => {
      const me = nurses.find(n => n.userId === currentUser?.id || n.user?.id === currentUser?.id);
      return me?.id;
    }).catch(() => null);
    nurseIdPromise.then(initSignalR);

    return () => {
      clearInterval(pollRef.current);
      if (window._nurseGpsInterval) clearInterval(window._nurseGpsInterval);
      signalRService.off('NewOrder');
      signalRService.off('OrderTaken');
      signalRService.off('OrderCancelled');
    };
  }, []);

  const handleStatusChange = async (newStatus) => {
    setNurseStatus(newStatus);
    if (!nurseId) return;
    try {
      await nursesService.updateStatus(nurseId, newStatus);
      toast.success('სტატუსი განახლდა');
    } catch {
      toast.error('სტატუსი ვერ განახლდა');
    }
  };

  const acceptOrder = async (order) => {
    try {
      await ordersService.accept(order.id);
      setActiveOrder({ ...order, status: 'Assigned' });
      setPendingOrders(prev => prev.filter(o => o.id !== order.id));
      toast.success('✅ შეკვეთა მიღებულია!');
    } catch (err) {
      // Race condition — სხვამ უფრო სწრაფად მიიღო
      const msg = err?.response?.data?.message || 'შეკვეთა უკვე სხვა ექთანმა მიიღო';
      toast.error(msg);
      setPendingOrders(prev => prev.filter(o => o.id !== order.id));
    }
  };

  const rejectOrder = (id) => {
    setPendingOrders(prev => prev.filter(o => o.id !== id));
    toast('შეკვეთა უარყოფილია', { icon: '❌' });
  };

  const handleDocUpload = async (e, docType) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const doc = await documentsService.upload(file, docType);
      setMyDocs(prev => [...prev.filter(d => d.docType !== docType), doc]);
      toast.success(`${docType} ატვირთულია!`);
    } catch { toast.error('ატვირთვა ვერ მოხდა'); }
    finally { setUploadingDoc(false); }
  };

  const saveDistricts = async (newList) => {
    if (newList.length === 0) { toast.error('მინიმუმ ერთი უბანი გჭირდება'); return; }
    setMyDistricts(newList);
    if (!nurseId) return;
    try {
      await nursesService.updateDistricts(nurseId, newList.join(','));
      toast.success('უბნები განახლდა!');
      setShowDistrictEdit(false);
    } catch {
      toast.error('განახლება ვერ მოხდა');
    }
  };

  const advanceStatus = async () => {
    if (!activeOrder) return;
    const flow = STATUS_FLOW.find(s => s.status === activeOrder.status);
    if (!flow?.next) return;

    try {
      await ordersService.updateStatus(activeOrder.id, flow.next);
      if (flow.next === 'Completed') {
        setHistoryOrders(prev => [{ ...activeOrder, status: 'Completed' }, ...prev]);
        setActiveOrder(null);
        toast.success('შეკვეთა დასრულდა! 🎉');
      } else {
        setActiveOrder(prev => ({ ...prev, status: flow.next }));
        toast.success(`სტატუსი: ${STATUS_FLOW.find(s => s.status === flow.next)?.label}`);
      }
    } catch {
      toast.error('სტატუსი ვერ განახლდა');
    }
  };

  const currentFlowStep = STATUS_FLOW.findIndex(s => s.status === activeOrder?.status);
  const monthlyEarnings = historyOrders.reduce((sum, o) => sum + (o.totalPrice || 0) * 0.8, 0);
  const avgRating = historyOrders.filter(o => o.rating).reduce((s, o, _, a) => s + o.rating / a.length, 0);

  if (loading) return (
    <div className="nurse-dash"><div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>⏳ იტვირთება...</div></div>
  );

  return (<>
    <div className="nurse-dash">
      <div className="container">
        <div className="dash-header">
          <div>
            <h1 className="page-title">ჩემი პანელი</h1>
            <p className="page-subtitle">გამარჯობა, {currentUser?.name}! 👋</p>
          </div>
          <div className="status-selector">
            <span style={{ fontSize: 13, color: 'var(--gray)' }}>ჩემი სტატუსი:</span>
            <select value={nurseStatus} onChange={e => handleStatusChange(e.target.value)} className="status-select">
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-4" style={{ marginBottom: 32 }}>
          <div className="card dash-stat"><div className="ds-val">{Math.round(monthlyEarnings)}₾</div><div className="ds-label">ამ თვის შემოსავალი</div></div>
          <div className="card dash-stat"><div className="ds-val">{historyOrders.length}</div><div className="ds-label">დასრულებული შეკვ.</div></div>
          <div className="card dash-stat"><div className="ds-val">{avgRating ? `${avgRating.toFixed(1)}⭐` : '—'}</div><div className="ds-label">ჩემი რეიტინგი</div></div>
          <div className="card dash-stat"><div className="ds-val">{pendingOrders.length}</div><div className="ds-label">ახალი შეკვეთა</div></div>
        </div>

        {/* My Districts */}
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showDistrictEdit ? 14 : 0 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>📍 ჩემი სამუშაო უბნები</span>
              {!showDistrictEdit && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {myDistricts.length > 0
                    ? myDistricts.map(d => <span key={d} className="district-badge">{d}</span>)
                    : <span style={{ color: 'var(--gray)', fontSize: 13 }}>უბანი არ არის მითითებული</span>
                  }
                </div>
              )}
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setShowDistrictEdit(e => !e)}>
              {showDistrictEdit ? '✕ გაუქმება' : '✏️ შეცვლა'}
            </button>
          </div>
          {showDistrictEdit && (
            <div>
              <div className="district-checkbox-grid">
                {ALL_DISTRICTS.map(d => {
                  const checked = myDistricts.includes(d);
                  return (
                    <label key={d} className={`district-checkbox-item ${checked ? 'selected' : ''}`}>
                      <input type="checkbox" checked={checked}
                        onChange={() => {
                          const next = checked ? myDistricts.filter(x => x !== d) : [...myDistricts, d];
                          setMyDistricts(next);
                        }} />
                      📍 {d}
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => saveDistricts(myDistricts)}>✅ შენახვა</button>
                <span style={{ fontSize: 12, color: 'var(--gray)' }}>არჩეული: {myDistricts.join(', ') || '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📎 ჩემი დოკუმენტები</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {[
              { type: 'License', label: '🪪 ლიცენზია' },
              { type: 'IdCard',  label: '🪪 პირადობა' },
              { type: 'CV',      label: '📄 CV' },
            ].map(d => {
              const uploaded = myDocs.find(doc => doc.docType === d.type);
              return (
                <label key={d.type} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                  border: `2px solid ${uploaded ? '#10b981' : '#e2e8f0'}`,
                  borderRadius: 12, cursor: 'pointer',
                  background: uploaded ? '#f0fdf4' : 'white',
                  minWidth: 160,
                }}>
                  <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => handleDocUpload(e, d.type)} disabled={uploadingDoc} />
                  <span>{d.label}</span>
                  {uploaded
                    ? <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>✅ ატვირთული</span>
                    : <span style={{ fontSize: 12, color: 'var(--gray)' }}>+ ატვირთვა</span>
                  }
                </label>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 8 }}>
            PDF, JPG ან PNG • ადმინი განიხილავს ვერიფიკაციისთვის
          </p>
        </div>

        <div className="dash-body">
          {activeOrder && (
            <div className="active-order-card card">
              <div className="ao-header">
                <h3>🚗 აქტიური შეკვეთა #{activeOrder.id}</h3>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 20 }}>{activeOrder.totalPrice}₾</span>
              </div>
              <div className="ao-details">
                <div><strong>კლიენტი:</strong> {activeOrder.customer?.name || '—'}</div>
                <div><strong>მომსახურება:</strong> {activeOrder.service?.icon} {activeOrder.service?.name}</div>
                <div><strong>მისამართი:</strong> 📍 {activeOrder.district}, {activeOrder.address}</div>
                {activeOrder.notes && <div className="ao-note">💬 {activeOrder.notes}</div>}
                <OrderMap lat={activeOrder.latitude} lng={activeOrder.longitude} height={180} />
                <OrderChat orderId={activeOrder.id} />
              </div>
              <div className="order-progress">
                {STATUS_FLOW.map((s, i) => (
                  <div key={s.status} className={`op-step ${i <= currentFlowStep ? 'done' : ''} ${i === currentFlowStep ? 'current' : ''}`}>
                    <div className="ops-dot" />
                    <div className="ops-label">{s.label}</div>
                  </div>
                ))}
              </div>
              {activeOrder.status !== 'Completed' && (
                <button className="btn btn-primary" onClick={advanceStatus} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                  {STATUS_FLOW.find(s => s.status === activeOrder.status)?.next === 'Completed'
                    ? '✅ დასრულება'
                    : `→ ${STATUS_FLOW.find(s => s.status === STATUS_FLOW.find(x => x.status === activeOrder.status)?.next)?.label || 'შემდეგი'}`}
                </button>
              )}
            </div>
          )}

          <div className="dash-columns">
            <div>
              <h2 className="section-heading">📥 შემოსული შეკვეთები</h2>
              {pendingOrders.length === 0 ? (
                <div className="empty-state card">
                  <span>🕐</span>
                  <p>ახალი შეკვეთა არ არის</p>
                </div>
              ) : (
                pendingOrders.map(order => (
                  <div key={order.id} className={`incoming-card card ${order._isOther ? 'other-district' : ''}`}>
                    <div className="ic-header">
                      <div>
                        <div className="ic-service">
                          {order.service?.icon} {order.service?.name}
                          {order._isOther && <span className="other-district-badge">📍 სხვა უბანი</span>}
                        </div>
                        <div className="ic-customer">👤 {order.customer?.name}</div>
                      </div>
                      <div className="ic-price">{order.totalPrice}₾</div>
                    </div>
                    <div className="ic-details">
                      <div>📍 <strong>{order.district}</strong>, {order.address}</div>
                      <div>🕐 შეკვეთა #{order.id} · {new Date(order.createdAt).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}</div>
                      {order.notes && <div>💬 {order.notes}</div>}
                      {order._isOther && (
                        <div style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600, marginTop: 4 }}>
                          ⚠️ შენი უბნებიდან გარეთ — 3 წუთი არარვინ მიიღო
                        </div>
                      )}
                    </div>
                    <div className="ic-actions">
                      <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setPreviewOrder(order)}>
                        🔍 დეტალები
                      </button>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => acceptOrder(order)}>
                        ✅ მიღება
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <h2 className="section-heading">📋 ბოლო შეკვეთები</h2>
              {historyOrders.length === 0 ? (
                <div className="empty-state card"><span>📋</span><p>შეკვეთები ჯერ არ არის</p></div>
              ) : (
                historyOrders.map(o => (
                  <div key={o.id} className="history-card card">
                    <div className="hc-header">
                      <div>
                        <div className="hc-service">{o.service?.icon} {o.service?.name}</div>
                        <div className="hc-customer">{o.customer?.name} · {new Date(o.createdAt).toLocaleDateString('ka-GE')}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--secondary)', fontSize: 16 }}>+{Math.round((o.totalPrice || 0) * 0.8)}₾</div>
                        <div style={{ fontSize: 12, color: 'var(--gray)', textAlign: 'right' }}>(80%)</div>
                      </div>
                    </div>
                    {o.rating && <div className="hc-rating">{'★'.repeat(Math.floor(o.rating))}{'☆'.repeat(5 - Math.floor(o.rating))}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ── Order Preview Modal ────────────────────────────────────────────── */}
    {previewOrder && (() => {
      const svcName = previewOrder.service?.name || '';
      const details = SERVICE_DETAILS[svcName] || DEFAULT_DETAILS;
      return (
        <div className="order-modal-overlay" onClick={() => setPreviewOrder(null)}>
          <div className="order-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="om-header">
              <div className="om-title">
                <span style={{ fontSize: 28 }}>{previewOrder.service?.icon || '🏥'}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{svcName}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray)' }}>შეკვეთა #{previewOrder.id}</div>
                </div>
              </div>
              <button className="om-close" onClick={() => setPreviewOrder(null)}>✕</button>
            </div>

            <div className="om-body">
              {/* Client + location */}
              <div className="om-section">
                <div className="om-row"><span>👤 კლიენტი</span><strong>{previewOrder.customer?.name}</strong></div>
                <div className="om-row"><span>📍 მისამართი</span><strong>{previewOrder.district}, {previewOrder.address}</strong></div>
                <OrderMap lat={previewOrder.latitude} lng={previewOrder.longitude} height={200} />
                <div className="om-row"><span>💰 ანაზღაურება</span><strong style={{ color: 'var(--secondary)', fontSize: 18 }}>{Math.round((previewOrder.totalPrice || 0) * 0.8)}₾ <span style={{ fontSize: 12, color: 'var(--gray)' }}>(80%)</span></strong></div>
                <div className="om-row"><span>⏱ სავარაუდო ხანგრძლივობა</span><strong>{details.duration}</strong></div>
                {previewOrder.isNightTime && <div className="om-row"><span>🌙 ღამის ტარიფი</span><strong style={{ color: 'var(--warning)' }}>+{previewOrder.nightSurcharge}₾</strong></div>}
                {previewOrder.notes && <div className="om-row"><span>💬 შენიშვნა</span><strong>{previewOrder.notes}</strong></div>}
                {previewOrder._isOther && (
                  <div className="om-alert om-alert-warn">⚠️ ეს შეკვეთა <strong>შენი სამუშაო უბნების გარეთაა</strong>. კლიენტი 3 წუთი ელოდება.</div>
                )}
              </div>

              {/* What to do — steps */}
              <div className="om-section">
                <div className="om-section-title">📋 რა მოუწევს შესრულება</div>
                <ol className="om-steps">
                  {details.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>

              {/* Equipment */}
              <div className="om-section">
                <div className="om-section-title">🧰 საჭირო ინვენტარი</div>
                <div className="om-chips">
                  {details.equipment.map((e, i) => (
                    <span key={i} className="om-chip">{e}</span>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 8 }}>
                  * ინვენტარი შენი მარაგიდან. კლიენტს მხოლოდ პრეპარატი მოაქვს (სადაც მითითებულია).
                </p>
              </div>

              {/* Warning */}
              {details.warning && (
                <div className="om-alert om-alert-danger">
                  ⛔ <strong>მნიშვნელოვანი:</strong> {details.warning}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="om-footer">
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setPreviewOrder(null)}>
                უარყოფა
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => {
                setPreviewOrder(null);
                acceptOrder(previewOrder);
              }}>
                ✅ შეკვეთის მიღება
              </button>
            </div>
          </div>
        </div>
      );
    })()}
  </>);
}
