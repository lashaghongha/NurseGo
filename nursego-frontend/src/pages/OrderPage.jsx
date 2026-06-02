import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { servicesService } from '../services/services.service';
import { ordersService } from '../services/orders.service';
import { paymentsService } from '../services/payments.service';
import { useApp } from '../context/AppContext';
import LocationPicker from '../components/LocationPicker';
import toast from 'react-hot-toast';
import './OrderPage.css';

const DISTRICTS = [
  { name: 'ვაკე',       surcharge: 0,  lat: 41.7010, lng: 44.7655 },
  { name: 'საბურთალო', surcharge: 0,  lat: 41.7220, lng: 44.7490 },
  { name: 'გლდანი',    surcharge: 10, lat: 41.7710, lng: 44.8050 },
  { name: 'დიდუბე',    surcharge: 5,  lat: 41.7450, lng: 44.7730 },
  { name: 'ნაძალადევი',surcharge: 5,  lat: 41.7610, lng: 44.7980 },
  { name: 'ისანი',     surcharge: 5,  lat: 41.6900, lng: 44.8230 },
  { name: 'სამგორი',   surcharge: 10, lat: 41.6750, lng: 44.8400 },
  { name: 'კრწანისი',  surcharge: 5,  lat: 41.6860, lng: 44.7920 },
  { name: 'დიღომი',    surcharge: 10, lat: 41.7850, lng: 44.7600 },
  { name: 'ვარკეთილი', surcharge: 15, lat: 41.6620, lng: 44.8550 },
];

