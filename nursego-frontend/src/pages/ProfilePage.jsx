import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate, Link } from 'react-router-dom';
import { ordersService } from '../services/orders.service';
import { nursesService } from '../services/nurses.service';
import toast from 'react-hot-toast';
import './ProfilePage.css';

const STATUS_LABELS = {
  Pending:    { label: 'მოლოდინი',   bg: '#f1f5f9', color: '#64748b' },
  Assigned:   { label: 'დასახელდა',  bg: '#eff6ff', color: '#1d4ed8' },
  EnRoute:    { label: 'გზაში',       bg: '#fef9c3', color: '#a16207' },
  InProgress: { label: 'მიმდინარე',  bg: '#dbeafe', color: '#1d4ed8' },
  Completed:  { label: 'დასრულდა',   bg: '#dcfce7', color: '#15803d' },
  Cancelled:  { label: 'გაუქმდა',    bg: '#fee2e2', color: '#dc2626' },
};

const STATUS_COLORS = {
  Active:   { bg: '#dcfce7', color: '#15803d', label: '🟢 აქტიური' },
  Busy:     { bg: '#fef9c3', color: '#a16207', label: '🟡 დაკავებული' },
  Vacation: { bg: '#eff6ff', color: '#1d4ed8', label: '🔵 შვებულება' },
  Offline:  { bg: '#f1f5f9', color: '#64748b', label: '⚫ ოფლაინი' },
  Pending:  { bg: '#fff7ed', color: '#c2410c', label: '🟠 მოლოდინი' },
  Blocked:  { bg: '#fee2e2', color: '#dc2626', label: '🔴 დაბლოკილი' },
};

