// utils/axiosInstance.js
import axios from 'axios';
import { handleAuthFailure, isSessionFailure } from './authInterceptor';

// Buat axios instance dengan interceptor
const createAxiosInstance = (baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5004/api') => {
  const instance = axios.create({
    baseURL,
    timeout: 30000, // 30 detik timeout
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Request interceptor untuk menambahkan token
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor untuk handle error autentikasi
  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      if (error.response) {
        const { status } = error.response;
        // Hanya anggap 401/403 (yang bukan penolakan peran FORBIDDEN)
        // sebagai kegagalan sesi -> logout & redirect ke /login.
        if ((status === 401 || status === 403) && isSessionFailure(status, error.response.data)) {
          console.warn(`Unauthorized access (${status}) - token mungkin expired`);
          handleAuthFailure();
        } else if (status === 404) {
          console.error('Endpoint tidak ditemukan');
        }
      } else if (error.request) {
        // Request dibuat tapi tidak ada response
        console.error('No response received:', error.request);
      } else {
        // Error saat setup request
        console.error('Request setup error:', error.message);
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// Ekspor instance yang sudah dibuat
export const axiosInstance = createAxiosInstance();

// Ekspor fungsi untuk membuat instance baru jika diperlukan
export default createAxiosInstance;