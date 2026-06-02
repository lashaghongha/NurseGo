import api from './api';

export const chatService = {
  getMessages: (orderId) => api.get(`/chat/${orderId}`).then(r => r.data),
  send:        (orderId, text) => api.post(`/chat/${orderId}`, { text }).then(r => r.data),
};
