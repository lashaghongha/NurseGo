import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// ყოველ request-ზე token-ი ემატება
api.interceptors.request.use((config) => {
  const user = localStorage.getItem('nursego_user');
  if (user) {
    const { token } = JSON.parse(user);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 → logout
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nursego_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
