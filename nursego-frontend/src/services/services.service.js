import api from './api';

export const servicesService = {
  getAll: () =>
    api.get('/services').then(r => r.data),

  updatePrice: (id, price) =>
    api.put(`/services/${id}/price`, { price }).then(r => r.data),
};
