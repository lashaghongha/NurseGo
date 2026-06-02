import api from './api';

export const adminService = {
  getStats: () =>
    api.get('/admin/stats').then(r => r.data),

  getAllNurses: () =>
    api.get('/admin/nurses').then(r => r.data),

  verifyNurse: (id) =>
    api.post(`/admin/nurses/${id}/verify`).then(r => r.data),

  blockNurse: (id) =>
    api.post(`/admin/nurses/${id}/block`).then(r => r.data),

  getAllOrders: (page = 1) =>
    api.get('/admin/orders', { params: { page } }).then(r => r.data),

  getMonthlyRevenue: () =>
    api.get('/admin/revenue/monthly').then(r => r.data),

  getPendingOrders: () =>
    api.get('/admin/orders/pending').then(r => r.data),

  assignNurse: (orderId, nurseId) =>
    api.put(`/orders/${orderId}/assign/${nurseId}`).then(r => r.data),
};
