import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Files served by the backend (e.g. banner images at /api/banners/<id>/image) when the API lives on another host
export const assetUrl = (url?: string) => (url && url.startsWith('/api/') ? `${API_BASE_URL}${url.slice(4)}` : url || '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('scholarlogic_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const cfg: any = error.config;
    const retryable = cfg && !cfg.__retried && (String(cfg.method).toLowerCase() === 'get' || String(cfg.url || '').endsWith('/auth/login'));
    if (retryable && (error.response?.status === 503 || !error.response)) {
      cfg.__retried = true;
      await new Promise((r) => setTimeout(r, 800));
      return api.request(cfg);
    }
    // An admin removed this person's access or reset their password: sign out and go to the login page
    if (error.response?.data?.code === 'SESSION_REVOKED' && localStorage.getItem('scholarlogic_token')) {
      localStorage.removeItem('scholarlogic_token');
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
    }
    const message =
      error.response?.data?.message || error.message || 'An unexpected error occurred';
    const code = error.response?.data?.code || 'ERROR';
    return Promise.reject({ message, code, status: error.response?.status });
  }
);
