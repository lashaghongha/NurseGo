// Browser Push Notifications — ექთნისთვის
// ServiceWorker-ის გარეშე — მხოლოდ Notification API (უფრო მარტივი)

export const pushService = {
  // ნებართვა + subscription
  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  isSupported() {
    return 'Notification' in window;
  },

  isGranted() {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  },

  // ახალი შეკვეთის შეტყობინება ექთანს
  notifyNewOrder(data) {
    if (!this.isGranted()) return;
    const n = new Notification('🆕 ახალი შეკვეთა — NurseGo', {
      body: `${data.service} • ${data.district}${data.isOtherDistrict ? ' (სხვა უბანი)' : ''}\n💰 ${data.totalPrice}₾`,
      icon: '/favicon.ico',
      requireInteraction: true,
      tag: `order-${data.orderId}`,
    });
    n.onclick = () => { window.focus(); n.close(); };
    // 30 წამში ავტო-დახურვა
    setTimeout(() => n.close(), 30000);
  },

  // შეკვეთა გაუქმდა
  notifyOrderCancelled(orderId) {
    if (!this.isGranted()) return;
    const n = new Notification('❌ შეკვეთა გაუქმდა — NurseGo', {
      body: `შეკვეთა #${orderId} კლიენტმა გააუქმა`,
      icon: '/favicon.ico',
      tag: `cancel-${orderId}`,
    });
    setTimeout(() => n.close(), 10000);
  },
};
