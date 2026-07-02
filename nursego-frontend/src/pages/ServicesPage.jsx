import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { servicesService } from '../services/services.service';
import { SkeletonGrid } from '../components/Skeleton';
import toast from 'react-hot-toast';
import './ServicesPage.css';

const CATEGORIES = ['ყველა', 'ინექცია', 'გადასხმა', 'მოვლა', 'გაზომვა', 'პატრონაჟი', 'დამატებითი', 'სასწრაფო'];

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ყველა');
  const [search, setSearch] = useState('');

  const loadServices = () => {
    setLoading(true);
    setLoadError(false);
    servicesService.getAll()
      .then(setServices)
      .catch(() => {
        setLoadError(true);
        toast.error('მომსახურებების ჩატვირთვა ვერ მოხდა');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadServices(); }, []);

  const filtered = services.filter(s => {
    const matchCat = activeCategory === 'ყველა' || s.category === activeCategory;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="services-page">
      <div className="services-hero">
        <div className="container">
          <h1 className="page-title">მომსახურებების კატალოგი</h1>
          <p className="page-subtitle">ყველა სამედიცინო მომსახურება სახლში გამოძახებით.</p>
          <input type="text" className="service-search" placeholder="🔍  მომსახურების ძიება..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="container">
        <div className="category-tabs">
          {CATEGORIES.map(cat => (
            <button key={cat} className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonGrid count={6} />
        ) : loadError ? (
          <div className="services-error">
            <p>მომსახურებების ჩატვირთვა ვერ მოხდა.</p>
            <button className="btn btn-primary" onClick={loadServices}>ხელახლა ცდა</button>
          </div>
        ) : (
          <>
            <div className="services-count">{filtered.length} მომსახურება</div>
            <div className="services-grid">
              {filtered.map(s => (
                <div key={s.id} className="service-detail-card">
                  <div className="sdc-header">
                    <div className="sdc-icon">{s.icon}</div>
                    <div className="sdc-category">{s.category}</div>
                  </div>
                  <h3 className="sdc-name">{s.name}</h3>
                  <div className="sdc-footer">
                    <div className="sdc-meta">
                      <span className="sdc-time">⏱ {s.durationEstimate}</span>
                    </div>
                    <div className="sdc-price-row">
                      <span className="sdc-price">{s.price}₾</span>
                      <Link to="/order" state={{ serviceId: s.id, serviceName: s.name }}
                        className="btn btn-primary btn-sm">შეკვეთა</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="price-note container">
        <div className="note-card">
          <span>💡</span>
          <div><strong>ფასების შესახებ:</strong> გადახდა ხდება ადგილზე — ნაღდით ან ბარათით.</div>
        </div>
      </div>
    </div>
  );
}