function nearestDistrict(lat, lng) {
  let best = DISTRICTS[0], bestDist = Infinity;
  for (const d of DISTRICTS) {
    const dist = Math.hypot(d.lat - lat, d.lng - lng);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

const TIMES = ['მიმდინარე (ASAP)', 'დღეს 14:00', 'დღეს 16:00', 'დღეს 18:00', 'ხვალ 10:00'];
const PAYMENT_METHODS = [
  { id: 'online', label: '💳 ონლაინ (BOG Pay)', desc: 'ბარათით ახლავე' },
  { id: 'cash',   label: '💵 ადგილზე ნაღდი',   desc: 'ექთანს მისვლისას' },
];

export default function OrderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const prefill = location.state || {};
  const preferredNurseId   = prefill.nurseId   || null;
  const preferredNurseName = prefill.nurseName || null;

  const [services, setServices] = useState([]);
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState([]); // მრავლობითი
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [address, setAddress] = useState(prefill.address || '');
  const [pinCoords, setPinCoords] = useState(null); // { lat, lng }
  const [selectedTime, setSelectedTime] = useState('მიმდინარე (ASAP)');
  const [notes, setNotes] = useState('');
  const [isNight, setIsNight] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  const toggleService = (s) => {
    setSelectedServices(prev =>
      prev.find(x => x.id === s.id)
        ? prev.filter(x => x.id !== s.id)
        : [...prev, s]
    );
  };

  useEffect(() => {
    servicesService.getAll().then(list => {
      setServices(list);
      const svcName = prefill.serviceName || prefill.service;
      if (prefill.serviceId) {
        const found = list.find(s => s.id === prefill.serviceId);
        if (found) setSelectedServices([found]);
      } else if (svcName) {
        const found = list.find(s => s.name === svcName);
        if (found) setSelectedServices([found]);
      }
    });

    if (prefill.district) {
      const d = DISTRICTS.find(d => d.name === prefill.district);
      if (d) setSelectedDistrict(d);
    }
  }, []);

  const servicesBasePrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const distSurcharge  = selectedDistrict?.surcharge || 0;
  const nightSurcharge = isNight ? Math.round(servicesBasePrice * 0.2) : 0;
  const totalPrice     = servicesBasePrice + distSurcharge + nightSurcharge;

  const canProceed = () => {
    if (step === 1) return selectedServices.length > 0;
    // step 2: მისამართი სავალდებულოა; უბანი — ან ხელით, ან pin-იდან ავტო
    if (step === 2) return address.trim().length > 0 && (!!selectedDistrict || !!pinCoords);
    if (step === 3) return !!selectedTime;
    return true;
  };

  const handleSubmit = async () => {
    if (!currentUser) { navigate('/login'); return; }
    setLoading(true);
    const effectiveDistrict = selectedDistrict
      || (pinCoords ? nearestDistrict(pinCoords.lat, pinCoords.lng) : DISTRICTS[0]);
    try {
      // რამდენიმე სერვისი → ცალკე შეკვეთა თითოეულზე, პირველი ვაჩვენებთ tracking-ში
      const basePayload = {
        address,
        district: effectiveDistrict.name,
        isNightTime: isNight,
        scheduledTime: selectedTime !== 'მიმდინარე (ASAP)' ? new Date().toISOString() : null,
        latitude:  pinCoords?.lat ?? null,
        longitude: pinCoords?.lng ?? null,
        preferredNurseId: preferredNurseId,
      };
      const firstOrder = await ordersService.create({
        ...basePayload,
        serviceId: selectedServices[0].id,
        notes: selectedServices.length > 1
          ? `[დამატებული სერვისები: ${selectedServices.slice(1).map(s=>s.name).join(', ')}] ${notes}`
          : notes,
      });
      for (const svc of selectedServices.slice(1)) {
        await ordersService.create({
          ...basePayload,
          serviceId: svc.id,
          notes: `[ჯგუფური შეკვეთის ნაწილი #${firstOrder.id}] ${notes}`,
        });
      }
      const order = firstOrder;

      if (paymentMethod === 'online') {
        // BOG Pay redirect
        const payment = await paymentsService.create(order.id);
        if (payment.isDev) {
          // Dev mode — simulate payment
          toast.success('Dev: გადახდა სიმულირდება...');
          await paymentsService.verifyDev(order.id);
          toast.success('✅ შეკვეთა და გადახდა დასრულდა!');
        } else {
          // Production — redirect to BOG
          window.location.href = payment.redirectUrl;
          return;
        }
      } else {
        toast.success('შეკვეთა გაგზავნილია!');
      }
      navigate(`/tracking/${order.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'შეცდომა. სცადე თავიდან.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="order-page">
      <div className="container">
        <div className="order-wrapper">
          <div className="steps-bar">
            {[1,2,3,4].map(s => (
              <div key={s} className={`step ${step >= s ? 'done' : ''} ${step === s ? 'current' : ''}`}>
                <div className="step-circle">{step > s ? '✓' : s}</div>
                <div className="step-label">{['მომსახურება','მისამართი','დრო','დადასტურება'][s-1]}</div>
              </div>
            ))}
          </div>

          <div className="order-body">
            <div className="order-form">
              {step === 1 && (
                <div className="fade-in">
                  {preferredNurseName && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: '#eff6ff', border: '1.5px solid #bfdbfe',
                      borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                    }}>
                      <span style={{ fontSize: 22 }}>👩‍⚕️</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{preferredNurseName}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray)' }}>პირდაპირი გამოძახება</div>
                      </div>
                      <span style={{
                        marginLeft: 'auto', background: 'var(--primary)', color: 'white',
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      }}>✓ არჩეულია</span>
                    </div>
                  )}
                  <h2 className="form-title">აირჩიე მომსახურება</h2>
                  <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 12 }}>
                    შეგიძლია რამდენიმე სერვისი აირჩიო ერთდროულად
                  </p>
                  <div className="service-picker">
                    {services.map(s => {
                      const isSelected = selectedServices.some(x => x.id === s.id);
                      return (
                        <div key={s.id}
                          className={`sp-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleService(s)}>
                          <span className="sp-icon">{s.icon}</span>
                          <div className="sp-info"><div className="sp-name">{s.name}</div></div>
                          <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                            <div className="sp-price">{s.price}₾</div>
                            {isSelected && <span style={{ fontSize: 16 }}>✅</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedServices.length > 0 && (
                    <div style={{
                      marginTop: 14, padding: '10px 14px', background: '#eff6ff',
                      borderRadius: 10, fontSize: 13, color: 'var(--primary)', fontWeight: 600
                    }}>
                      ✅ არჩეული ({selectedServices.length}): {selectedServices.map(s => s.name).join(', ')}
                      {' — '}
                      <strong>{servicesBasePrice}₾</strong>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="fade-in">
                  <h2 className="form-title">მისამართი</h2>
                  <div className="form-group">
                    <label>
                      უბანი *
                      {selectedDistrict && (
                        <span style={{
                          marginLeft: 10, fontSize: 12, fontWeight: 700,
                          background: 'var(--primary)', color: 'white',
                          padding: '2px 10px', borderRadius: 20,
                        }}>
                          ✅ {selectedDistrict.name}
                        </span>
                      )}
                    </label>
                    <div className="district-picker">
                      {DISTRICTS.map(d => (
                        <div key={d.name}
                          className={`dp-item ${selectedDistrict?.name === d.name ? 'selected' : ''}`}
                          onClick={() => setSelectedDistrict(d)}>
                          📍 {d.name}
                          {d.surcharge > 0 && <span className="dp-surcharge">+{d.surcharge}₾</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>ზუსტი მისამართი *</label>
                    <LocationPicker
                      value={{ address, lat: pinCoords?.lat, lng: pinCoords?.lng }}
                      onChange={(coords) => {
                        setPinCoords(coords);
                        // pin დასმისთანავე nearest district ავტომატურად
                        const d = nearestDistrict(coords.lat, coords.lng);
                        setSelectedDistrict(d);
                      }}
                      onAddressChange={(val) => setAddress(val)}
                      onDistrictDetected={(districtName) => {
                        const d = DISTRICTS.find(x => x.name === districtName);
                        if (d) setSelectedDistrict(d);
                      }}
                    />
                  </div>
                  {!selectedDistrict && !pinCoords && (
                    <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      ⚠️ უბანი აირჩიე ზემოდან ან რუკაზე დააჭირე — ავტომატურად განისაზღვრება
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="fade-in">
                  <h2 className="form-title">სასურველი დრო</h2>
                  <div className="time-picker">
                    {TIMES.map(t => (
                      <div key={t} className={`tp-item ${selectedTime === t ? 'selected' : ''}`}
                        onClick={() => setSelectedTime(t)}>
                        🕐 {t}
                      </div>
                    ))}
                  </div>
                  <div className="form-group" style={{ marginTop: 20 }}>
                    <label>შენიშვნა</label>
                    <textarea placeholder="მაგ: პაციენტი 80 წლის, საჭიროა გადასხმა..."
                      value={notes} onChange={e => setNotes(e.target.value)}
                      className="form-textarea" rows={3} />
                  </div>
                  <label className="night-toggle">
                    <input type="checkbox" checked={isNight} onChange={e => setIsNight(e.target.checked)} />
                    <span>🌙 ღამის საათები (22:00–08:00) — +20%</span>
                  </label>
                  <div className="form-group" style={{ marginTop: 20 }}>
                    <label>გადახდის მეთოდი</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                      {PAYMENT_METHODS.map(pm => (
                        <label key={pm.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                          border: `2px solid ${paymentMethod === pm.id ? 'var(--primary)' : '#e2e8f0'}`,
                          borderRadius: 12, cursor: 'pointer',
                          background: paymentMethod === pm.id ? '#eff6ff' : 'white',
                        }}>
                          <input type="radio" name="payment" value={pm.id}
                            checked={paymentMethod === pm.id}
                            onChange={() => setPaymentMethod(pm.id)}
                            style={{ accentColor: 'var(--primary)' }} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{pm.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray)' }}>{pm.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="fade-in">
                  <h2 className="form-title">დადასტურება</h2>
                  <div className="confirm-card">
                    <div className="cc-row">
                      <span>მომსახურება</span>
                      <div style={{ textAlign:'right' }}>
                        {selectedServices.map(s => (
                          <div key={s.id}>{s.icon} {s.name} — {s.price}₾</div>
                        ))}
                      </div>
                    </div>
                    <div className="cc-row"><span>მისამართი</span><strong>{selectedDistrict?.name}, {address}</strong></div>
                    {preferredNurseName && (
                      <div className="cc-row">
                        <span>ექთანი</span>
                        <strong style={{ color: 'var(--primary)' }}>👩‍⚕️ {preferredNurseName}</strong>
                      </div>
                    )}
                    <div className="cc-row"><span>დრო</span><strong>{selectedTime}</strong></div>
                    <div className="cc-row"><span>გადახდა</span><strong>{PAYMENT_METHODS.find(p=>p.id===paymentMethod)?.label}</strong></div>
                    {notes && <div className="cc-row"><span>შენიშვნა</span><strong>{notes}</strong></div>}
                    <div className="cc-divider" />
                    <div className="cc-row"><span>სერვისების ფასი</span><span>{servicesBasePrice}₾</span></div>
                    {distSurcharge > 0 && <div className="cc-row"><span>უბნის დანამატი</span><span>+{distSurcharge}₾</span></div>}
                    {nightSurcharge > 0 && <div className="cc-row"><span>ღამის დანამატი</span><span>+{nightSurcharge}₾</span></div>}
                    <div className="cc-total"><span>სულ</span><span className="total-price">{totalPrice}₾</span></div>
                  </div>
                </div>
              )}

              <div className="form-nav">
                {step > 1 && <button className="btn btn-outline" onClick={() => setStep(step - 1)}>← უკან</button>}
                {step < 4 ? (
                  <button className="btn btn-primary" onClick={async () => {
                    // step 2-დან გასვლისას — pinCoords არ გვაქვს → geocode ახლავე
                    if (step === 2 && !pinCoords && address.trim()) {
                      try {
                        const q = encodeURIComponent(`${address}, თბილისი, საქართველო`);
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ge`, { headers: {'Accept-Language':'ka'} });
                        const data = await res.json();
                        if (data[0]) {
                          const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                          setPinCoords(coords);
                          if (!selectedDistrict) setSelectedDistrict(nearestDistrict(coords.lat, coords.lng));
                        }
                      } catch {}
                    }
                    setStep(step + 1);
                  }} disabled={!canProceed()}>შემდეგი →</button>
                ) : (
                  <button className={`btn btn-secondary ${loading ? 'loading' : ''}`} onClick={handleSubmit} disabled={loading}>
                    {loading ? '⏳ ...' : '✅ შეკვეთის გაგზავნა'}
                  </button>
                )}
              </div>
            </div>

            <div className="order-sidebar">
              <div className="price-card">
                <div className="pc-title">ფასი</div>
                {selectedServices.length > 0 ? (
                  <>
                    {selectedServices.map(s => (
                      <div key={s.id} className="pc-row"><span>{s.icon} {s.name}</span><span>{s.price}₾</span></div>
                    ))}
                    {distSurcharge > 0 && <div className="pc-row"><span>უბნის დანამატი</span><span>+{distSurcharge}₾</span></div>}
                    {nightSurcharge > 0 && <div className="pc-row"><span>ღამის +20%</span><span>+{nightSurcharge}₾</span></div>}
                    <div className="pc-divider" />
                    <div className="pc-total"><span>სულ</span><span>{totalPrice}₾</span></div>
                  </>
                ) : <div className="pc-empty">აირჩიე მომსახურება</div>}
              </div>
              <div className="guarantee-card">
                <div className="gc-item">✅ ლიცენზირებული ექთნები</div>
                <div className="gc-item">⏱ 30 წთ-ში ჩამოსვლა</div>
                <div className="gc-item">💳 ადგილზე გადახდა</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
