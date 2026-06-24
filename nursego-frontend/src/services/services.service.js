import api from './api';

export const servicesService = {
  getAll: () =>
    api.get('/services').then(r => r.data),

  getAllForAdmin: () =>
    api.get('/services/all').then(r => r.data),

  create: (data) =>
    api.post('/services', data).then(r => r.data),

  update: (id, data) =>
    api.put(`/services/${id}`, data).then(r => r.data),

  updatePrice: (id, price) =>
    api.put(`/services/${id}/price`, { price }).then(r => r.data),

  delete: (id) =>
    api.delete(`/services/${id}`).then(r => r.data),

  restore: (id) =>
    api.put(`/services/${id}/restore`).then(r => r.data),
};
