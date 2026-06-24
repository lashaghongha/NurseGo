import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { signalRService } from '../services/signalr.service';
import { pushService } from '../services/push.service';
import './Navbar.css';

const STATUS_GE = {
  Assigned: 'ექთანი დაინიშნა',
  EnRoute: 'ექთანი გზაშია',
  InProgress: 'მომსახურება დაიწყო',
  Completed: 'მომსახურება დასრულდა',
  Cancelled: 'შეკვეთა გაუქმდა',
};

export default function Navbar() {
  const { currentUser, userRole, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const notifRef = useRef(null);
  const unread = notifs.filter(n => !n.read).length;

  // Remove any previously saved dark theme
  useEffect(() => {
    localStorage.removeItem('theme');
    document.documentElement.removeAttribute('data-theme');
  }, []);

  // push სტატუსის შემოწმება
  useEffect(() => {
    if (currentUser) pushService.isSubscribed().then(setPushEnabled);
  }, [currentUser]);

  const togglePush = async () => {
    if (pushEnabled) {
      await pushService.unsubscribe();
      setPushEnabled(false);
    } else {
      const ok = await pushService.subscribe();
      setPushEnabled(ok);
    }
  };

  // SignalR — შეტყობინებების მიღება
  useEffect(() => {
    if (!currentUser) return;
    signalRService.connect().catch(() => {});

    const handleStatus = (status) => {
      const text = STATUS_GE[status] || status;
      setNotifs(prev => [{ id: Date.now(), text, time: new Date(), read: false }, ...prev.slice(0, 19)]);
    };
    const handleNew = () => {
      if (userRole === 'nurse') {
        setNotifs(prev => [{ id: Date.now(), text: 'ახალი შეკვეთა!', time: new Date(), read: false }, ...prev.slice(0, 19)]);
      }
    };
    signalRService.on('StatusChanged', handleStatus);
    signalRService.on('NewOrder', handleNew);
    return () => {
      signalRService.off('StatusChanged', handleStatus);
      signalRService.off('NewOrder', handleNew);
    };
  }, [currentUser, userRole]);

  // დახურვა outside click-ზე
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <img src="/citymed-logo.jpg" alt="Citymed" className="brand-logo" />
          <span className="brand-name">Citymed</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>🏠 მთავარი</Link>
          <Link to="/services" className={`nav-link ${isActive('/services') ? 'active' : ''}`}>💊 მომსახურება</Link>
          <Link to="/nurses" className={`nav-link ${isActive('/nurses') ? 'active' : ''}`}>👩‍⚕️ ექთნები</Link>
          <Link to="/video" className={`nav-link ${isActive('/video') ? 'active' : ''}`}>🎥 ვიდეო</Link>
          {userRole === 'customer' && (
            <Link to="/order" className={`nav-link ${isActive('/order') ? 'active' : ''}`}>📞 გამოძახება</Link>
          )}
          {userRole === 'nurse' && (
            <Link to="/nurse/dashboard" className={`nav-link ${isActive('/nurse/dashboard') ? 'active' : ''}`}>🩺 ჩემი პანელი</Link>
          )}
          {userRole === 'admin' && (
            <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>⚙️ ადმინი</Link>
          )}
          {currentUser ? (
            <>
              <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>👤 {currentUser.name}</Link>
              <button className="nav-link" style={{ background: 'none', textAlign: 'left', color: 'var(--danger)' }} onClick={handleLogout}>🚪 გასვლა</button>
            </>
          ) : (
            <Link to="/login" className={`nav-link ${isActive('/login') ? 'active' : ''}`}>🔑 შესვლა / რეგისტრაცია</Link>
          )}
        </div>

        <div className="navbar-actions">
          {currentUser ? (
            <div className="user-menu">
              {/* შეტყობინებების ზარი */}
              <div className="notif-wrap" ref={notifRef}>
                <button className="notif-bell" onClick={() => { setNotifOpen(o => !o); setNotifs(prev => prev.map(n => ({...n, read:true}))); }}>
                  🔔
                  {unread > 0 && <span className="notif-badge">{unread}</span>}
                </button>
                {notifOpen && (
                  <div className="notif-dropdown">
                    <div className="notif-header">შეტყობინებები</div>
                    {notifs.length === 0 ? (
                      <div className="notif-empty">შეტყობინება არ არის</div>
                    ) : notifs.map(n => (
                      <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                        <span className="notif-text">{n.text}</span>
                        <span className="notif-time">{new Date(n.time).toLocaleTimeString('ka-GE', {hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                    ))}
                    {notifs.length > 0 && (
                      <button className="notif-clear" onClick={() => setNotifs([])}>გასუფთავება</button>
                    )}
                    {pushService.isSupported() && (
                      <button className="notif-push-toggle" onClick={togglePush}>
                        {pushEnabled ? '🔕 Push გამორთვა' : '🔔 Push ჩართვა'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <Link to="/profile" className="user-avatar">
                <div className="avatar-circle">{currentUser.name?.charAt(0)}</div>
                <span>{currentUser.name}</span>
              </Link>
              <button className="btn btn-outline btn-sm" onClick={handleLogout}>გასვლა</button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-outline">შესვლა</Link>
              <Link to="/login?register=true" className="btn btn-primary">რეგისტრაცია</Link>
            </div>
          )}
        </div>

        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </button>
      </div>
    </nav>
  );
}
