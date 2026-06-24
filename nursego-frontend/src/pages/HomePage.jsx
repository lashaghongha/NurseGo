import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { nursesService } from '../services/nurses.service';
import './HomePage.css';

const SERVICES_PREVIEW = [
  { icon: '💉', name: 'კუნთში ინექცია', price: 20, time: '30 წთ' },
  { icon: '🩸', name: 'ვენაში ინექცია', price: 25, time: '30 წთ' },
  { icon: '🧴', name: 'გადასხმა', price: 40, time: '2 სთ' },
  { icon: '🩹', name: 'ჭრილობის დამუშავება', price: 35, time: '45 წთ' },
  { icon: '📏', name: 'წნევის გაზომვა', price: 15, time: '15 წთ' },
  { icon: '👴', name: 'მოხუცის მოვლა', price: 20, time: '1 სთ' },
];

const STATS = [
  { icon: '👩‍⚕️', value: '150+',   label: 'რეგისტრირებული ექთანი' },
  { icon: '✅',    value: '2000+', label: 'შესრულებული შეკვეთა' },
  { icon: '⭐',    value: '4.8',   label: 'საშუალო რეიტინგი' },
  { icon: '⚡',    value: '30 წთ', label: 'საშუალო ჩამოსვლის დრო' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'აირჩიე მომსახურება', desc: 'გადახედე კატალოგს და შეარჩიე სასურველი სამედიცინო მომსახურება.', icon: '🔍' },
  { step: '2', title: 'მიუთითე მისამართი', desc: 'შეიყვანე შენი მისამართი თბილისში. ფასი ავტომატურად დათვლება.', icon: '📍' },
  { step: '3', title: 'გამოიძახე ექთანი', desc: 'დაადასტურე შეკვეთა და ახლობელი ექთანი გამოგიგზავნება.', icon: '📱' },
  { step: '4', title: 'მიიღე მომსახურება', desc: 'ექთანი მოვა სახლში და გაგიწევს პროფესიონალურ მომსახურებას.', icon: '🏥' },
];

const DISTRICTS = ['ვაკე', 'საბურთალო', 'გლდანი', 'დიდუბე', 'ნაძალადევი', 'ისანი', 'სამგორი', 'კრწანისი', 'დიღომი', 'ვარკეთილი'];

