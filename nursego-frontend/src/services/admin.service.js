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

  unblockNurse: (id) =>
    api.post(`/admin/nurses/${id}/unblock`).then(r => r.data),

  deleteNurse: (id) =>
    api.delete(`/admin/nurses/${id}`).then(r => r.data),

  getAllOrders: (page = 1) =>
    api.get('/admin/orders', { params: { page } }).then(r => r.data),

  getMonthlyRevenue: () =>
    api.get('/admin/revenue/monthly').then(r => r.data),

  getPendingOrders: () =>
    api.get('/admin/orders/pending').then(r => r.data),

  getPendingNurses: () =>
    api.get('/admin/nurses/pending').then(r => r.data),

  rejectNurse: (id) =>
    api.delete(`/admin/nurses/${id}`).then(r => r.data),

  updateNurse: (id, data) =>
    api.put(`/admin/nurses/${id}`, data).then(r => r.data),

  assignNurse: (orderId, nurseId) =>
    api.put(`/orders/${orderId}/assign/${nurseId}`).then(r => r.data),

  getDistrictPrices: () =>
    api.get('/admin/district-prices').then(r => r.data),

  updateDistrictPrice: (district, surcharge) =>
    api.put(`/admin/district-prices/${encodeURIComponent(district)}`, { surcharge }).then(r => r.data),

  updateAllDistrictPrices: (items) =>
    api.put('/admin/district-prices', items).then(r => r.data),
};
