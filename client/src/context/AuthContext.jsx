"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trackActivity } from "@/lib/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  const API_ROOT =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
  const API_BASE_URL = `${API_ROOT}/auth`;

  useEffect(() => {

    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const errorFromUrl = urlParams.get('error');

    if (tokenFromUrl) {

      localStorage.setItem('auth-token', tokenFromUrl);
      sessionStorage.setItem('auth-token', tokenFromUrl);

      window.history.replaceState({}, document.title, window.location.pathname);

      checkAuthStatus();
      trackActivity({
        event_type: "login",
        entity_type: "account",
        page_path: window.location.pathname,
      });
    } else if (errorFromUrl) {

      window.history.replaceState({}, document.title, window.location.pathname);
      console.error('OAuth error:', errorFromUrl);
      checkAuthStatus();
    } else {
      checkAuthStatus();
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('auth-token') || sessionStorage.getItem('auth-token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/getuser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': token,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {

        localStorage.removeItem('auth-token');
        sessionStorage.removeItem('auth-token');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('auth-token');
      sessionStorage.removeItem('auth-token');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {

        if (rememberMe) {
          localStorage.setItem('auth-token', data.authToken);
        } else {
          sessionStorage.setItem('auth-token', data.authToken);
        }


        await checkAuthStatus();
        trackActivity({
          event_type: "login",
          entity_type: "account",
          page_path: "/login",
        });


        router.push('/app');
        return { success: true };
      } else {
        return {
          success: false,
          error: data.error || data.errors?.[0]?.msg || 'Login failed'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {

        localStorage.setItem('auth-token', data.authToken);


        await checkAuthStatus();


        router.push('/app');
        return { success: true };
      } else {
        return {
          success: false,
          error: data.error || data.errors?.[0]?.msg || 'Registration failed'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = () => {

    window.location.href = `${API_BASE_URL}/google`;
  };

  const logout = () => {
    trackActivity({
      event_type: "logout",
      entity_type: "account",
      page_path: window.location.pathname,
    });
    localStorage.removeItem('auth-token');
    sessionStorage.removeItem('auth-token');
    setUser(null);
    setIsAuthenticated(false);
    router.push('/');
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    googleLogin,
    logout,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
