import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function MobileBottomNav() {
  const { currentUser, userRole } = useApp();
  const loc = useLocation();
  const p = loc.pathname;

  return (
    <nav className="mobile-bottom-nav">
      <Link to="/" className={`mbn-item ${p === '/' ? 'active' : ''}`}>
        <span className="mbn-icon">🏠</span>
        <span>მთავარი</span>
      </Link>

      <Link to="/services" className={`mbn-item ${p === '/services' ? 'active' : ''}`}>
        <span className="mbn-icon">💊</span>
        <span>მომსახურება</span>
      </Link>

      {userRole === 'customer' && (
        <Link to="/order" className={`mbn-item mbn-cta ${p === '/order' ? 'active' : ''}`}>
          <span className="mbn-icon">📞</span>
          <span>გამოძახება</span>
        </Link>
      )}
      {userRole === 'nurse' && (
        <Link to="/nurse/dashboard" className={`mbn-item mbn-cta ${p === '/nurse/dashboard' ? 'active' : ''}`}>
          <span className="mbn-icon">🩺</span>
          <span>პანელი</span>
        </Link>
      )}
      {!currentUser && (
        <Link to="/order" className="mbn-item mbn-cta">
          <span className="mbn-icon">📞</span>
          <span>გამოძახება</span>
        </Link>
      )}

      <Link to="/nurses" className={`mbn-item ${p === '/nurses' ? 'active' : ''}`}>
        <span className="mbn-icon">👩‍⚕️</span>
        <span>ექთნები</span>
      </Link>

      {currentUser ? (
        <Link to="/profile" className={`mbn-item ${p === '/profile' ? 'active' : ''}`}>
          <span className="mbn-icon">👤</span>
          <span>პროფილი</span>
        </Link>
      ) : (
        <Link to="/login" className={`mbn-item ${p === '/login' ? 'active' : ''}`}>
          <span className="mbn-icon">🔑</span>
          <span>შესვლა</span>
        </Link>
      )}
    </nav>
  );
}