export default function HomePage() {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState('');
  const [address, setAddress] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);
  const [featuredNurse, setFeaturedNurse] = useState(null);

  useEffect(() => {
    nursesService.getAll({ status: 'Active' })
      .then(list => { if (list.length > 0) setFeaturedNurse(list[0]); })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedSvc = SERVICES_PREVIEW.find(s => s.name === selectedService);

  const handleSearch = (e) => {
    e.preventDefault();
    navigate('/order', { state: { service: selectedService, address, district: selectedDistrict } });
  };

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="container hero-content">
          <div className="hero-text fade-in">
            <div className="hero-logo-wrap">
              <img src="/citymed-logo.jpg" alt="Citymed" className="hero-logo-img" />
              <div className="hero-logo-name">Citymed</div>
            </div>
            <div className="hero-badge">🇬🇪 საქართველოში პირველი</div>
            <h1 className="hero-title">
              გამოიძახე ექთანი<br />
              <span className="gradient-text">სახლში 30 წუთში</span>
            </h1>
            <p className="hero-subtitle">
              პროფესიონალი ექთნები თქვენს სახლში — ინექციები, გადასხმები,
              ჭრილობის მოვლა, მოხუცების პატრონაჟი და სხვა.
            </p>
            <form className="hero-search" onSubmit={handleSearch}>
              {/* Custom Service Dropdown */}
              <div className="svc-dropdown" ref={dropRef}>
                <button
                  type="button"
                  className={`svc-trigger ${dropOpen ? 'open' : ''} ${selectedSvc ? 'has-value' : ''}`}
                  onClick={() => setDropOpen(o => !o)}
                >
                  <span className="svc-trigger-inner">
                    {selectedSvc
                      ? <><span className="svc-trigger-icon">{selectedSvc.icon}</span><span className="svc-trigger-name">{selectedSvc.name}</span><span className="svc-trigger-price">{selectedSvc.price}₾</span></>
                      : <><span className="svc-trigger-placeholder">💊 მომსახურება...</span></>
                    }
                  </span>
                  <span className="svc-chevron">{dropOpen ? '▲' : '▼'}</span>
                </button>
                {dropOpen && (
                  <div className="svc-menu">
                    <button
                      type="button"
                      className={`svc-option ${!selectedService ? 'selected' : ''}`}
                      onClick={() => { setSelectedService(''); setDropOpen(false); }}
                    >
                      <span className="svc-opt-icon">🏥</span>
                      <span className="svc-opt-info">
                        <span className="svc-opt-name">ნებისმიერი მომსახურება</span>
                      </span>
                    </button>
                    {SERVICES_PREVIEW.map(s => (
                      <button
                        key={s.name}
                        type="button"
                        className={`svc-option ${selectedService === s.name ? 'selected' : ''}`}
                        onClick={() => { setSelectedService(s.name); setDropOpen(false); }}
                      >
                        <span className="svc-opt-icon">{s.icon}</span>
                        <span className="svc-opt-info">
                          <span className="svc-opt-name">{s.name}</span>
                          <span className="svc-opt-meta">⏱ {s.time}</span>
                        </span>
                        <span className="svc-opt-price">{s.price}₾</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder="📍 მისამართი, თბილისი..."
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="btn btn-primary search-btn">
                გამოძახება →
              </button>
            </form>
            <div className="hero-tags">
              {DISTRICTS.slice(0, 5).map(d => (
                <button
                  key={d}
                  type="button"
                  className={`district-tag ${selectedDistrict === d ? 'active' : ''}`}
                  onClick={() => setSelectedDistrict(prev => prev === d ? '' : d)}
                >{d}</button>
              ))}
              <Link to="/services" className="district-tag">და სხვა...</Link>
            </div>
          </div>
          <div className="hero-visual fade-in">
            <div className="hero-card">
              {featuredNurse ? (
                <>
                  <div className="hcard-header">
                    <div className="hcard-avatar">
                      {featuredNurse.photoUrl
                        ? <img src={featuredNurse.photoUrl} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                        : '👩‍⚕️'}
                    </div>
                    <div>
                      <div className="hcard-name">{featuredNurse.name}</div>
                      <div className="hcard-sub">სერტიფიცირებული ექთანი</div>
                    </div>
                    <span className="badge badge-active">
                      <span className="status-dot dot-active" /> აქტიური
                    </span>
                  </div>
                  <div className="hcard-stats">
                    <div className="hcard-stat"><span>⭐</span> {featuredNurse.rating > 0 ? featuredNurse.rating.toFixed(1) : 'ახალი'}</div>
                    <div className="hcard-stat"><span>📋</span> {featuredNurse.totalOrders} შეკვეთა</div>
                    <div className="hcard-stat"><span>📍</span> {featuredNurse.district || (featuredNurse.districts || '').split(',')[0]}</div>
                  </div>
                  {featuredNurse.services && (
                    <div className="hcard-services">
                      {featuredNurse.services.split(',').slice(0, 3).map(s => (
                        <span key={s} className="service-chip">{s.trim()}</span>
                      ))}
                    </div>
                  )}
                  <div className="tracking-preview">
                    <div className="track-dot pulse" />
                    <span>ხელმისაწვდომია ახლავე</span>
                    <div className="track-bar"><div className="track-fill" /></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="hcard-header">
                    <div className="hcard-avatar">👩‍⚕️</div>
                    <div>
                      <div className="hcard-name">ექთნები ემზადებიან</div>
                      <div className="hcard-sub">მალე დარეგისტრირდებიან</div>
                    </div>
                    <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', fontSize: 12 }}>
                      მალე
                    </span>
                  </div>
                  <div className="hcard-services">
                    <span className="service-chip">💉 ინექცია</span>
                    <span className="service-chip">🧴 გადასხმა</span>
                    <span className="service-chip">🩹 ჭრილობა</span>
                  </div>
                  <div className="tracking-preview">
                    <div className="track-dot" style={{ background: '#94a3b8' }} />
                    <span>ახლა დარეგისტრირდი ექთნად</span>
                    <div className="track-bar"><div className="track-fill" style={{ width: '30%', background: '#94a3b8' }} /></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-bar">
        <div className="container stats-inner">
          {STATS.map((s, i) => (
            <div key={i} className="stat-item">
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
              {i < STATS.length - 1 && <div className="stat-divider" />}
            </div>
          ))}
        </div>
      </section>

      {/* Services Preview */}
      <section className="section services-section">
        <div className="container">
          <h2 className="section-title" data-aos="fade-up">მომსახურებები</h2>
          <p className="section-sub" data-aos="fade-up" data-aos-delay="50">სახლში გამოძახებადი სამედიცინო მომსახურებების სრული სია</p>
          <div className="grid-3">
            {SERVICES_PREVIEW.map((s, i) => (
              <Link to="/order" state={{ service: s.name }} key={i} className="service-card"
                data-aos="fade-up" data-aos-delay={i * 60}>
                <div className="sc-icon">{s.icon}</div>
                <div className="sc-info">
                  <div className="sc-name">{s.name}</div>
                  <div className="sc-meta">⏱ {s.time}</div>
                </div>
                <div className="sc-price">{s.price}₾</div>
              </Link>
            ))}
          </div>
          <div className="center-btn" data-aos="fade-up">
            <Link to="/services" className="btn btn-outline">ყველა მომსახურება →</Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section how-section">
        <div className="container">
          <h2 className="section-title" data-aos="fade-up">როგორ მუშაობს?</h2>
          <p className="section-sub" data-aos="fade-up" data-aos-delay="50">4 მარტივი ნაბიჯი პროფესიონალი ექთნის გამოსაძახებლად</p>
          <div className="grid-4">
            {HOW_IT_WORKS.map((h, i) => (
              <div key={i} className="how-card" data-aos="fade-up" data-aos-delay={i * 80}>
                <div className="how-icon">{h.icon}</div>
                <div className="how-step">ნაბიჯი {h.step}</div>
                <div className="how-title">{h.title}</div>
                <div className="how-desc">{h.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Districts */}
      <section className="section districts-section">
        <div className="container">
          <h2 className="section-title" data-aos="fade-up">სერვისი ხელმისაწვდომია</h2>
          <p className="section-sub" data-aos="fade-up" data-aos-delay="50">თბილისის ყველა ძირითად უბანში</p>
          <div className="districts-grid">
            {DISTRICTS.map((d, i) => (
              <div key={i} className="district-card" data-aos="zoom-in" data-aos-delay={i * 30}>
                <span className="district-icon">📍</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="container cta-inner">
          <div className="cta-text">
            <h2>ხართ სამედიცინო პერსონალი?</h2>
            <p>შემოგვიერთდით და მართეთ თქვენი დრო და შემოსავალი.</p>
          </div>
          <Link to="/login?register=true&role=nurse" className="btn btn-primary cta-btn">
            დარეგისტრირდი ექთნად →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <img src="/citymed-logo.jpg" alt="Citymed" style={{height:32,width:32,objectFit:'contain',borderRadius:6}} />
              <span style={{fontWeight:800,fontSize:18}}>Citymed</span>
            </div>
            <p>სახლში სამედიცინო მომსახურება</p>
          </div>
          <div className="footer-links">
            <Link to="/services">მომსახურება</Link>
            <Link to="/nurses">ექთნები</Link>
            <Link to="/login">შესვლა</Link>
          </div>
          <div className="footer-copy">© 2025 Citymed Georgia</div>
        </div>
      </footer>
    </div>
  );
}
