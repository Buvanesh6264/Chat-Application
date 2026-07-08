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

// Shared by the 401-retry interceptor below and refreshSession() (called from AuthProvider's
// mount-effect) — the refresh cookie is single-use (backend rotates refreshTokenHash on every
// call), so two concurrent /auth/refresh requests would have the second one rejected as "revoked"
// even though the session is fine. Deduping through one in-flight promise avoids that race,
// notably under React 19 StrictMode's dev-only double-invoked mount effects.
let refreshPromise = null;

const performRefresh = () => {
  refreshPromise ??= api.post('/auth/refresh').finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (response?.status === 401 && !config._retried) {
      config._retried = true;
      try {
        const { data } = await performRefresh();
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

export const refreshSession = async () => {
  const { data } = await performRefresh();
  return data;
};

export const getChats = async () => {
  const { data } = await api.get('/chats');
  return data.chats;
};

export const getMessages = async (chatId, { cursor, limit } = {}) => {
  const { data } = await api.get(`/chats/${chatId}/messages`, { params: { cursor, limit } });
  return data;
};

export const createDirectChat = async (userId) => {
  const { data } = await api.post('/chats/direct', { userId });
  return data.chat;
};

export const createGroupChat = async (groupName, participantIds) => {
  const { data } = await api.post('/chats/group', { groupName, participantIds });
  return data.chat;
};

export const addChatMember = async (chatId, userId) => {
  await api.post(`/chats/${chatId}/members`, { userId });
};

export const searchUsers = async (phone) => {
  const { data } = await api.get('/users/search', { params: { phone } });
  return data.users;
};

export const getUserProfile = async (userId) => {
  const { data } = await api.get(`/users/${userId}/profile`);
  return data.user;
};

export const updatePrivacy = async (settings) => {
  const { data } = await api.patch('/users/me/privacy', settings);
  return data;
};

export const updateProfile = async (updates) => {
  const { data } = await api.patch('/users/me/profile', updates);
  return data.user;
};

export const pinChat = async (chatId) => {
  const { data } = await api.patch(`/chats/${chatId}/pin`);
  return data.pinnedChats;
};

export const unpinChat = async (chatId) => {
  const { data } = await api.delete(`/chats/${chatId}/pin`);
  return data.pinnedChats;
};

export const getFriends = async () => {
  const { data } = await api.get('/friends');
  return data.friends;
};

export const getFriendRequests = async () => {
  const { data } = await api.get('/friends/requests');
  return data.requests;
};

export const sendFriendRequest = async (to) => {
  const { data } = await api.post('/friends/request', { to });
  return data.request;
};

export const respondFriendRequest = async (requestId, action) => {
  const { data } = await api.post('/friends/respond', { requestId, action });
  return data.request;
};

export const blockUser = async (userId) => {
  await api.post('/friends/block', { userId });
};

export const getUploadUrl = async (category, mimeType) => {
  const { data } = await api.post('/media/upload-url', { category, mimeType });
  return data;
};

export const editTranscript = async (messageId, transcript) => {
  const { data } = await api.patch(`/messages/${messageId}/transcript`, { transcript });
  return data.message;
};

export const getStoriesFeed = async () => {
  const { data } = await api.get('/stories/feed');
  return data.stories;
};

export const postStory = async (objectKey, caption) => {
  const { data } = await api.post('/stories', { objectKey, caption });
  return data.story;
};

export const viewStory = async (storyId) => {
  const { data } = await api.post(`/stories/${storyId}/view`);
  return data.story;
};
