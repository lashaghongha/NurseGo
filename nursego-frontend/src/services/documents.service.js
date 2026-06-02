import api from './api';

export const documentsService = {
  upload: (file, docType) => {
    const form = new FormData();
    form.append('file', file);
    form.append('docType', docType);
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data);
  },
  getMy: () => api.get('/documents/my').then(r => r.data),
};
