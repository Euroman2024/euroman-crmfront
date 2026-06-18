import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  
  login: (userData, token) => {
    localStorage.setItem('token', token);
    set({
      user: userData,
      token,
      isAuthenticated: true
    });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({
      user: null,
      token: null,
      isAuthenticated: false
    });
  },
  
  setUser: (userData) => set({ user: userData })
}));
