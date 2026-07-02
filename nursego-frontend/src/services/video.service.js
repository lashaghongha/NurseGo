import api from './api';

export const videoService = {
  getToken: (channel, uid = 0) =>
    api.get('/video/token', { params: { channel, uid } }).then(r => r.data),

  createRoom: (nurseId) =>
    api.post('/video/room', { nurseId }).then(r => r.data),

  submitRating: (data) =>
    api.post('/ratings', data).then(r => r.data),

  isOrderRated: (orderId) =>
    api.get(`/ratings/order/${orderId}`).then(r => r.data?.rated === true).catch(() => false),
};
