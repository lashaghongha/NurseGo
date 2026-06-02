import api from './api';

export const ordersService = {
  create: (data) =>
    api.post('/orders', data).then(r => r.data),

  getMyOrders: () =>
    api.get('/orders/my').then(r => r.data),

  getById: (id) =>
    api.get(`/orders/${id}`).then(r => r.data),

  updateStatus: (id, status) =>
    api.put(`/orders/${id}/status`, { status }).then(r => r.data),

  assignNurse: (orderId, nurseId) =>
    api.put(`/orders/${orderId}/assign/${nurseId}`).then(r => r.data),

  cancel: (id, reason = '') =>
    api.post(`/orders/${id}/cancel`, { reason }).then(r => r.data),

  accept: (id) =>
    api.post(`/orders/${id}/accept`).then(r => r.data),

  getAvailable: () =>
    api.get('/orders/available').then(r => r.data),
};
