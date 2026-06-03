import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export const pushService = {
  isSupported: () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,

  async register() {
    if (!this.isSupported()) return null;
    try {
      return await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      console.warn('SW register failed:', e);
      return null;
    }
  },

  async subscribe() {
    if (!this.isSupported()) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const { data } = await api.get('/push/vapid-public-key');
      const applicationServerKey = urlBase64ToUint8Array(data.publicKey);
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const { endpoint, keys } = sub.toJSON();
      await api.post('/push/subscribe', { endpoint, p256dh: keys.p256dh, auth: keys.auth });
      return true;
    } catch (e) {
      console.warn('Push subscribe failed:', e);
      return false;
    }
  },

  async unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.delete('/push/unsubscribe');
    } catch (e) { console.warn('unsubscribe failed:', e); }
  },

  async isSubscribed() {
    if (!this.isSupported()) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return !!sub && Notification.permission === 'granted';
    } catch { return false; }
  },
};
