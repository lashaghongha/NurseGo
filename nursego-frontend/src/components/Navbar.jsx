import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Navbar.css';

export default function Navbar() {
  const { currentUser, userRole, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🏥</span>
          <span className="brand-name">NurseGo</span>
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
