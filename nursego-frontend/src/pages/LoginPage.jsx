import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { authService } from '../services/auth.service';
import NurseAgreement from '../components/NurseAgreement';
import toast from 'react-hot-toast';
import './LoginPage.css';

export default function LoginPage() {
  const [params] = useSearchParams();
  const [isRegister, setIsRegister] = useState(params.get('register') === 'true');

  // sync with URL when navbar buttons change the route without unmounting
  React.useEffect(() => {
    setIsRegister(params.get('register') === 'true');
  }, [params]);
  const [role, setRole] = useState(params.get('role') || 'customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [license, setLicense] = useState('');
  const [districts, setDistricts] = useState([]);
  const [experience, setExperience] = useState(1);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const ALL_DISTRICTS = ['ვაკე','საბურთალო','გლდანი','დიდუბე','ნაძალადევი','ისანი','სამგორი','კრწანისი','დიღომი','ვარკეთილი'];
  const ALL_SERVICES = [
    { icon: '💉', name: 'კუნთში ინექცია' },
    { icon: '🩸', name: 'ვენაში ინექცია' },
    { icon: '🧴', name: 'გადასხმა (IV)' },
    { icon: '🔧', name: 'კათეტერის შეცვლა' },
    { icon: '🩹', name: 'ჭრილობის დამუშავება' },
    { icon: '✂️', name: 'ნაკერის მოხსნა' },
    { icon: '📏', name: 'წნევის გაზომვა' },
    { icon: '🍬', name: 'შაქრის გაზომვა' },
    { icon: '👴', name: 'მოხუცის მოვლა (1 სთ)' },
    { icon: '💊', name: 'მედიკამენტის ჩამოტანა' },
    { icon: '🎥', name: 'ვიდეოკონსულტაცია' },
    { icon: '🚨', name: 'SOS გამოძახება' },
  ];

  const [selectedServices, setSelectedServices] = useState([]);

  const toggleDistrict = (d) => {
    setDistricts(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };

  const toggleService = (s) => {
    setSelectedServices(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const toggleAllServices = () => {
    setSelectedServices(prev =>
      prev.length === ALL_SERVICES.length ? [] : ALL_SERVICES.map(s => s.name)
    );
  };
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1=email, 2=code+newpass
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { login } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let data;
      if (isRegister) {
        if (role === 'nurse') {
          if (districts.length === 0) {
            toast.error('მინიმუმ ერთი უბანი უნდა აირჩიო');
            setLoading(false);
            return;
          }
          if (selectedServices.length === 0) {
            toast.error('მინიმუმ ერთი მომსახურება უნდა აირჩიო');
            setLoading(false);
            return;
          }
          if (!agreedTerms) {
            toast.error('სამომსახურო ხელშეკრულება უნდა დაეთანხმო');
            setLoading(false);
            return;
          }
          data = await authService.registerNurse({
            name, email, password, phone,
            licenseNumber: license,
            districts: districts.join(','),
            experienceYears: Number(experience),
            services: selectedServices.join(','),
          });
        } else {
          data = await authService.register({ name, email, password, phone, role: 'Customer' });
        }
        toast.success('რეგისტრაცია წარმატებულია!');
      } else {
        data = await authService.login(email, password);
        toast.success(`კეთილი იყოს, ${data.user.name}!`);
      }

      // token + user ინახება localStorage-ში
      login({ ...data.user, token: data.token });

      const r = data.user.role?.toLowerCase();
      navigate(r === 'admin' ? '/admin' : r === 'nurse' ? '/nurse/dashboard' : '/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'შეცდომა. სცადე თავიდან.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (resetStep === 1) {
        await authService.forgotPassword(forgotEmail);
        toast.success('კოდი გაიგზავნა! (dev: შეამოწმე console)');
        setResetStep(2);
      } else {
        await authService.resetPassword(forgotEmail, resetCode, newPassword);
        toast.success('პაროლი შეიცვალა! შედი ახლებური პაროლით.');
        setForgotMode(false);
        setResetStep(1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'შეცდომა');
    } finally {
      setLoading(false);
    }
  };

  if (forgotMode) return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">🏥 MyNurse</div>
        <h2 className="login-title">🔑 პაროლის აღდგენა</h2>
        <form className="login-form" onSubmit={handleForgotSubmit}>
          {resetStep === 1 ? (
            <div className="form-group">
              <label>ელ. ფოსტა *</label>
              <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                placeholder="example@email.com" className="form-input" required />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>6-ნიშნა კოდი *</label>
                <input type="text" value={resetCode} onChange={e => setResetCode(e.target.value)}
                  placeholder="123456" className="form-input" required maxLength={6} />
              </div>
              <div className="form-group">
                <label>ახალი პაროლი *</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••" className="form-input" required minLength={6} />
              </div>
            </>
          )}
          <button type="submit" className={`btn btn-primary login-btn ${loading ? 'loading' : ''}`} disabled={loading}>
            {loading ? '⏳...' : resetStep === 1 ? 'კოდის გაგზავნა' : 'პაროლის შეცვლა'}
          </button>
        </form>
        <div className="login-switch">
          <button type="button" onClick={() => { setForgotMode(false); setResetStep(1); }}>← შესვლაზე დაბრუნება</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">🏥 MyNurse</div>
        <h2 className="login-title">{isRegister ? 'რეგისტრაცია' : 'შესვლა'}</h2>

        {isRegister && (
          <div className="role-selector">
            <button className={`role-btn ${role === 'customer' ? 'active' : ''}`} type="button" onClick={() => setRole('customer')}>
              👤 კლიენტი
            </button>
            <button className={`role-btn ${role === 'nurse' ? 'active' : ''}`} type="button" onClick={() => setRole('nurse')}>
              👩‍⚕️ ექთანი
            </button>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="form-group">
                <label>სახელი გვარი *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="მარიამ გიორგაძე" className="form-input" required />
              </div>
              <div className="form-group">
                <label>ტელეფონი {role === 'nurse' && <span style={{color:'var(--danger)'}}>*</span>}</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+995 5XX XXX XXX" className="form-input"
                  required={role === 'nurse'} />
              </div>
            </>
          )}

          <div className="form-group">
            <label>ელ. ფოსტა *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com" className="form-input" required />
          </div>

          <div className="form-group">
            <label>პაროლი *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" className="form-input" required minLength={6} />
          </div>

          {isRegister && role === 'nurse' && (
            <>
              <div className="form-group">
                <label>ლიცენზიის ნომერი *</label>
                <input type="text" value={license} onChange={e => setLicense(e.target.value)}
                  placeholder="NRS-XXXX-XXXX" className="form-input" required />
              </div>
              <div className="form-group">
                <label>სამუშაო უბნები * <span style={{fontSize:12,color:'var(--gray)',fontWeight:400}}>(შეგიძლია რამდენიმე აირჩიო)</span></label>
                <div className="district-checkbox-grid">
                  {ALL_DISTRICTS.map(d => (
                    <label key={d} className={`district-checkbox-item ${districts.includes(d) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={districts.includes(d)} onChange={() => toggleDistrict(d)} />
                      📍 {d}
                    </label>
                  ))}
                </div>
                {districts.length > 0 && (
                  <div style={{fontSize:12,color:'var(--primary)',marginTop:6}}>
                    ✅ არჩეული: {districts.join(', ')}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>
                  მომსახურებები * <span style={{fontSize:12,color:'var(--gray)',fontWeight:400}}>(შეგიძლია რამდენიმე აირჩიო)</span>
                </label>
                <button
                  type="button"
                  className="select-all-btn"
                  onClick={toggleAllServices}
                >
                  {selectedServices.length === ALL_SERVICES.length ? '❌ გაუქმება' : '✅ ყველა'}
                </button>
                <div className="district-checkbox-grid services-checkbox-grid">
                  {ALL_SERVICES.map(s => (
                    <label key={s.name} className={`district-checkbox-item ${selectedServices.includes(s.name) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={selectedServices.includes(s.name)} onChange={() => toggleService(s.name)} />
                      {s.icon} {s.name}
                    </label>
                  ))}
                </div>
                {selectedServices.length > 0 && (
                  <div style={{fontSize:12,color:'var(--primary)',marginTop:6}}>
                    ✅ არჩეული: {selectedServices.length} მომსახურება
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>გამოცდილება (წლები) *</label>
                <input type="number" value={experience} onChange={e => setExperience(e.target.value)}
                  min={0} max={50} className="form-input" required />
              </div>
            </>
          )}

          {isRegister && role === 'nurse' && (
            <NurseAgreement agreed={agreedTerms} onChange={setAgreedTerms} />
          )}

          <button type="submit"
            className={`btn btn-primary login-btn ${loading ? 'loading' : ''}`}
            disabled={loading || (isRegister && role === 'nurse' && !agreedTerms)}>
            {loading ? '⏳ ...' : isRegister ? '✅ რეგისტრაცია' : '→ შესვლა'}
          </button>
        </form>

        <div className="login-switch">
          {isRegister ? (
            <>უკვე გაქვს ანგარიში? <button type="button" onClick={() => setIsRegister(false)}>შესვლა</button></>
          ) : (
            <>ანგარიში არ გაქვს? <button type="button" onClick={() => setIsRegister(true)}>რეგისტრაცია</button></>
          )}
        </div>
        {!isRegister && (
          <div style={{ textAlign:'center', marginTop:10 }}>
            <button type="button" className="login-switch" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray)', fontSize:13 }}
              onClick={() => setForgotMode(true)}>
              დამავიწყდა პაროლი →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
