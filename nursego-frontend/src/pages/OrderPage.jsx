import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { servicesService } from '../services/services.service';
import { ordersService } from '../services/orders.service';
import { paymentsService } from '../services/payments.service';
import { nursesService } from '../services/nurses.service';
import { adminService } from '../services/admin.service';
import { useApp } from '../context/AppContext';
import LocationPicker from '../components/LocationPicker';
import toast from 'react-hot-toast';
import './OrderPage.css';

// lat/lng only — surcharges are loaded from API
const DISTRICTS_BASE = [
  { name: 'ვაკე',       lat: 41.7010, lng: 44.7655 },
  { name: 'საბურთალო', lat: 41.7220, lng: 44.7490 },
  { name: 'გლდანი',    lat: 41.7710, lng: 44.8050 },
  { name: 'დიდუბე',    lat: 41.7450, lng: 44.7730 },
  { name: 'ნაძალადევი',lat: 41.7610, lng: 44.7980 },
  { name: 'ისანი',     lat: 41.6900, lng: 44.8230 },
  { name: 'სამგორი',   lat: 41.6750, lng: 44.8400 },
  { name: 'კრწანისი',  lat: 41.6860, lng: 44.7920 },
  { name: 'დიღომი',    lat: 41.7850, lng: 44.7600 },
  { name: 'ვარკეთილი', lat: 41.6620, lng: 44.8550 },
];

