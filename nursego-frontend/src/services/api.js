import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  // Railway cold-start-ს დრო სჭირდება, მაგრამ სამუდამოდ არ ვკიდოთ request-ი
  timeout: 30000,
});

const MAX_RETRIES = 2;

// ყოველ request-ზე token-ი ემატება
api.interceptors.request.use((config) => {
  const user = localStorage.getItem('nursego_user');
  if (user) {
    const { token } = JSON.parse(user);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 → logout; timeout/network → auto-retry (Railway cold-start)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nursego_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // მხოლოდ timeout ან ქსელის შეცდომაზე (პასუხი არ მოსულა) ვცადოთ ხელახლა
    const config = err.config;
    const isRetriable = !err.response && config && (err.code === 'ECONNABORTED' || err.message === 'Network Error');
    if (isRetriable) {
      config._retryCount = config._retryCount || 0;
      if (config._retryCount < MAX_RETRIES) {
        config._retryCount += 1;
        await new Promise(r => setTimeout(r, 1000 * config._retryCount));
        return api(config);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
