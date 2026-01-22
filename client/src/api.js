import axios from 'axios';

// Create a new Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  header: {
    'Content-Type': 'application/json',
  },
  withCredentials: true // Important for cookies
});

// Request Interceptor: Attach Access Token
api.interceptors.request.use(
  (config) => {
    // We will store the token in localStorage for simplicity in this turn, 
    // or better, in memory. For now, let's keep it compatible with existing code 
    // which likely puts it in localStorage or just state.
    // Let's assume we store it in localStorage as 'token' for now, 
    // but the goal is to use the refreshed one.
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt refresh
        const { data } = await api.post('/refresh_token');
        
        // Update local storage / state with new token
        localStorage.setItem('token', data.accessToken);
        
        // Update header and retry
        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        // Refresh failed (expired/invalid) -> Logout
        console.error("Session expired", refreshError);
        localStorage.removeItem('token');
        window.location.href = '/'; // or handle logout via callback
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