function nearestDistrict(lat, lng, districts) {
  const list = districts && districts.length ? districts : DISTRICTS_BASE;
  let best = list[0], bestDist = Infinity;
  for (const d of list) {
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
  const [services, setServices] = useState([]);
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [address, setAddress] = useState(prefill.address || '');
  const [pinCoords, setPinCoords] = useState(null);
  const [selectedTime, setSelectedTime] = useState('მიმდინარე (ASAP)');
  const [notes, setNotes] = useState('');
  const [isNight, setIsNight] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  // ექთნის არჩევა (სტეპი 3)
  const [districtNurses, setDistrictNurses] = useState([]);
  const [nursesLoading, setNursesLoading] = useState(false);
  const [chosenNurseId, setChosenNurseId]     = useState(prefill.nurseId   || null);
  const [chosenNurseName, setChosenNurseName] = useState(prefill.nurseName || null);
  const [districts, setDistricts] = useState(DISTRICTS_BASE.map(d => ({ ...d, surcharge: 0 })));

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

    // Load district surcharges from API
    adminService.getDistrictPrices().then(prices => {
      setDistricts(DISTRICTS_BASE.map(base => {
        const fromApi = prices.find(p => p.name === base.name);
        return { ...base, surcharge: fromApi ? (fromApi.surcharge ?? 0) : 0 };
      }));
    }).catch(() => {
      // fallback: keep default 0 surcharges
    });

  }, []);

  // When districts load from API, sync selectedDistrict's surcharge and handle prefill
  useEffect(() => {
    if (districts.some(d => d.surcharge !== 0)) {
      // Update currently selected district with fresh surcharge
      if (selectedDistrict) {
        const updated = districts.find(d => d.name === selectedDistrict.name);
        if (updated) setSelectedDistrict(updated);
      }
      // Handle prefill district
      if (prefill.district && !selectedDistrict) {
        const d = districts.find(d => d.name === prefill.district);
        if (d) setSelectedDistrict(d);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districts]);

  const servicesBasePrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const distSurcharge  = selectedDistrict?.surcharge || 0;
  const nightSurcharge = isNight ? Math.round(servicesBasePrice * 0.2) : 0;
  const totalPrice     = servicesBasePrice + distSurcharge + nightSurcharge;

  const canProceed = () => {
    if (step === 1) return selectedServices.length > 0;
    if (step === 2) return address.trim().length > 0 && (!!selectedDistrict || !!pinCoords);
    if (step === 3) return true; // ექთნის არჩევა სურვილისამებრ
    if (step === 4) return !!selectedTime;
    return true;
  };

  const handleSubmit = async () => {
    if (!currentUser) { navigate('/login'); return; }
    setLoading(true);
    const effectiveDistrict = selectedDistrict
      || (pinCoords ? nearestDistrict(pinCoords.lat, pinCoords.lng, districts) : districts[0]);

    // ── Step 1: შეკვეთის შექმნა ──────────────────────────────────────────────
    let order;
    try {
      order = await ordersService.create({
        serviceId:       selectedServices[0].id,
        extraServiceIds: selectedServices.slice(1).map(s => s.id),
        address,
        district:        effectiveDistrict.name,
        isNightTime:     isNight,
        scheduledTime:   selectedTime !== 'მიმდინარე (ASAP)' ? new Date().toISOString() : null,
        latitude:        pinCoords?.lat ?? null,
        longitude:       pinCoords?.lng ?? null,
        preferredNurseId: chosenNurseId,
        notes,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'შეკვეთა ვერ გაიგზავნა. სცადე თავიდან.');
      setLoading(false);
      return;
    }

    // ── Step 2: გადახდა (წარუმატებლობა არ კლავს შეკვეთას) ──────────────────
    if (paymentMethod === 'online') {
      try {
        const payment = await paymentsService.create(order.id);
        if (payment.isDev) {
          await paymentsService.verifyDev(order.id);
          toast.success('✅ შეკვეთა და გადახდა დასრულდა!');
        } else {
          window.location.href = payment.redirectUrl;
          return;
        }
      } catch {
        // BOG Pay not configured or failed — order still exists, proceed
        toast.success('შეკვეთა გაგზავნილია! (გადახდა ადგილზე)');
      }
    } else {
      toast.success('შეკვეთა გაგზავნილია!');
    }

    setLoading(false);
    navigate(`/tracking/${order.id}`);
  };

  return (
    <div className="order-page">
      <div className="container">
        <div className="order-wrapper">
          <div className="steps-bar">
            {[1,2,3,4,5].map(s => (
              <div key={s} className={`step ${step >= s ? 'done' : ''} ${step === s ? 'current' : ''}`}>
                <div className="step-circle">{step > s ? '✓' : s}</div>
                <div className="step-label">{['მომსახურება','მისამართი','ექთანი','დრო','დადასტურება'][s-1]}</div>
              </div>
            ))}
          </div>

          <div className="order-body">
            <div className="order-form">
              {step === 1 && (
                <div className="fade-in">
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
                      {districts.map(d => (
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
                        const d = nearestDistrict(coords.lat, coords.lng, districts);
                        setSelectedDistrict(d);
                      }}
                      onAddressChange={(val) => setAddress(val)}
                      onDistrictDetected={(districtName) => {
                        const d = districts.find(x => x.name === districtName);
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
                  <h2 className="form-title">ექთნის არჩევა</h2>
                  <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 16 }}>
                    კონკრეტული ექთანი აირჩიე ან სისტემას მიანდე — ის შენი უბნის ხელმისაწვდომ ექთანს მოძებნის
                  </p>

                  {/* სისტემა შეარჩევს */}
                  <div
                    onClick={() => { setChosenNurseId(null); setChosenNurseName(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${!chosenNurseId ? 'var(--primary)' : '#e2e8f0'}`,
                      background: !chosenNurseId ? '#eff6ff' : 'white',
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ fontSize: 28 }}>🔀</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>სისტემა შეარჩევს</div>
                      <div style={{ fontSize: 12, color: 'var(--gray)' }}>ხელმისაწვდომ ექთანს ავტომატურად მოვძებნი</div>
                    </div>
                    {!chosenNurseId && <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontWeight: 700 }}>✓</span>}
                  </div>

                  {/* ექთნების სია */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>
                    ან აირჩიე კონკრეტული ექთანი {selectedDistrict ? `(${selectedDistrict.name})` : ''}:
                  </div>
                  {nursesLoading ? (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--gray)' }}>⏳ იტვირთება...</div>
                  ) : districtNurses.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--gray)', fontSize: 13 }}>
                      ამ უბანში ახლა ხელმისაწვდომი ექთანი არ არის — სისტემა სხვა უბნის ექთანს მოძებნის
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {districtNurses.map(n => {
                        const isChosen = chosenNurseId === n.id;
                        return (
                          <div
                            key={n.id}
                            onClick={() => { setChosenNurseId(n.id); setChosenNurseName(n.name); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                              border: `2px solid ${isChosen ? 'var(--primary)' : '#e2e8f0'}`,
                              background: isChosen ? '#eff6ff' : 'white',
                            }}
                          >
                            {n.photoUrl
                              ? <img src={n.photoUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                              : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👩‍⚕️</div>
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{n.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--gray)' }}>
                                {n.experienceYears} წ. გამოცდ. · {n.rating ? `⭐ ${n.rating.toFixed(1)}` : 'შეფ. არ არის'} · {n.totalOrders} შეკვ.
                              </div>
                              {n.services && (
                                <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2 }}>
                                  {n.services.split(',').map(s => s.trim()).filter(Boolean).join(' · ')}
                                </div>
                              )}
                            </div>
                            {isChosen && <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 18 }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
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

              {step === 5 && (
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
                    <div className="cc-row">
                      <span>ექთანი</span>
                      <strong style={{ color: chosenNurseId ? 'var(--primary)' : 'var(--gray)' }}>
                        {chosenNurseId ? `👩‍⚕️ ${chosenNurseName}` : '🔀 სისტემა შეარჩევს'}
                      </strong>
                    </div>
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
                {step < 5 ? (
                  <button className="btn btn-primary" onClick={async () => {
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
                    // სტეპ 3-ზე შესვლისას ექთნების ჩატვირთვა
                    if (step === 2) {
                      const district = selectedDistrict?.name || (pinCoords ? nearestDistrict(pinCoords.lat, pinCoords.lng).name : null);
                      if (district) {
                        setNursesLoading(true);
                        try {
                          const all = await nursesService.getAll({ status: 'Active' });
                          const filtered = all.filter(n =>
                            n.isVerified &&
                            (n.districts || n.district || '').split(',').map(d => d.trim()).includes(district)
                          );
                          setDistrictNurses(filtered);
                        } catch { setDistrictNurses([]); }
                        finally { setNursesLoading(false); }
                      }
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
