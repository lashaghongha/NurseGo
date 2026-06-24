import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { adminService } from '../services/admin.service';
import { servicesService } from '../services/services.service';
import api from '../services/api';
import toast from 'react-hot-toast';
import './AdminPanel.css';

const STATUS_COLORS = {
  Completed:  { bg: '#dcfce7', color: '#15803d', label: 'დასრულდა' },
  InProgress: { bg: '#dbeafe', color: '#1d4ed8', label: 'მიმდინარე' },
  EnRoute:    { bg: '#fef9c3', color: '#a16207', label: 'გზაში' },
  Cancelled:  { bg: '#fee2e2', color: '#dc2626', label: 'გაუქმდა' },
  Pending:    { bg: '#f1f5f9', color: '#64748b', label: 'მოლოდინი' },
  Assigned:   { bg: '#eff6ff', color: '#1d4ed8', label: 'დასახელდა' },
};

const TABS = [
  { key: 'dashboard', label: '📊 დაფა' },
  { key: 'pending',   label: '⚠️ Pending' },
  { key: 'nurses',    label: '👩‍⚕️ ექთნები' },
  { key: 'users',     label: '👤 მომხმარებლები' },
  { key: 'orders',    label: '📋 შეკვეთები' },
  { key: 'prices',    label: '🛠️ მომსახურება' },
  { key: 'ratings',   label: '⭐ შეფასებები' },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [editingService, setEditingService] = useState(null); // null | 'new' | serviceObj
  const [serviceForm, setServiceForm] = useState({ name: '', icon: '💊', price: '', category: '', durationEstimate: '', isActive: true });
  const [ratings, setRatings] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningOrder, setAssigningOrder] = useState(null); // orderId რომელსაც ვანიჭებთ

  useEffect(() => {
    Promise.all([
      adminService.getStats(),
      adminService.getMonthlyRevenue(),
    ]).then(([s, rev]) => {
      setStats(s);
      setRevenueData(rev.map(r => ({
        month: `${r.year}/${r.month}`,
        revenue: Number(r.revenue),
        orders: r.orders,
      })).reverse());
    }).catch(() => toast.error('სტატისტიკის ჩატვირთვა ვერ მოხდა'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'nurses' && nurses.length === 0) {
      adminService.getAllNurses().then(setNurses).catch(() => toast.error('ექთნები ვერ ჩაიტვირთა'));
    }
    if (activeTab === 'orders' && orders.length === 0) {
      adminService.getAllOrders().then(setOrders).catch(() => toast.error('შეკვეთები ვერ ჩაიტვირთა'));
    }
    if (activeTab === 'pending') {
      adminService.getPendingOrders().then(setPendingOrders).catch(() => toast.error('Pending შეკვეთები ვერ ჩაიტვირთა'));
      if (nurses.length === 0)
        adminService.getAllNurses().then(setNurses).catch(() => {});
    }
    if (activeTab === 'prices') {
      servicesService.getAllForAdmin().then(setServices).catch(() => toast.error('მომსახურებები ვერ ჩაიტვირთა'));
    }
    if (activeTab === 'ratings' && ratings.length === 0) {
      api.get('/ratings').then(r => setRatings(r.data)).catch(() => toast.error('შეფასებები ვერ ჩაიტვირთა'));
    }
    if (activeTab === 'users' && users.length === 0) {
      api.get('/admin/users').then(r => setUsers(r.data.users || [])).catch(() => toast.error('მომხმარებლები ვერ ჩაიტვირთა'));
    }
  }, [activeTab]);

  const verifyNurse = async (id) => {
    await adminService.verifyNurse(id);
    setNurses(prev => prev.map(n => n.id === id ? { ...n, isVerified: true, status: 'Active' } : n));
    toast.success('ექთანი დადასტურდა!');
  };

  const blockNurse = async (id) => {
    await adminService.blockNurse(id);
    setNurses(prev => prev.map(n => n.id === id ? { ...n, status: 'Blocked' } : n));
    toast.success('ექთანი დაიბლოკა');
  };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`წაშლა: ${name}?`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success('მომხმარებელი წაიშალა');
    } catch { toast.error('შეცდომა'); }
  };

  const assignNurse = async (orderId, nurseId) => {
    try {
      await adminService.assignNurse(orderId, nurseId);
      setPendingOrders(prev => prev.filter(o => o.id !== orderId));
      setStats(prev => prev ? { ...prev, pendingOrders: (prev.pendingOrders || 1) - 1 } : prev);
      setAssigningOrder(null);
      toast.success('ექთანი დაინიშნა!');
    } catch { toast.error('შეცდომა'); }
  };

  const CATEGORIES = ['ინექცია', 'გადასხმა', 'მოვლა', 'გაზომვა', 'პატრონაჟი', 'დამატებითი', 'სასწრაფო'];
  const ICONS = ['💉','🩸','🧴','🔧','🩹','✂️','📏','🍬','👴','💊','🎥','🚨','🏥','💙','🩺','🧪','❤️','🫀','🧠','💪'];

  const openNew = () => {
    setServiceForm({ name: '', icon: '💊', price: '', category: CATEGORIES[0], durationEstimate: '', isActive: true });
    setEditingService('new');
  };
  const openEdit = (s) => {
    setServiceForm({ name: s.name, icon: s.icon, price: s.price, category: s.category, durationEstimate: s.durationEstimate, isActive: s.isActive });
    setEditingService(s);
  };
  const closeForm = () => setEditingService(null);

  const saveService = async () => {
    const payload = { ...serviceForm, price: Number(serviceForm.price) };
    if (!payload.name || !payload.price || !payload.category) {
      toast.error('შეავსე სავალდებულო ველები');
      return;
    }
    try {
      if (editingService === 'new') {
        const created = await servicesService.create(payload);
        setServices(prev => [...prev, created]);
        toast.success('მომსახურება დაემატა!');
      } else {
        const updated = await servicesService.update(editingService.id, payload);
        setServices(prev => prev.map(s => s.id === updated.id ? updated : s));
        toast.success('მომსახურება განახლდა!');
      }
      closeForm();
    } catch { toast.error('შეცდომა. სცადე თავიდან.'); }
  };

  const deleteService = async (id) => {
    if (!window.confirm('დარწმუნებული ხარ წაშლაში? (სერვისი გამოირთვება, მაგრამ ისტორია შეინახება)')) return;
    try {
      await servicesService.delete(id);
      setServices(prev => prev.map(s => s.id === id ? { ...s, isActive: false } : s));
      toast.success('მომსახურება გამოირთო!');
    } catch { toast.error('შეცდომა'); }
  };

  const restoreService = async (id) => {
    try {
      const updated = await servicesService.restore(id);
      setServices(prev => prev.map(s => s.id === updated.id ? updated : s));
      toast.success('მომსახურება ჩაირთო!');
    } catch { toast.error('შეცდომა'); }
  };

  const NURSE_STATUS = {
    Active:  { cls: 'badge-active',   label: '🟢 აქტიური' },
    Busy:    { cls: 'badge-busy',     label: '🟡 დაკავებული' },
    Pending: { cls: 'badge-offline',  label: '⚫ მოლოდინი' },
    Blocked: { cls: 'badge-vacation', label: '🔴 დაბლოკილი' },
  };

  return (
    <div className="admin-page">
      <div className="admin-sidebar">
        <div className="admin-brand">🏥 NurseGo <span>Admin</span></div>
        {TABS.map(t => (
          <button key={t.key} className={`admin-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}>
            {t.label}
            {t.key === 'pending' && stats?.pendingOrders > 0 && (
              <span style={{
                background: '#ef4444', color: 'white', borderRadius: '50%',
                width: 18, height: 18, fontSize: 11, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: 6,
              }}>{stats.pendingOrders}</span>
            )}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="fade-in">
            <h1 className="page-title">საერთო სტატისტიკა</h1>
            {loading ? <div>⏳ იტვირთება...</div> : (
              <>{stats?.pendingOrders > 0 && (
                <div style={{
                  background: '#fff7ed', border: '1.5px solid #fed7aa',
                  borderRadius: 12, padding: '14px 20px', marginBottom: 24,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <span style={{ fontSize: 28 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#92400e', fontSize: 15 }}>
                      {stats.pendingOrders} შეკვეთა ელოდება ექთანს!
                    </div>
                    <div style={{ fontSize: 13, color: '#b45309', marginTop: 2 }}>
                      ყველაზე ძველი: {stats.oldestPendingMinutes} წუთია ელოდება
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('pending')}>
                    ნახვა →
                  </button>
                </div>
              )}
                <div className="grid-4" style={{ marginBottom: 32 }}>
                  <div className="stat-card"><div className="sc-val">{Number(stats?.totalRevenue || 0).toFixed(0)}₾</div><div className="sc-label">სულ შემოსავალი</div><div className="sc-icon">💰</div></div>
                  <div className="stat-card"><div className="sc-val">{stats?.totalOrders || 0}</div><div className="sc-label">სულ შეკვეთა</div><div className="sc-icon">📋</div></div>
                  <div className="stat-card"><div className="sc-val">{stats?.activeNurses || 0}</div><div className="sc-label">აქტიური ექთანი</div><div className="sc-icon">👩‍⚕️</div></div>
                  <div className={`stat-card ${stats?.pendingNurses > 0 ? 'pending' : ''}`}>
                    <div className="sc-val">{stats?.pendingNurses || 0}</div>
                    <div className="sc-label">დასადასტურებელი</div>
                    <div className="sc-icon">{stats?.pendingNurses > 0 ? '⚠️' : '✅'}</div>
                  </div>
                </div>
                <div className="charts-grid">
                  <div className="card">
                    <h3 style={{ marginBottom: 20 }}>შემოსავალი (₾)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={v => [`${v}₾`, 'შემოსავალი']} />
                        <Bar dataKey="revenue" fill="#0ea5e9" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="card">
                    <h3 style={{ marginBottom: 20 }}>შეკვეთები</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* PENDING ORDERS */}
        {activeTab === 'pending' && (
          <div className="fade-in">
            <h1 className="page-title">⚠️ მოუნიჭებელი შეკვეთები</h1>
            <p className="page-subtitle" style={{ marginBottom: 20 }}>
              ამ შეკვეთებს ჯერ არარ მიუღია ექთანი — ხელით მიანიჭე
            </p>
            {pendingOrders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--gray)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>ყველა შეკვეთა მიღებულია!</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>მოუნიჭებელი შეკვეთა არ არის</div>
              </div>
            ) : pendingOrders.map(o => (
              <div key={o.id} className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--warning)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {o.service?.icon} {o.service?.name}
                      <span style={{ fontSize: 12, color: 'var(--gray)', fontWeight: 400, marginLeft: 8 }}>#{o.id}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 4 }}>
                      👤 {o.customer?.name} · 📍 {o.district}, {o.address}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600, marginTop: 4 }}>
                      🕐 {Math.round((Date.now() - new Date(o.createdAt)) / 60000)} წუთია ელოდება
                    </div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: 'var(--primary)' }}>{o.totalPrice}₾</div>
                </div>

                {assigningOrder === o.id ? (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      აირჩიე ექთანი {o.district} უბნიდან (ან ნებისმიერი):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {nurses
                        .filter(n => n.status === 'Active' && n.isVerified)
                        .sort((a, b) => {
                          const aMatch = (a.districts || a.district || '').includes(o.district);
                          const bMatch = (b.districts || b.district || '').includes(o.district);
                          return bMatch - aMatch;
                        })
                        .map(n => {
                          const inDistrict = (n.districts || n.district || '').includes(o.district);
                          return (
                            <button key={n.id} onClick={() => assignNurse(o.id, n.id)}
                              className="btn btn-sm"
                              style={{
                                background: inDistrict ? '#eff6ff' : '#f8fafc',
                                border: `2px solid ${inDistrict ? 'var(--primary)' : '#e2e8f0'}`,
                                color: 'var(--dark)', fontWeight: 600,
                              }}>
                              👩‍⚕️ {n.name || n.user?.name}
                              {inDistrict && <span style={{ color: 'var(--primary)', marginLeft: 4 }}>✓</span>}
                              {n.rating > 0 && <span style={{ fontSize: 11, color: 'var(--gray)', marginLeft: 4 }}>⭐{n.rating?.toFixed(1)}</span>}
                            </button>
                          );
                        })}
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => setAssigningOrder(null)}>გაუქმება</button>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => setAssigningOrder(o.id)}>
                    👩‍⚕️ ექთნის მინიჭება
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* NURSES */}
        {activeTab === 'nurses' && (
          <div className="fade-in">
            <h1 className="page-title">ექთნების მართვა</h1>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>ექთანი</th><th>სტატუსი</th><th>უბანი</th><th>შეკვ.</th><th>შემოსავ.</th><th>რეიტ.</th><th>მოქმ.</th></tr></thead>
                <tbody>
                  {nurses.map(n => (
                    <tr key={n.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 22 }}>👩‍⚕️</span>
                          <div>
                            <div style={{ fontWeight: 600 }}>{n.user?.name}</div>
                            {!n.isVerified && <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 700 }}>⚠️ ვერიფიკაცია</span>}
                            {n.isPremium && <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}> ⭐ Premium</span>}
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${NURSE_STATUS[n.status]?.cls || 'badge-offline'}`}>{NURSE_STATUS[n.status]?.label || n.status}</span></td>
                      <td>{n.district}</td>
                      <td>{n.totalOrders}</td>
                      <td style={{ fontWeight: 700, color: 'var(--secondary)' }}>{n.realEarnings ?? '—'}₾</td>
                      <td>{n.rating ? `⭐ ${n.rating.toFixed(1)}` : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {!n.isVerified && <button className="btn btn-secondary btn-sm" onClick={() => verifyNurse(n.id)}>✅ დადასტ.</button>}
                          {n.status !== 'Blocked' && n.isVerified && <button className="btn btn-danger btn-sm" onClick={() => blockNurse(n.id)}>🚫 დაბლ.</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeTab === 'orders' && (
          <div className="fade-in">
            <h1 className="page-title">შეკვეთების მართვა</h1>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>#</th><th>კლიენტი</th><th>მომსახ.</th><th>ექთანი</th><th>სტატუსი</th><th>ფასი</th><th>თარიღი</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--gray)', fontSize: 13 }}>#{o.id}</td>
                      <td style={{ fontWeight: 600 }}>{o.customer?.name}</td>
                      <td>{o.service?.name}</td>
                      <td>{o.nurse?.user?.name || '—'}</td>
                      <td>
                        <span style={{ background: STATUS_COLORS[o.status]?.bg, color: STATUS_COLORS[o.status]?.color, padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                          {STATUS_COLORS[o.status]?.label || o.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{o.totalPrice}₾</td>
                      <td style={{ fontSize: 12, color: 'var(--gray)' }}>{new Date(o.createdAt).toLocaleDateString('ka-GE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PRICES */}
        {activeTab === 'prices' && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h1 className="page-title" style={{ margin: 0 }}>🛠️ მომსახურებების მართვა</h1>
              <button className="btn btn-primary" onClick={openNew}>+ ახალი მომსახურება</button>
            </div>

            {/* Modal */}
            {editingService !== null && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card" style={{ width: '100%', maxWidth: 520, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
                  <h2 style={{ marginBottom: 20 }}>{editingService === 'new' ? '➕ ახალი მომსახურება' : '✏️ მომსახურების რედაქტირება'}</h2>

                  <div className="form-group">
                    <label>სახელი *</label>
                    <input className="form-input" value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))} placeholder="მაგ. კუნთში ინექცია" />
                  </div>

                  <div className="form-group">
                    <label>ემოჯი / ხატულა *</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      {ICONS.map(ic => (
                        <button key={ic} type="button"
                          onClick={() => setServiceForm(f => ({ ...f, icon: ic }))}
                          style={{ fontSize: 22, padding: '4px 8px', borderRadius: 8, border: serviceForm.icon === ic ? '2px solid var(--primary)' : '2px solid transparent', background: serviceForm.icon === ic ? 'var(--primary-light, #eff6ff)' : '#f8fafc', cursor: 'pointer' }}>
                          {ic}
                        </button>
                      ))}
                    </div>
                    <input className="form-input" value={serviceForm.icon} onChange={e => setServiceForm(f => ({ ...f, icon: e.target.value }))} placeholder="ან აკრიფე ემოჯი" style={{ width: 100 }} />
                  </div>

                  <div className="form-group">
                    <label>კატეგორია *</label>
                    <select className="form-input" value={serviceForm.category} onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>ფასი (₾) *</label>
                    <input className="form-input" type="number" min={1} value={serviceForm.price} onChange={e => setServiceForm(f => ({ ...f, price: e.target.value }))} placeholder="20" />
                  </div>

                  <div className="form-group">
                    <label>ხანგრძლივობა</label>
                    <input className="form-input" value={serviceForm.durationEstimate} onChange={e => setServiceForm(f => ({ ...f, durationEstimate: e.target.value }))} placeholder="30 წთ" />
                  </div>

                  {editingService !== 'new' && (
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="checkbox" id="svc-active" checked={serviceForm.isActive} onChange={e => setServiceForm(f => ({ ...f, isActive: e.target.checked }))} />
                      <label htmlFor="svc-active" style={{ marginBottom: 0 }}>აქტიური (ჩართული)</label>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveService}>✅ შენახვა</button>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={closeForm}>გაუქმება</button>
                  </div>
                </div>
              </div>
            )}

            {/* Services table */}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ხატ.</th>
                    <th>სახელი</th>
                    <th>კატეგ.</th>
                    <th>ფასი</th>
                    <th>ხანგ.</th>
                    <th>სტ.</th>
                    <th>მოქმ.</th>
                  </tr>
                </thead>
                <tbody>
                  {services.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray)', padding: 32 }}>მომსახურება არ არის</td></tr>
                  ) : services.map(s => (
                    <tr key={s.id} style={{ opacity: s.isActive ? 1 : 0.45 }}>
                      <td style={{ fontSize: 24 }}>{s.icon}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span style={{ fontSize: 12, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20 }}>{s.category}</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 16 }}>{s.price}₾</td>
                      <td style={{ color: 'var(--gray)', fontSize: 13 }}>{s.durationEstimate || '—'}</td>
                      <td>
                        {s.isActive
                          ? <span style={{ color: '#15803d', fontSize: 12 }}>✅ ჩართ.</span>
                          : <span style={{ color: '#dc2626', fontSize: 12 }}>❌ გამოირთ.</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>✏️</button>
                          {s.isActive
                            ? <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }} onClick={() => deleteService(s.id)}>🗑️</button>
                            : <button className="btn btn-sm" style={{ background: '#dcfce7', color: '#15803d', border: 'none' }} onClick={() => restoreService(s.id)}>↩️</button>
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* RATINGS */}
        {activeTab === 'ratings' && (
          <div className="fade-in">
            <h1 className="page-title">შეფასებები</h1>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>ექთანი</th><th>კლიენტი</th><th>ვარსკვლავები</th><th>კომენტარი</th><th>შეკვ.#</th><th>თარიღი</th></tr>
                </thead>
                <tbody>
                  {ratings.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray)', padding: 32 }}>შეფასება ჯერ არ არის</td></tr>
                  ) : ratings.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>👩‍⚕️ {r.nurseName}</td>
                      <td>{r.customerName}</td>
                      <td>
                        <span style={{ color: '#f59e0b', fontSize: 16 }}>{'★'.repeat(r.stars)}</span>
                        <span style={{ color: '#e2e8f0' }}>{'★'.repeat(5 - r.stars)}</span>
                        <span style={{ fontSize: 12, color: 'var(--gray)', marginLeft: 6 }}>{r.stars}/5</span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--gray)', maxWidth: 200 }}>{r.comment || '—'}</td>
                      <td style={{ color: 'var(--gray)', fontSize: 13 }}>#{r.orderId}</td>
                      <td style={{ fontSize: 12, color: 'var(--gray)' }}>{new Date(r.createdAt).toLocaleDateString('ka-GE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="fade-in">
            <h1 className="page-title">მომხმარებლები</h1>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>სახელი</th><th>მეილი</th><th>ტელეფონი</th><th>შეკვეთები</th><th>რეგ. თარიღი</th><th>მოქმედება</th></tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray)', padding: 32 }}>მომხმარებელი ჯერ არ არის</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>👤 {u.name}</td>
                      <td style={{ fontSize: 13 }}>{u.email}</td>
                      <td style={{ fontSize: 13, color: 'var(--gray)' }}>{u.phone || '—'}</td>
                      <td>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 600 }}>
                          {u.totalOrders} შეკვ.
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--gray)' }}>{new Date(u.createdAt).toLocaleDateString('ka-GE')}</td>
                      <td>
                        <button
                          onClick={() => deleteUser(u.id, u.name)}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                        >🗑 წაშლა</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
