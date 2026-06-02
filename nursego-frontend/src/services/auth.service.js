import api from './api';

export const authService = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }).then(r => r.data),

  register: (data) =>
    api.post('/auth/register', data).then(r => r.data),

  registerNurse: (data) =>
    api.post('/auth/register-nurse', data).then(r => r.data),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }).then(r => r.data),

  resetPassword: (email, token, newPassword) =>
    api.post('/auth/reset-password', { email, token, newPassword }).then(r => r.data),
};
