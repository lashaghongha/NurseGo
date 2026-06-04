import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ordersService } from '../services/orders.service';
import { videoService } from '../services/video.service';
import { signalRService } from '../services/signalr.service';
import { chatService } from '../services/chat.service';
import toast from 'react-hot-toast';
import './TrackingPage.css';

// Leaflet icon fix (webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
const nurseIcon = L.divIcon({ className: '', html: '<div style="font-size:28px;line-height:1">👩‍⚕️</div>', iconSize:[32,32], iconAnchor:[16,16] });
const homeIcon  = L.divIcon({ className: '', html: '<div style="font-size:28px;line-height:1">🏠</div>',   iconSize:[32,32], iconAnchor:[16,16] });

// Map re-centering when geocoded coords arrive
function MapMover({ center }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 16); }, [center]);
  return null;
}

const STATUS_STEPS = [
  { key: 'Pending',     label: 'შეკვეთა მიღებულია',   icon: '✅' },
  { key: 'Assigned',   label: 'ექთანი დასახელდა',     icon: '👩‍⚕️' },
  { key: 'EnRoute',    label: 'ექთანი მოდის',          icon: '🚗' },
  { key: 'Arrived',    label: 'ექთანი მოვიდა',         icon: '🏠' },
  { key: 'InProgress', label: 'მომსახურება მიმდინარე', icon: '💉' },
  { key: 'Completed',  label: 'დასრულდა',              icon: '🎉' },
];

const DISTRICT_COORDS = {
  'ვაკე':       [41.7010, 44.7655],
  'საბურთალო':  [41.7220, 44.7490],
  'გლდანი':     [41.7710, 44.8050],
  'დიდუბე':     [41.7450, 44.7730],
  'ნაძალადევი': [41.7610, 44.7980],
  'ისანი':      [41.6900, 44.8230],
  'სამგორი':    [41.6750, 44.8400],
  'კრწანისი':   [41.6860, 44.7920],
  'დიღომი':     [41.7850, 44.7600],
  'ვარკეთილი':  [41.6620, 44.8550],
};

