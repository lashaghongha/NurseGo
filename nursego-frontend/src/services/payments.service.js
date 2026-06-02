import api from './api';

export const paymentsService = {
  create:    (orderId)   => api.post('/payments/create', { orderId }).then(r => r.data),
  verifyDev: (orderId)   => api.post(`/payments/verify/${orderId}`).then(r => r.data),
  status:    (orderId)   => api.get(`/payments/status/${orderId}`).then(r => r.data),
};
