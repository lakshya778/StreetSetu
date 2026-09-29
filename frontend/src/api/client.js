import axios from 'axios';

const SESSION_KEY = 'streetsetu_session';
const TOKEN_KEY = 'streetsetu_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

let refreshRequest;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('streetsetu_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback;
}

api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config;
  const isAuthRequest = /\/auth\/(login|register|refresh|logout)/.test(original?.url || '');
  if (error.response?.status !== 401 || !original || original._retry || isAuthRequest) throw error;
  original._retry = true;
  try {
    refreshRequest ||= axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true });
    const { data } = await refreshRequest;
    const accessToken = data.data.accessToken || data.data.token;
    localStorage.setItem(TOKEN_KEY, accessToken);
    original.headers.Authorization = `Bearer ${accessToken}`;
    window.dispatchEvent(new CustomEvent('streetsetu:token-refreshed', { detail: { accessToken } }));
    return api(original);
  } catch (refreshError) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event('streetsetu:session-expired'));
    throw refreshError;
  } finally {
    refreshRequest = null;
  }
});

export default api;
