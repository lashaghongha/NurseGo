import React, { useState, useEffect, useRef } from 'react';
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
  const [pendingNurses, setPendingNurses] = useState([]);
  const [services, setServices] = useState([]);
  const [editingService, setEditingService] = useState(null); // null | 'new' | serviceObj
  const [serviceForm, setServiceForm] = useState({ name: '', icon: '💊', price: '', category: '', durationEstimate: '', isActive: true });
  const [ratings, setRatings] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningOrder, setAssigningOrder] = useState(null);
  const [editingNurse, setEditingNurse] = useState(null); // nurse obj or null
  const [nurseForm, setNurseForm] = useState({});
  const [nurseFormSaving, setNurseFormSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef(null);
  const activeTabRef = useRef(null);

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
      adminService.getPendingNurses().then(setPendingNurses).catch(() => {});
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
    try {
      await adminService.verifyNurse(id);
      setNurses(prev => prev.map(n => n.id === id ? { ...n, isVerified: true, status: 'Active' } : n));
      setPendingNurses(prev => prev.filter(n => n.id !== id));
      toast.success('✅ ექთანი დამტკიცდა და გააქტიურდა!');
    } catch { toast.error('შეცდომა'); }
  };

  const rejectNurse = async (id, name) => {
    if (!window.confirm(`უარყო ${name}-ის განაცხადი? ეს ამოშლის მათ ანგარიშს.`)) return;
    try {
      await adminService.rejectNurse(id);
      setPendingNurses(prev => prev.filter(n => n.id !== id));
      toast.success('განაცხადი უარყოფილია');
    } catch { toast.error('შეცდომა'); }
  };

  const blockNurse = async (id) => {
    await adminService.blockNurse(id);
    setNurses(prev => prev.map(n => n.id === id ? { ...n, status: 'Blocked' } : n));
    toast.success('ექთანი დაიბლოკა');
  };

  const unblockNurse = async (id) => {
    await adminService.unblockNurse(id);
    setNurses(prev => prev.map(n => n.id === id ? { ...n, status: 'Active' } : n));
    toast.success('ექთანი განიბლოკა');
  };

  const deleteNurse = async (id, name) => {
    if (!window.confirm(`წაიშალოს ${name}? ეს სამუდამოდ წაშლის მათ ანგარიშს!`)) return;
    try {
      await adminService.deleteNurse(id);
      setNurses(prev => prev.filter(n => n.id !== id));
      setPendingNurses(prev => prev.filter(n => n.id !== id));
      toast.success('ექთანი წაიშალა');
    } catch { toast.error('შეცდომა'); }
  };

  const adjustNurseRating = async (id, delta) => {
    try {
      const res = await api.post(`/nurses/${id}/adjust-rating`, { delta });
      setNurses(prev => prev.map(n => n.id === id ? { ...n, rating: res.data.rating } : n));
    } catch { toast.error('შეცდომა'); }
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

  const ALL_DISTRICTS = ['ვაკე','საბურთალო','გლდანი','დიდუბე','ნაძალადევი','ისანი','სამგორი','კრწანისი','დიღომი','ვარკეთილი'];

  const openNurseEdit = (n) => {
    setNurseForm({
      name:          n.name || n.user?.name || '',
      email:         n.email || n.user?.email || '',
      phone:         n.phone || n.user?.phone || '',
      newPassword:   '',
      licenseNumber: n.licenseNumber || '',
      districts:     n.districts || n.district || '',
      services:      n.services || '',
      experienceYears: n.experienceYears ?? 0,
      status:        n.status || 'Active',
      isVerified:    n.isVerified ?? false,
    });
    setEditingNurse(n);
  };

  const saveNurseEdit = async () => {
    setNurseFormSaving(true);
    try {
      const payload = {
        name:           nurseForm.name || null,
        email:          nurseForm.email || null,
        phone:          nurseForm.phone || null,
        newPassword:    nurseForm.newPassword || null,
        licenseNumber:  nurseForm.licenseNumber || null,
        districts:      nurseForm.districts || null,
        services:       nurseForm.services || null,
        experienceYears: nurseForm.experienceYears !== '' ? Number(nurseForm.experienceYears) : null,
        status:         nurseForm.status || null,
        isVerified:     nurseForm.isVerified,
      };
      const updated = await adminService.updateNurse(editingNurse.id, payload);
      setNurses(prev => prev.map(n => n.id === editingNurse.id ? { ...n, ...updated, user: { ...n.user, name: updated.name, email: updated.email, phone: updated.phone } } : n));
      setEditingNurse(null);
      toast.success('ექთნის ინფო განახლდა!');
    } catch (err) {
      console.error('nurse update error:', err.response?.status, err.response?.data, err.message);
      const msg = err.response?.data?.message || err.response?.data?.title || err.response?.data || err.message || 'შეცდომა';
      toast.error(typeof msg === 'string' ? msg : `შეცდომა ${err.response?.status || ''}`);
    } finally {
      setNurseFormSaving(false);
    }
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
      {/* Mobile hamburger bar */}
      <div className="admin-mobile-bar">
        <span className="admin-mobile-title">🏥 NurseGo <span className="admin-mobile-badge">Admin</span></span>
        <button className="admin-hamburger" onClick={() => setMenuOpen(o => !o)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Overlay when menu open on mobile */}
      {menuOpen && <div className="admin-menu-overlay" onClick={() => setMenuOpen(false)} />}

      <div className={`admin-sidebar ${menuOpen ? 'open' : ''}`} ref={sidebarRef}>
        <div className="admin-brand">🏥 NurseGo <span>Admin</span></div>
        {TABS.map(t => (
          <button key={t.key}
            ref={activeTab === t.key ? activeTabRef : null}
            className={`admin-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(t.key);
              setMenuOpen(false);
              setTimeout(() => activeTabRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 50);
            }}>
            {t.label}
            {t.key === 'pending' && ((stats?.pendingOrders || 0) + (stats?.pendingNurses || 0)) > 0 && (
              <span style={{
                background: '#ef4444', color: 'white', borderRadius: '50%',
                width: 18, height: 18, fontSize: 11, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: 6,
              }}>{(stats?.pendingOrders || 0) + (stats?.pendingNurses || 0)}</span>
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

            {/* ── PENDING NURSES ── */}
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
              👩‍⚕️ ახალი ექთნების განაცხადები
              {pendingNurses.length > 0 && (
                <span style={{ marginLeft: 8, background: '#dc2626', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 13 }}>
                  {pendingNurses.length}
                </span>
              )}
            </h2>

            {pendingNurses.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 28, color: 'var(--gray)', marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>✅</div>
                <div>მოლოდინში ექთანი არ არის</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14, marginBottom: 32 }}>
                {pendingNurses.map(n => (
                  <div key={n.id} className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>👩‍⚕️ {n.name}</div>
                        <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 4 }}>
                          📧 {n.email} · 📞 {n.phone || '—'}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>
                          🪪 ლიც: {n.licenseNumber} · 📅 გამოცდ: {n.experienceYears} წ.
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>
                          📍 {n.districts || n.district || '—'}
                        </div>
                        {n.services && (
                          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {n.services.split(',').map(s => (
                              <span key={s} style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: 12 }}>
                                {s.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 6 }}>
                          🕐 დარეგ: {new Date(n.createdAt).toLocaleString('ka-GE')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => verifyNurse(n.id)}>
                          ✅ დამტკიცება
                        </button>
                        <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
                          onClick={() => rejectNurse(n.id, n.name)}>
                          ❌ უარყოფა
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── PENDING ORDERS ── */}
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
              📋 მოუნიჭებელი შეკვეთები
            </h2>
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

        {/* NURSE EDIT MODAL */}
        {editingNurse && (
          <div className="admin-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="card admin-modal" style={{ width: '100%', maxWidth: 580, padding: 28, maxHeight: '92vh', overflowY: 'auto' }}>
              <h2 style={{ marginBottom: 20 }}>✏️ ექთნის რედაქტირება — {nurseForm.name}</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>სახელი გვარი</label>
                  <input className="form-input" value={nurseForm.name} onChange={e => setNurseForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>ელ. ფოსტა</label>
                  <input className="form-input" type="email" value={nurseForm.email} onChange={e => setNurseForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>ტელეფონი</label>
                  <input className="form-input" value={nurseForm.phone} onChange={e => setNurseForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>ლიცენზიის ნომერი</label>
                  <input className="form-input" value={nurseForm.licenseNumber} onChange={e => setNurseForm(f => ({ ...f, licenseNumber: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>გამოცდილება (წ.)</label>
                  <input className="form-input" type="number" min={0} value={nurseForm.experienceYears} onChange={e => setNurseForm(f => ({ ...f, experienceYears: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>სტატუსი</label>
                  <select className="form-input" value={nurseForm.status} onChange={e => setNurseForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="Active">🟢 აქტიური</option>
                    <option value="Busy">🟡 დაკავებული</option>
                    <option value="Vacation">🔴 შვებულება</option>
                    <option value="Offline">⚫ ოფლაინ</option>
                    <option value="Blocked">🚫 დაბლოკილი</option>
                    <option value="Pending">⏳ მოლოდინი</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 14 }}>
                <label>სამუშაო უბნები <span style={{ fontSize: 12, color: 'var(--gray)' }}>(მონიშნე)</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {ALL_DISTRICTS.map(d => {
                    const selected = (nurseForm.districts || '').split(',').map(x => x.trim()).includes(d);
                    return (
                      <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                        background: selected ? '#eff6ff' : '#f8fafc', border: `1px solid ${selected ? 'var(--primary)' : '#e2e8f0'}`,
                        borderRadius: 8, padding: '4px 10px', fontSize: 13 }}>
                        <input type="checkbox" checked={selected} onChange={() => {
                          const cur = (nurseForm.districts || '').split(',').map(x => x.trim()).filter(Boolean);
                          const next = selected ? cur.filter(x => x !== d) : [...cur, d];
                          setNurseForm(f => ({ ...f, districts: next.join(',') }));
                        }} style={{ marginRight: 2 }} />
                        📍{d}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label>მომსახურებები <span style={{ fontSize: 12, color: 'var(--gray)' }}>(მძიმით გამოყოფილი)</span></label>
                <textarea className="form-input" rows={2} value={nurseForm.services}
                  onChange={e => setNurseForm(f => ({ ...f, services: e.target.value }))}
                  style={{ resize: 'vertical' }} />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={nurseForm.isVerified}
                    onChange={e => setNurseForm(f => ({ ...f, isVerified: e.target.checked }))} />
                  ✅ ვერიფიცირებული (IsVerified)
                </label>
              </div>

              <div className="form-group">
                <label>🔑 ახალი პაროლი <span style={{ fontSize: 12, color: 'var(--gray)' }}>(დატოვე ცარიელი თუ არ ცვლი)</span></label>
                <input className="form-input" type="password" placeholder="••••••••" value={nurseForm.newPassword}
                  onChange={e => setNurseForm(f => ({ ...f, newPassword: e.target.value }))}
                  autoComplete="new-password" />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveNurseEdit} disabled={nurseFormSaving}>
                  {nurseFormSaving ? '⏳...' : '✅ შენახვა'}
                </button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditingNurse(null)}>
                  გაუქმება
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NURSES */}
        {activeTab === 'nurses' && (
          <div className="fade-in">
            <h1 className="page-title">ექთნების მართვა</h1>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>ექთანი</th><th>სტატუსი</th><th className="col-hide-mobile">უბანი</th><th className="col-hide-mobile">შეკვ.</th><th className="col-hide-mobile">შემოსავ.</th><th className="col-hide-mobile">რეიტ.</th><th>მოქმ.</th></tr></thead>
                <tbody>
                  {nurses.map(n => (
                    <tr key={n.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>👩‍⚕️</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{n.user?.name}</div>
                            {!n.isVerified && <span style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 700 }}>⚠️ ვერიფ.</span>}
                            {n.isPremium && <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700 }}> ⭐</span>}
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${NURSE_STATUS[n.status]?.cls || 'badge-offline'}`} style={{ fontSize: 11 }}>{NURSE_STATUS[n.status]?.label || n.status}</span></td>
                      <td className="col-hide-mobile">{n.district}</td>
                      <td className="col-hide-mobile">{n.totalOrders}</td>
                      <td className="col-hide-mobile" style={{ fontWeight: 700, color: 'var(--secondary)' }}>{n.realEarnings ?? '—'}₾</td>
                      <td className="col-hide-mobile">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            className="btn btn-sm"
                            style={{ padding: '2px 6px', fontSize: 13, lineHeight: 1, background: '#fee2e2', color: '#dc2626', border: 'none' }}
                            onClick={() => adjustNurseRating(n.id, -0.5)}
                            title="რეიტინგის შემცირება"
                          >−</button>
                          <span style={{ minWidth: 36, textAlign: 'center', fontSize: 12 }}>
                            {n.rating ? `⭐ ${n.rating.toFixed(1)}` : '—'}
                          </span>
                          <button
                            className="btn btn-sm"
                            style={{ padding: '2px 6px', fontSize: 13, lineHeight: 1, background: '#dcfce7', color: '#15803d', border: 'none' }}
                            onClick={() => adjustNurseRating(n.id, 0.5)}
                            title="რეიტინგის გაზრდა"
                          >+</button>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openNurseEdit(n)}>✏️</button>
                          {!n.isVerified && <button className="btn btn-secondary btn-sm" onClick={() => verifyNurse(n.id)}>✅</button>}
                          {n.status !== 'Blocked' && n.isVerified && (
                            <button className="btn btn-danger btn-sm" onClick={() => blockNurse(n.id)}>🚫</button>
                          )}
                          {n.status === 'Blocked' && (
                            <button className="btn btn-sm" style={{ background: '#dcfce7', color: '#15803d', border: 'none' }} onClick={() => unblockNurse(n.id)}>🔓</button>
                          )}
                          <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }} onClick={() => deleteNurse(n.id, n.user?.name || n.name)}>🗑️</button>
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
                <thead><tr><th className="col-hide-mobile">#</th><th>კლიენტი</th><th className="col-hide-mobile">მომსახ.</th><th className="col-hide-mobile">ექთანი</th><th>სტატუსი</th><th>ფასი</th><th className="col-hide-mobile">თარიღი</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td className="col-hide-mobile" style={{ color: 'var(--gray)', fontSize: 13 }}>#{o.id}</td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>
                        {o.customer?.name}
                        <div className="col-show-mobile" style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 400 }}>{o.service?.name}</div>
                      </td>
                      <td className="col-hide-mobile">{o.service?.name}</td>
                      <td className="col-hide-mobile">{o.nurse?.user?.name || '—'}</td>
                      <td>
                        <span style={{ background: STATUS_COLORS[o.status]?.bg, color: STATUS_COLORS[o.status]?.color, padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {STATUS_COLORS[o.status]?.label || o.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{o.totalPrice}₾</td>
                      <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--gray)' }}>{new Date(o.createdAt).toLocaleDateString('ka-GE')}</td>
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
              <div className="admin-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card admin-modal" style={{ width: '100%', maxWidth: 520, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
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
            <h1 className="page-title">⭐ შეფასებები</h1>

            {ratings.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--gray)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>შეფასება ჯერ არ არის</div>
              </div>
            ) : (() => {
              // Group by nurse
              const byNurse = {};
              ratings.forEach(r => {
                if (!byNurse[r.nurseName]) byNurse[r.nurseName] = [];
                byNurse[r.nurseName].push(r);
              });

              return Object.entries(byNurse).map(([nurseName, nurseRatings]) => {
                const avg = (nurseRatings.reduce((s, r) => s + r.stars, 0) / nurseRatings.length).toFixed(1);
                return (
                  <div key={nurseName} className="card" style={{ marginBottom: 20 }}>
                    {/* Nurse header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: 36 }}>👩‍⚕️</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 17 }}>{nurseName}</div>
                        <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>
                          {nurseRatings.length} შეფასება
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b' }}>{avg}</div>
                        <div style={{ color: '#f59e0b', fontSize: 16, lineHeight: 1 }}>
                          {'★'.repeat(Math.round(Number(avg)))}
                          <span style={{ color: '#e2e8f0' }}>{'★'.repeat(5 - Math.round(Number(avg)))}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--gray)' }}>საშუალო</div>
                      </div>
                    </div>

                    {/* Individual ratings */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {nurseRatings.map(r => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 10 }}>
                          <div style={{ minWidth: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                            {r.customerName?.[0] || '?'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: 14 }}>{r.customerName}</span>
                              <span style={{ color: '#f59e0b', fontSize: 15 }}>{'★'.repeat(r.stars)}<span style={{ color: '#e2e8f0' }}>{'★'.repeat(5 - r.stars)}</span></span>
                              <span style={{ fontSize: 12, color: 'var(--gray)' }}>{r.stars}/5</span>
                              <span style={{ fontSize: 11, color: 'var(--gray)', marginLeft: 'auto' }}>#{r.orderId} · {new Date(r.createdAt).toLocaleDateString('ka-GE')}</span>
                            </div>
                            {r.comment && (
                              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                                "{r.comment}"
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
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
