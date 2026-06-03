import api from './api';

export const nursesService = {
  getAll: (params) =>
    api.get('/nurses', { params }).then(r => r.data),

  getById: (id) =>
    api.get(`/nurses/${id}`).then(r => r.data),

  updateStatus: (id, status) =>
    api.put(`/nurses/${id}/status`, { status }).then(r => r.data),

  updateDistricts: (id, districts) =>
    api.put(`/nurses/${id}/districts`, { districts }).then(r => r.data),

  updateServices: (id, services) =>
    api.put(`/nurses/${id}/services`, { services }).then(r => r.data),

  updatePhone: (phone) =>
    api.put('/nurses/me/phone', { phone }).then(r => r.data),

  updateLocation: (id, lat, lng) =>
    api.put(`/nurses/${id}/location`, { lat, lng }).then(r => r.data),

  getMe: () =>
    api.get('/nurses/me').then(r => r.data),

  uploadPhoto: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/nurses/me/photo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};
