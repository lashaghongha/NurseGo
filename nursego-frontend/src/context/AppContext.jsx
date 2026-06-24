import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'customer' | 'nurse' | 'admin'
  const [cart, setCart] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nursego_user');
      if (saved) {
        const user = JSON.parse(saved);
        const normalized = { ...user, role: user.role?.toLowerCase() };
        setCurrentUser(normalized);
        setUserRole(normalized.role);
      }
    } catch {
      localStorage.removeItem('nursego_user');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const login = (user) => {
    const normalized = { ...user, role: user.role?.toLowerCase() };
    setCurrentUser(normalized);
    setUserRole(normalized.role);
    localStorage.setItem('nursego_user', JSON.stringify(normalized));
  };

  const logout = () => {
    setCurrentUser(null);
    setUserRole(null);
    localStorage.removeItem('nursego_user');
  };

  const addNotification = (msg, type = 'info') => {
    const n = { id: Date.now(), msg, type };
    setNotifications(prev => [n, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(x => x.id !== n.id)), 4000);
  };

  return (
    <AppContext.Provider value={{
      currentUser, userRole, authLoading, login, logout,
      cart, setCart,
      activeOrders, setActiveOrders,
      notifications, addNotification
    }}>
      {children}
    </AppContext.Provider>
  );
};