export default function TrackingPage() {
  const { orderId } = useParams();
  const [order, setOrder]                     = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [showRating, setShowRating]           = useState(false);
  const [rating, setRating]                   = useState(0);
  const [comment, setComment]                 = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [showCancel, setShowCancel]           = useState(false);
  const [cancelReason, setCancelReason]       = useState('');
  const [showChat, setShowChat]               = useState(false);
  const [chatMessages, setChatMessages]       = useState([]);
  const [chatInput, setChatInput]             = useState('');
  const [geoCoords, setGeoCoords]             = useState(null);
  const [showReceipt, setShowReceipt]         = useState(false);
  const [receiptService, setReceiptService]   = useState('');
  const [receiptPrice, setReceiptPrice]       = useState('');
  const [receiptDone, setReceiptDone]         = useState(false);
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const chatEndRef = useRef(null);
  const pollRef = useRef(null);

  const fetchOrder = () => {
    ordersService.getById(orderId)
      .then(o => {
        setOrder(o);
        // 1) Order-ს lat/lng აქვს — პირდაპირ გამოვიყენოთ
        if (o?.latitude && o?.longitude) {
          setGeoCoords([o.latitude, o.longitude]);
          return;
        }
        // 2) Fallback: Nominatim geocoding მისამართიდან (ერთხელ)
        if (o?.address && !geoCoords) {
          // Tbilisi bounding box: viewbox=44.6,41.6,45.1,41.9
          const q = encodeURIComponent(`${o.address}, ${o.district}, თბილისი`);
          fetch(
            `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ge&viewbox=44.6,41.6,45.1,41.9&bounded=1`,
            { headers: { 'Accept-Language': 'ka' } }
          )
            .then(r => r.json())
            .then(results => {
              if (results?.[0])
                setGeoCoords([parseFloat(results[0].lat), parseFloat(results[0].lon)]);
              else {
                // district center fallback
                const dc = DISTRICT_COORDS[o.district];
                if (dc) setGeoCoords(dc);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => toast.error('შეკვეთა ვერ მოიძებნა'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
    pollRef.current = setInterval(fetchOrder, 15000);

    const initSignalR = async () => {
      try {
        await signalRService.connect();
        await signalRService.joinOrder(orderId);
        signalRService.on('StatusChanged', (status) => {
          setOrder(prev => prev ? { ...prev, status } : prev);
          const step = STATUS_STEPS.find(s => s.key === status);
          if (step) toast(`${step.icon} ${step.label}`, { duration: 3000 });
        });
        signalRService.on('NewChatMessage', (msg) => {
          setChatMessages(prev => [...prev, msg]);
          if (!showChat) toast('💬 ახალი შეტყობინება', { duration: 2000 });
        });
      } catch { /* polling as fallback */ }
    };
    initSignalR();

    // Load chat history
    chatService.getMessages(orderId).then(setChatMessages).catch(() => {});

    return () => {
      clearInterval(pollRef.current);
      signalRService.off('StatusChanged');
      signalRService.off('NewChatMessage');
    };
  }, [orderId]);

  useEffect(() => {
    if (order?.status === 'Completed') {
      clearInterval(pollRef.current);
      if (!ratingSubmitted) setTimeout(() => setShowRating(true), 1500);
      if (order.confirmedAt) setReceiptDone(true);
      else { setReceiptService(order.service?.name || ''); setReceiptPrice(String(order.totalPrice || '')); }
    }
  }, [order?.status]);

  const submitReceipt = async () => {
    if (!receiptService.trim() || !receiptPrice) return;
    setSubmittingReceipt(true);
    try {
      await ordersService.confirmReceipt(orderId, receiptService.trim(), parseFloat(receiptPrice));
      setReceiptDone(true);
      setShowReceipt(false);
      toast.success('დადასტურება შენახულია! ✅');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'შეცდომა');
    } finally {
      setSubmittingReceipt(false);
    }
  };

  const submitRating = async () => {
    try {
      await videoService.submitRating({ orderId: Number(orderId), nurseId: order.nurseId, stars: rating, comment });
      setRatingSubmitted(true);
      setShowRating(false);
      toast.success('შეფასება გამოგზავნილია! გმადლობთ.');
    } catch {
      toast.error('შეფასება ვერ გაიგზავნა');
    }
  };

  const handleCancel = async () => {
    try {
      await ordersService.cancel(orderId, cancelReason);
      setOrder(prev => ({ ...prev, status: 'Cancelled' }));
      setShowCancel(false);
      toast.success('შეკვეთა გაუქმდა');
    } catch (err) {
      toast.error(err.response?.data?.message || 'გაუქმება ვერ მოხდა');
    }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      await chatService.send(orderId, chatInput);
      setChatInput('');
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { toast.error('შეტყობინება ვერ გაიგზავნა'); }
  };

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === order?.status);
  const progressPct      = order ? ((currentStepIndex + 1) / STATUS_STEPS.length) * 100 : 0;
  const distCoords       = DISTRICT_COORDS[order?.district] || [41.7151, 44.8271];
  // geocoded coords > district center
  const homeCoords       = geoCoords || distCoords;
  const nurseCoords      = order?.nurse?.latitude && order?.nurse?.longitude
    ? [order.nurse.latitude, order.nurse.longitude]
    : [homeCoords[0] - 0.012, homeCoords[1] - 0.012];
  const canCancel   = order && !['Completed','Cancelled','InProgress'].includes(order.status);
  const cancelFeeWarning = order?.status === 'Arrived'
    ? `⚠️ ყურადღება: ექთანი უკვე ადგილზეა. გაუქმებისას დაგეკისრება ჯარიმა — შეკვეთის ღირებულების 20% (${Math.round((order?.totalPrice||0)*0.2)}₾).`
    : order?.status === 'EnRoute'
    ? '⚠️ ყურადღება: ექთანი გზაშია. გაუქმებისას ინფორმაცია მიეწოდება ექთანს.'
    : null;

  if (loading) return (
    <div className="tracking-page">
      <div className="container" style={{ padding:'80px 0', textAlign:'center' }}>⏳ იტვირთება...</div>
    </div>
  );

  if (!order) return (
    <div className="tracking-page">
      <div className="container" style={{ padding:'80px 0', textAlign:'center' }}>
        <h2>შეკვეთა ვერ მოიძებნა</h2>
        <Link to="/" className="btn btn-primary" style={{ marginTop:16 }}>მთავარზე დაბრუნება</Link>
      </div>
    </div>
  );

  return (
    <div className="tracking-page">
      <div className="container">
        <div className="tracking-wrapper">

          <div className="tracking-header">
            <div>
              <h1 className="page-title" style={{ marginBottom:4 }}>შეკვეთის თვალყური</h1>
              <p style={{ color:'var(--gray)', fontSize:14 }}>შეკვეთა #{orderId}</p>
            </div>
            <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              {order.status === 'Cancelled' ? (
                <span style={{ background:'#fee2e2', color:'#dc2626', padding:'6px 16px', borderRadius:20, fontWeight:700 }}>
                  ❌ გაუქმდა
                </span>
              ) : (
                <div className="status-badge-large">
                  {STATUS_STEPS[currentStepIndex]?.icon} {STATUS_STEPS[currentStepIndex]?.label}
                </div>
              )}
              {canCancel && (
                <button className="btn btn-outline btn-sm"
                  style={{ color:'#dc2626', borderColor:'#dc2626' }}
                  onClick={() => setShowCancel(true)}>
                  ❌ გაუქმება
                </button>
              )}
            </div>
          </div>

          <div className="tracking-body">
            {/* Leaflet Map */}
            <div className="map-placeholder" style={{ overflow:'hidden', borderRadius:16, padding:0, position:'relative' }}>
              <MapContainer center={homeCoords} zoom={15}
                style={{ width:'100%', height:'100%', minHeight:280 }}
                scrollWheelZoom={false}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='© <a href="https://openstreetmap.org">OpenStreetMap</a>'
                />
                {geoCoords && <MapMover center={geoCoords} />}
                <Marker position={homeCoords} icon={homeIcon}>
                  <Popup>🏠 თქვენი მისამართი<br /><strong>{order.district}</strong>, {order.address}</Popup>
                </Marker>
                {order.status !== 'Pending' && order.nurse && (
                  <Marker position={nurseCoords} icon={nurseIcon}>
                    <Popup>👩‍⚕️ {order.nurse?.user?.name || 'ექთანი'}<br />📍 {order.nurse?.district}</Popup>
                  </Marker>
                )}
              </MapContainer>
              {order.status === 'EnRoute' && (
                <div className="map-eta">
                  <div className="eta-number">~15</div>
                  <div className="eta-label">წუთი</div>
                </div>
              )}
            </div>

            {/* Nurse + Timeline */}
            <div className="nurse-info-card card">
              {order.nurse ? (
                <div className="nic-top">
                  <div className="nic-avatar">👩‍⚕️</div>
                  <div className="nic-details">
                    <div className="nic-name">{order.nurse.user?.name || 'ექთანი'}</div>
                    <div className="nic-sub">📍 {order.nurse.district}</div>
                    {order.nurse.rating > 0 && (
                      <div className="nic-sub">⭐ {Number(order.nurse.rating).toFixed(1)}</div>
                    )}
                  </div>
                  {order.nurse?.user?.phone ? (
                    <a href={`tel:${order.nurse.user.phone}`} className="btn btn-primary">📞 დარეკვა</a>
                  ) : (
                    <button className="btn btn-primary" disabled style={{ opacity:0.5 }}>📞 ნომერი არ არის</button>
                  )}
                </div>
              ) : (
                <div style={{ textAlign:'center', color:'var(--gray)', padding:'12px 0' }}>
                  ⏳ ექთანი ინიშნება...
                </div>
              )}

              <div className="status-timeline">
                {STATUS_STEPS.map((s, i) => (
                  <div key={s.key}
                    className={`timeline-item ${i <= currentStepIndex ? 'done' : ''} ${i === currentStepIndex ? 'current' : ''}`}>
                    <div className="tl-icon">{s.icon}</div>
                    <div className="tl-label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="progress-bar">
                <div className="progress-fill" style={{ width:`${progressPct}%` }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={fetchOrder}>🔄 განახლება</button>
                {order.nurse && order.status !== 'Pending' && (
                  <button className="btn btn-outline btn-sm" onClick={() => setShowChat(c => !c)}>
                    💬 ჩეთი {chatMessages.length > 0 && `(${chatMessages.length})`}
                  </button>
                )}
              </div>

              {/* Chat Panel */}
              {showChat && (
                <div style={{ marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '10px 14px', fontWeight: 700, fontSize: 13 }}>
                    💬 ჩეთი — {order.nurse?.user?.name || 'ექთანი'}
                  </div>
                  <div style={{ height: 200, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {chatMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--gray)', fontSize: 13, marginTop: 40 }}>
                        შეტყობინება არ არის
                      </div>
                    ) : chatMessages.map((m, i) => (
                      <div key={i} style={{
                        alignSelf: m.senderRole === 'Customer' ? 'flex-end' : 'flex-start',
                        background: m.senderRole === 'Customer' ? 'var(--primary)' : '#f1f5f9',
                        color: m.senderRole === 'Customer' ? 'white' : 'inherit',
                        padding: '6px 12px', borderRadius: 12, maxWidth: '75%', fontSize: 13,
                      }}>
                        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{m.senderName}</div>
                        {m.text}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={sendChat} style={{ display: 'flex', borderTop: '1px solid #e2e8f0' }}>
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      placeholder="შეტყობინება..." style={{ flex: 1, border: 'none', padding: '10px 14px', outline: 'none', fontSize: 13 }} />
                    <button type="submit" className="btn btn-primary btn-sm" style={{ borderRadius: 0, borderTopRightRadius: 0 }}>→</button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* ─── მომსახურების დადასტურება ─── */}
          {order.status === 'Completed' && (
            <div className="card" style={{ marginTop: 16, border: receiptDone ? '2px solid #22c55e' : '2px solid #f59e0b', borderRadius: 16, padding: 20 }}>
              {receiptDone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 28 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#15803d' }}>მომსახურება დადასტურებულია</div>
                    <div style={{ fontSize: 13, color: 'var(--gray)' }}>მადლობა გამოხმაურებისთვის!</div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>📋 დაადასტურე მიღებული მომსახურება</div>
                    <button onClick={() => setShowReceipt(o => !o)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--primary)', fontFamily: 'inherit' }}>
                      {showReceipt ? '▲ დახურვა' : '▼ შევსება'}
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 8 }}>
                    გთხოვთ შეავსო — გვეხმარება სერვისის გასაუმჯობესებლად
                  </div>
                  {showReceipt && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>რა მომსახურება მიიღე? *</label>
                        <input
                          type="text"
                          value={receiptService}
                          onChange={e => setReceiptService(e.target.value)}
                          placeholder="მაგ: კუნთში ინექცია"
                          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>რა გადაიხადე? (₾) *</label>
                        <input
                          type="number"
                          value={receiptPrice}
                          onChange={e => setReceiptPrice(e.target.value)}
                          placeholder="0"
                          min={0}
                          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      <button
                        onClick={submitReceipt}
                        disabled={!receiptService.trim() || !receiptPrice || submittingReceipt}
                        className="btn btn-primary"
                        style={{ justifyContent: 'center' }}>
                        {submittingReceipt ? '⏳...' : '✅ დადასტურება'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="order-details card" style={{ marginTop:24 }}>
            <h3 style={{ marginBottom:16 }}>შეკვეთის დეტალები</h3>
            <div className="od-grid">
              <div className="od-item"><span className="od-label">მომსახურება</span><span>{order.service?.icon} {order.service?.name}</span></div>
              <div className="od-item"><span className="od-label">მისამართი</span><span>{order.district}, {order.address}</span></div>
              <div className="od-item"><span className="od-label">ფასი</span><span className="od-price">{order.totalPrice}₾</span></div>
              <div className="od-item"><span className="od-label">სტატუსი</span>
                <span>{STATUS_STEPS.find(s => s.key === order.status)?.label || order.status}</span>
              </div>
              {order.notes && (
                <div className="od-item" style={{ gridColumn:'1/-1' }}>
                  <span className="od-label">შენიშვნა</span><span>{order.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancel && (
        <div className="modal-overlay" onClick={() => setShowCancel(false)}>
          <div className="rating-modal" onClick={e => e.stopPropagation()}>
            <h2>❌ შეკვეთის გაუქმება</h2>
            <p style={{ color:'var(--gray)', marginBottom:12 }}>შეკვეთა #{orderId} გაუქმდება</p>
            {cancelFeeWarning && (
              <div style={{
                background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:10,
                padding:'10px 14px', fontSize:13, color:'#c2410c', marginBottom:12,
              }}>
                {cancelFeeWarning}
              </div>
            )}
            <textarea className="form-textarea" placeholder="გაუქმების მიზეზი (სურვილისამებრ)..."
              value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} />
            <div style={{ display:'flex', gap:12, marginTop:16 }}>
              <button className="btn btn-outline" onClick={() => setShowCancel(false)}
                style={{ flex:1, justifyContent:'center' }}>უკან</button>
              <button onClick={handleCancel}
                style={{ flex:1, justifyContent:'center', background:'#dc2626', color:'white',
                  border:'none', borderRadius:10, padding:'10px 0', fontWeight:700, cursor:'pointer' }}>
                {order?.status === 'Arrived' ? `გაუქმება (${Math.round((order?.totalPrice||0)*0.2)}₾ ჯარიმა)` : 'გაუქმება'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRating && (
        <div className="modal-overlay" onClick={() => setShowRating(false)}>
          <div className="rating-modal" onClick={e => e.stopPropagation()}>
            <h2>შეაფასე მომსახურება</h2>
            <div className="rating-nurse">
              <span style={{ fontSize:40 }}>👩‍⚕️</span>
              <div>
                <div style={{ fontWeight:700 }}>{order.nurse?.user?.name || 'ექთანი'}</div>
                <div style={{ fontSize:13, color:'var(--gray)' }}>{order.service?.name}</div>
              </div>
            </div>
            <div className="star-picker">
              {[1,2,3,4,5].map(s => (
                <button key={s} className={`star-btn ${rating >= s ? 'filled' : ''}`} onClick={() => setRating(s)}>★</button>
              ))}
            </div>
            <div className="rating-labels">
              {['ძალიან ცუდი','ცუდი','საშუალო','კარგი','შესანიშნავი'][rating-1] || 'შეაფასე'}
            </div>
            <textarea className="form-textarea" placeholder="კომენტარი..." value={comment}
              onChange={e => setComment(e.target.value)} rows={3} />
            <button className="btn btn-primary" onClick={submitRating} disabled={!rating}
              style={{ width:'100%', justifyContent:'center' }}>
              შეფასების გაგზავნა
            </button>
          </div>
        </div>
      )}

      {ratingSubmitted && <div className="rating-success">⭐ გმადლობთ შეფასებისთვის!</div>}
    </div>
  );
}
