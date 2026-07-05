import axios from 'axios';

// Access token lives only in memory (module-level var), never localStorage — reduces XSS token-theft
// surface. The refresh token is an httpOnly cookie the browser attaches automatically.
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (response?.status === 401 && !config._retried) {
      config._retried = true;
      try {
        refreshPromise ??= api.post('/auth/refresh').finally(() => {
          refreshPromise = null;
        });
        const { data } = await refreshPromise;
        setAccessToken(data.accessToken);
        config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(config);
      } catch (refreshError) {
        setAccessToken(null);
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export const signup = async (name, phoneNumber, password) => {
  const { data } = await api.post('/auth/signup', { name, phoneNumber, password });
  return data;
};

export const login = async (phoneNumber, password) => {
  const { data } = await api.post('/auth/login', { phoneNumber, password });
  return data;
};

export const logout = async () => {
  await api.post('/auth/logout');
};
