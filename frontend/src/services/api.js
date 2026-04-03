import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // For multipart uploads, axios will set the correct boundary only if Content-Type is NOT forced.
  // Using "instanceof FormData" can fail across environments, so detect by shape.
  const data = config.data;
  const isFormDataLike =
    typeof data?.append === 'function' && typeof data?.get === 'function';
  if (isFormDataLike) {
    if (config.headers) delete config.headers['Content-Type'];
  }
  return config;
});

export function setToken(token) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function getStoredUser() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem('user', JSON.stringify(user));
  else localStorage.removeItem('user');
}

export function logout() {
  setToken(null);
  setStoredUser(null);
}
