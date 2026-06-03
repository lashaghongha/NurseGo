import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { AppProvider, useApp } from './context/AppContext';
import { pushService } from './services/push.service';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import NursesPage from './pages/NursesPage';
import OrderPage from './pages/OrderPage';
import TrackingPage from './pages/TrackingPage';
import AdminPanel from './pages/AdminPanel';
import NurseDashboard from './pages/NurseDashboard';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import VideoConsultPage from './pages/VideoConsultPage';

const ProtectedRoute = ({ children, roles }) => {
  const { currentUser, userRole } = useApp();
  if (!currentUser) return <Navigate to="/login" />;
  if (roles && !roles.includes(userRole)) return <Navigate to="/" />;
  return children;
};

const AppRoutes = () => {
  const { currentUser } = useApp();
  useEffect(() => {
    AOS.init({ duration: 500, once: true, easing: 'ease-out-cubic', offset: 60 });
    pushService.register(); // SW-ის რეგისტრაცია ყოველთვის
  }, []);

  // შესული მომხმარებლისთვის push გამოწერა
  useEffect(() => {
    if (!currentUser) return;
    pushService.isSubscribed().then(subscribed => {
      if (!subscribed) {
        // 3 წამის შემდეგ ვთხოვთ ნებართვას (რომ UX ბუნებრივი იყოს)
        setTimeout(() => pushService.subscribe(), 3000);
      }
    });
  }, [currentUser]);
  return (
  <>
    <Navbar />
    <Routes>
      <Route path="/" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/services" element={<ErrorBoundary><ServicesPage /></ErrorBoundary>} />
      <Route path="/nurses" element={<ErrorBoundary><NursesPage /></ErrorBoundary>} />
      <Route path="/order" element={
        <ProtectedRoute roles={['customer']}>
          <ErrorBoundary><OrderPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/tracking/:orderId" element={
        <ProtectedRoute roles={['customer']}>
          <ErrorBoundary><TrackingPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute roles={['customer','nurse','admin']}>
          <ErrorBoundary><ProfilePage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/nurse/dashboard" element={
        <ProtectedRoute roles={['nurse']}>
          <ErrorBoundary><NurseDashboard /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/video" element={<ErrorBoundary><VideoConsultPage /></ErrorBoundary>} />
      <Route path="/admin" element={
        <ProtectedRoute roles={['admin']}>
          <ErrorBoundary><AdminPanel /></ErrorBoundary>
        </ProtectedRoute>
      } />
      {/* Payment redirect pages */}
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/fail"    element={<PaymentFail />} />
    </Routes>
    <MobileBottomNav />
    <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
  </>
  );
};

function PaymentSuccess() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId');
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>✅</div>
      <h2>გადახდა წარმატებულია!</h2>
      <p style={{ color: '#64748b' }}>შეკვეთა #{orderId} დადასტურებულია</p>
      <a href={`/tracking/${orderId}`} className="btn btn-primary">შეკვეთის თვალყური →</a>
    </div>
  );
}

function PaymentFail() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId');
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>❌</div>
      <h2>გადახდა ვერ მოხდა</h2>
      <p style={{ color: '#64748b' }}>სცადე თავიდან</p>
      <a href={`/tracking/${orderId}`} className="btn btn-outline">← შეკვეთაზე დაბრუნება</a>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AppProvider>
  );
}