export default function ProfilePage() {
  const { currentUser, userRole, logout } = useApp();
  const navigate = useNavigate();
  const [orders,       setOrders]       = useState([]);
  const [nurseData,    setNurseData]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [cancelId,     setCancelId]     = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = React.useRef(null);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { photoUrl } = await nursesService.uploadPhoto(file);
      setNurseData(prev => ({ ...prev, photoUrl }));
      toast.success('ფოტო განახლდა!');
    } catch {
      toast.error('ფოტო ვერ ავტვირთე');
    } finally {
      setUploadingPhoto(false);
    }
  };

  useEffect(() => {
    if (userRole === 'customer') {
      ordersService.getMyOrders()
        .then(setOrders)
        .catch(() => toast.error('შეკვეთები ვერ ჩაიტვირთა'))
        .finally(() => setLoading(false));
    } else if (userRole === 'nurse') {
      nursesService.getMe()
        .then(setNurseData)
        .catch(() => toast.error('პროფილი ვერ ჩაიტვირთა'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [userRole]);

  const handleLogout = () => { logout(); navigate('/'); };

  const handleCancel = async (id) => {
    try {
      await ordersService.cancel(id, 'კლიენტმა გააუქმა');
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'Cancelled' } : o));
      setCancelId(null);
      toast.success('შეკვეთა გაუქმდა');
    } catch (err) {
      toast.error(err.response?.data?.message || 'გაუქმება ვერ მოხდა');
    }
  };

  const totalSpent    = orders.filter(o => o.status === 'Completed').reduce((s, o) => s + (o.totalPrice || 0), 0);
  const completedCount = orders.filter(o => o.status === 'Completed').length;

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-wrapper">

          {/* Profile Card */}
          <div className="profile-card card">
            <div style={{ position:'relative', display:'inline-block', marginBottom:16 }}>
              {nurseData?.photoUrl ? (
                <img
                  src={`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace('/api', '')}${nurseData.photoUrl}`}
                  alt="profile"
                  style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover',
                    border:'3px solid var(--primary)' }}
                />
              ) : (
                <div className="pc-avatar" style={{ marginBottom:0 }}>
                  {currentUser?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              {userRole === 'nurse' && (
                <>
                  <input ref={photoInputRef} type="file" accept="image/*"
                    style={{ display:'none' }} onChange={handlePhotoChange} />
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    style={{
                      position:'absolute', bottom:0, right:0,
                      width:26, height:26, borderRadius:'50%',
                      background:'var(--primary)', color:'white',
                      border:'2px solid white', cursor:'pointer',
                      fontSize:13, display:'flex', alignItems:'center', justifyContent:'center',
                    }}
                    title="ფოტოს შეცვლა">
                    {uploadingPhoto ? '⏳' : '📷'}
                  </button>
                </>
              )}
            </div>
            <div className="pc-name">{currentUser?.name}</div>
            <div className="pc-email">{currentUser?.email}</div>
            <div className="pc-role">
              {userRole === 'customer' ? '👤 კლიენტი' : userRole === 'nurse' ? '👩‍⚕️ ექთანი' : '🔧 ადმინი'}
            </div>

            {userRole === 'customer' && (
              <div className="pc-stats">
                <div className="pcs-item">
                  <div className="pcs-val">{completedCount}</div>
                  <div className="pcs-label">შეკვეთა</div>
                </div>
                <div className="pcs-item">
                  <div className="pcs-val">{totalSpent.toFixed(0)}₾</div>
                  <div className="pcs-label">სულ გადახდა</div>
                </div>
              </div>
            )}
            {userRole === 'nurse' && nurseData && (
              <div className="pc-stats">
                <div className="pcs-item">
                  <div className="pcs-val">⭐{Number(nurseData.rating||0).toFixed(1)}</div>
                  <div className="pcs-label">რეიტინგი</div>
                </div>
                <div className="pcs-item">
                  <div className="pcs-val">{nurseData.completedCount||0}</div>
                  <div className="pcs-label">შეკვეთები</div>
                </div>
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:16, width:'100%' }}>
              {userRole === 'nurse' && (
                <Link to="/nurse/dashboard" className="btn btn-secondary" style={{ justifyContent:'center' }}>
                  📊 ჩემი პანელი
                </Link>
              )}
              {userRole === 'admin' && (
                <Link to="/admin" className="btn btn-secondary" style={{ justifyContent:'center' }}>
                  🔧 ადმინ პანელი
                </Link>
              )}
              <button className="btn btn-outline" onClick={handleLogout}>🚪 გასვლა</button>
            </div>
          </div>

          {/* Nurse Profile */}
          {userRole === 'nurse' && (
            <div className="nurse-profile">
              {loading ? (
                <div style={{ textAlign:'center', padding:'40px 0', color:'var(--gray)' }}>⏳ იტვირთება...</div>
              ) : nurseData ? (
                <>
                  {/* სტატუსი + ვერიფიკაცია */}
                  <div className="card" style={{ padding:20 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:15 }}>სამუშაო სტატუსი</div>
                        {(() => {
                          const s = STATUS_COLORS[nurseData.status] || STATUS_COLORS.Offline;
                          return (
                            <span style={{ background:s.bg, color:s.color, padding:'4px 14px', borderRadius:20,
                              fontSize:13, fontWeight:700, display:'inline-block', marginTop:6 }}>
                              {s.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ textAlign:'right' }}>
                        {nurseData.isVerified ? (
                          <span style={{ background:'#dcfce7', color:'#15803d', padding:'4px 14px',
                            borderRadius:20, fontSize:13, fontWeight:700 }}>✅ ვერიფიცირებული</span>
                        ) : (
                          <span style={{ background:'#fff7ed', color:'#c2410c', padding:'4px 14px',
                            borderRadius:20, fontSize:13, fontWeight:700 }}>⏳ ვერიფიკაციის მოლოდინი</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* სტატისტიკა */}
                  <div className="np-stats-grid">
                    <div className="np-stat">
                      <div className="np-stat-val">⭐ {Number(nurseData.rating || 0).toFixed(1)}</div>
                      <div className="np-stat-label">რეიტინგი</div>
                    </div>
                    <div className="np-stat">
                      <div className="np-stat-val">{nurseData.completedCount || 0}</div>
                      <div className="np-stat-label">დასრ. შეკვეთა</div>
                    </div>
                    <div className="np-stat">
                      <div className="np-stat-val">{Number(nurseData.totalEarnings || 0).toFixed(0)}₾</div>
                      <div className="np-stat-label">სულ შემოსავალი</div>
                    </div>
                    <div className="np-stat">
                      <div className="np-stat-val">{nurseData.experienceYears || 0}</div>
                      <div className="np-stat-label">წლის გამოცდ.</div>
                    </div>
                  </div>

                  {/* უბნები */}
                  <div className="card" style={{ padding:20 }}>
                    <div className="np-section-title">📍 სამუშაო უბნები</div>
                    <div className="np-district-chips">
                      {(nurseData.districts || nurseData.district || '').split(',').filter(Boolean).map(d => (
                        <span key={d} className="np-district-chip">{d.trim()}</span>
                      ))}
                    </div>
                  </div>

                  {/* მომსახურებები */}
                  {nurseData.services && (
                    <div className="card" style={{ padding:20 }}>
                      <div className="np-section-title">💉 მომსახურებები</div>
                      <div className="np-service-chips">
                        {nurseData.services.split(',').filter(Boolean).map(s => (
                          <span key={s} className="np-chip">{s.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ბოლო შეკვეთები */}
                  {nurseData.recentOrders?.length > 0 && (
                    <div className="card" style={{ padding:20 }}>
                      <div className="np-section-title">📋 ბოლო შეკვეთები</div>
                      {nurseData.recentOrders.map(o => {
                        const done = o.status === 'Completed';
                        return (
                          <div key={o.id} className="np-order">
                            <div className="np-order-info">
                              <div className="np-order-svc">{o.serviceIcon} {o.serviceName}</div>
                              <div className="np-order-sub">
                                📍 {o.district} · 👤 {o.customerName}
                                · {new Date(o.createdAt).toLocaleDateString('ka-GE')}
                              </div>
                            </div>
                            <div style={{ textAlign:'right', flexShrink:0, marginLeft:12 }}>
                              {done && (
                                <div className="np-order-price">
                                  +{(o.totalPrice * 0.8).toFixed(0)}₾
                                </div>
                              )}
                              <div style={{
                                fontSize:11, fontWeight:700, marginTop:4,
                                color: done ? '#15803d' : o.status === 'Cancelled' ? '#dc2626' : '#a16207'
                              }}>
                                {done ? 'დასრ.' : o.status === 'Cancelled' ? 'გაუქმდა' : 'მიმდინარე'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* შეფასებები */}
                  {nurseData.ratings?.length > 0 && (
                    <div className="card" style={{ padding:20 }}>
                      <div className="np-section-title">💬 ბოლო შეფასებები</div>
                      {nurseData.ratings.map((r, i) => (
                        <div key={i} className="np-rating-item">
                          <div>
                            <div className="np-stars">{'★'.repeat(r.stars)}{'☆'.repeat(5-r.stars)}</div>
                            {r.comment && <div className="np-rating-comment">"{r.comment}"</div>}
                            <div className="np-rating-date">
                              {new Date(r.createdAt).toLocaleDateString('ka-GE')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Link to="/nurse/dashboard" className="btn btn-primary" style={{ justifyContent:'center' }}>
                    📊 ექთნის პანელი
                  </Link>
                </>
              ) : (
                <div className="card" style={{ textAlign:'center', padding:'48px 20px' }}>
                  <p style={{ color:'var(--gray)' }}>პროფილი ვერ ჩაიტვირთა</p>
                </div>
              )}
            </div>
          )}

          {/* Orders History */}
          {userRole === 'customer' && (
            <div className="orders-history">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <h2>ჩემი შეკვეთები</h2>
                <Link to="/order" className="btn btn-primary btn-sm">+ ახალი შეკვეთა</Link>
              </div>

              {loading ? (
                <div style={{ textAlign:'center', padding:'40px 0', color:'var(--gray)' }}>⏳ იტვირთება...</div>
              ) : orders.length === 0 ? (
                <div className="card" style={{ textAlign:'center', padding:'48px 20px' }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
                  <p style={{ color:'var(--gray)' }}>შეკვეთა ჯერ არ გაქვს</p>
                  <Link to="/order" className="btn btn-primary" style={{ marginTop:16, justifyContent:'center' }}>
                    პირველი შეკვეთა →
                  </Link>
                </div>
              ) : (
                orders.map(o => {
                  const st = STATUS_LABELS[o.status] || STATUS_LABELS.Pending;
                  const canCancel = !['Completed','Cancelled','InProgress','Arrived'].includes(o.status);
                  return (
                    <div key={o.id} className="oh-card card">
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:15 }}>
                            {o.service?.icon} {o.service?.name}
                          </div>
                          <div style={{ fontSize:13, color:'var(--gray)', marginTop:4 }}>
                            📍 {o.district}, {o.address}
                          </div>
                          {o.nurse && (
                            <div style={{ fontSize:13, color:'var(--gray)' }}>
                              👩‍⚕️ {o.nurse?.user?.name}
                            </div>
                          )}
                          <div style={{ fontSize:12, color:'var(--gray)', marginTop:2 }}>
                            {new Date(o.createdAt).toLocaleDateString('ka-GE')}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontWeight:800, color:'var(--primary)', fontSize:18 }}>{o.totalPrice}₾</div>
                          <div style={{ fontSize:11, background:st.bg, color:st.color,
                            padding:'3px 10px', borderRadius:10, fontWeight:700, marginTop:6, whiteSpace:'nowrap' }}>
                            {st.label}
                          </div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8, marginTop:12 }}>
                        {o.status !== 'Cancelled' && o.status !== 'Pending' && (
                          <Link to={`/tracking/${o.id}`} className="btn btn-outline btn-sm">
                            📍 თვალყური
                          </Link>
                        )}
                        {canCancel && (
                          cancelId === o.id ? (
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <span style={{ fontSize:13, color:'var(--gray)' }}>დარწმუნებული ხარ?</span>
                              <button className="btn btn-sm" style={{ background:'#dc2626', color:'white', border:'none', borderRadius:8, padding:'4px 12px', cursor:'pointer' }}
                                onClick={() => handleCancel(o.id)}>კი</button>
                              <button className="btn btn-outline btn-sm" onClick={() => setCancelId(null)}>არა</button>
                            </div>
                          ) : (
                            <button className="btn btn-outline btn-sm"
                              style={{ color:'#dc2626', borderColor:'#dc2626' }}
                              onClick={() => setCancelId(o.id)}>
                              ❌ გაუქმება
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
