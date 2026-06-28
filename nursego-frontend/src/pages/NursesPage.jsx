import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { nursesService } from '../services/nurses.service';
import toast from 'react-hot-toast';
import './NursesPage.css';

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace('/api', '');

function NurseAvatar({ nurse, size = 56 }) {
  if (nurse?.photoUrl) {
    return (
      <img
        src={`${API_BASE}${nurse.photoUrl}`}
        alt={nurse.name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: '2px solid #e2e8f0', flexShrink: 0 }}
        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#eff6ff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, flexShrink: 0 }}>
      👩‍⚕️
    </div>
  );
}

const STATUS_MAP = {
  Active:   { label: '🟢 აქტიური',   cls: 'badge-active' },
  Busy:     { label: '🟡 დაკავებული', cls: 'badge-busy' },
  Vacation: { label: '🔴 შვებულება',  cls: 'badge-vacation' },
  Offline:  { label: '⚫ ოფლაინ',     cls: 'badge-offline' },
  Pending:  { label: '⚫ მოლოდინი',   cls: 'badge-offline' },
};

const DISTRICTS = ['ყველა','ვაკე','საბურთალო','გლდანი','დიდუბე','ნაძალადევი','ისანი','სამგორი','კრწანისი','დიღომი','ვარკეთილი'];

export default function NursesPage() {
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [districtFilter, setDistrictFilter] = useState('ყველა');
  const [search, setSearch] = useState('');
  const [selectedNurse, setSelectedNurse] = useState(null);

  useEffect(() => {
    nursesService.getAll()
      .then(setNurses)
      .catch(() => toast.error('ექთნების ჩატვირთვა ვერ მოხდა'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = nurses.filter(n => {
    const allDistricts = [n.district, ...(n.districts || '').split(',').map(d => d.trim())].filter(Boolean);
    const matchDistrict = districtFilter === 'ყველა' || allDistricts.includes(districtFilter);
    const matchSearch = n.name?.toLowerCase().includes(search.toLowerCase());
    return matchDistrict && matchSearch;
  });

  const renderStars = (rating) => {
    if (!rating) return '☆☆☆☆☆';
    const full = Math.floor(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  };

  return (
    <div className="nurses-page">
      <div className="nurses-hero">
        <div className="container">
          <h1 className="page-title">ჩვენი ექთნები</h1>
          <p className="page-subtitle">სერტიფიცირებული, გამოცდილი, პროფესიონალი</p>
        </div>
      </div>

      <div className="container">
        <div className="nurses-filters">
          <input type="text" placeholder="🔍  ექთნის ძიება..." value={search}
            onChange={e => setSearch(e.target.value)} className="nurse-search" />
          <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} className="filter-select">
            {DISTRICTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="loading-state">⏳ იტვირთება...</div>
        ) : (
          <>
            <div className="nurses-count">{filtered.length} ექთანი</div>
            <div className="nurses-grid">
              {filtered.map((nurse, idx) => (
                <div key={nurse.id} className="nurse-card" onClick={() => setSelectedNurse(nurse)}
                  data-aos="fade-up" data-aos-delay={Math.min(idx * 50, 300)}>
                  <div className="nc-top">
                    <NurseAvatar nurse={nurse} size={56} />
                    <span className={`badge ${STATUS_MAP[nurse.status]?.cls || 'badge-offline'}`}>
                      {STATUS_MAP[nurse.status]?.label || nurse.status}
                    </span>
                  </div>
                  <h3 className="nc-name">{nurse.name}</h3>
                  <div className="nc-license">🪪 {nurse.licenseNumber}</div>
                  <div className="nc-rating">
                    <span className="stars">{renderStars(nurse.rating)}</span>
                    <span className="nc-rating-val">{nurse.rating ? nurse.rating.toFixed(1) : '—'}</span>
                    <span className="nc-reviews">({nurse.totalOrders} შეკვ.)</span>
                  </div>
                  <div className="nc-stats">
                    <div className="nc-stat"><span>🏥</span> {nurse.experienceYears} წ.</div>
                    <div className="nc-stat"><span>📍</span> {(nurse.districts || nurse.district || '').split(',').map(d=>d.trim()).filter(Boolean).join(', ')}</div>
                    {nurse.isPremium && <div className="nc-stat"><span>⭐</span> Premium</div>}
                  </div>
                  <div className="nc-services">
                    {nurse.services?.split(',').map(s => (
                      <span key={s} className="nc-service-tag">{s.trim()}</span>
                    ))}
                  </div>
                  {nurse.status === 'Active' && (
                    <Link to="/order" state={{ nurseId: nurse.id, nurseName: nurse.name }}
                      className="btn btn-primary nc-btn" onClick={e => e.stopPropagation()}>
                      გამოძახება
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedNurse && (
        <div className="modal-overlay" onClick={() => setSelectedNurse(null)}>
          <div className="nurse-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedNurse(null)}>✕</button>
            <div className="modal-top">
              <NurseAvatar nurse={selectedNurse} size={72} />
              <div>
                <h2>{selectedNurse.name}</h2>
                <div className="nc-license">🪪 {selectedNurse.licenseNumber}</div>
                <span className={`badge ${STATUS_MAP[selectedNurse.status]?.cls}`}>
                  {STATUS_MAP[selectedNurse.status]?.label}
                </span>
              </div>
            </div>
            <div className="modal-stats grid-3">
              <div className="mstat"><div className="mstat-val">{selectedNurse.experienceYears}</div><div className="mstat-label">წლის გამოცდ.</div></div>
              <div className="mstat"><div className="mstat-val">{selectedNurse.totalOrders}</div><div className="mstat-label">შეკვეთა</div></div>
              <div className="mstat"><div className="mstat-val">{selectedNurse.rating ? `${selectedNurse.rating.toFixed(1)}⭐` : '—'}</div><div className="mstat-label">რეიტინგი</div></div>
            </div>
            <div className="modal-section"><strong>უბანი:</strong> {(selectedNurse.districts || selectedNurse.district || '—').split(',').map(d=>d.trim()).filter(Boolean).join(', ')}</div>
            <div className="modal-section">
              <strong>მომსახურებები:</strong>
              <div className="nc-services" style={{ marginTop: 8 }}>
                {selectedNurse.services?.split(',').map(s => <span key={s} className="nc-service-tag">{s.trim()}</span>)}
              </div>
            </div>
            {selectedNurse.status === 'Active' && (
              <Link to="/order" state={{ nurseId: selectedNurse.id, nurseName: selectedNurse.name }}
                className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                გამოძახება →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
