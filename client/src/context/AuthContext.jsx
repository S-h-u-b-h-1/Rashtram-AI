"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearAuthTokens,
  deleteAccount as deleteAccountRequest,
  getAuthToken,
  storeAuthToken,
  trackActivity,
} from "@/lib/api";

const AuthContext = createContext();

const clearLocalAccountState = (userId = null) => {
  if (typeof window === "undefined") return;
  if (userId) {
    localStorage.removeItem(`rashtram-comparison-documents:${userId}`);
  }
  localStorage.removeItem("rashtram-comparison-documents");
  sessionStorage.removeItem("rashtram-activity-session");
};

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

      storeAuthToken(tokenFromUrl, { persistent: true });

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
      const token = getAuthToken();
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

        clearAuthTokens();
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      clearAuthTokens();
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

        storeAuthToken(data.authToken, { persistent: rememberMe });


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

  const register = async (
    name,
    email,
    password,
    { redirectTo = "/app/onboarding", persistent = true, hydrate = true } = {},
  ) => {
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

        storeAuthToken(data.authToken, { persistent });


        if (hydrate) await checkAuthStatus();


        if (redirectTo) router.push(redirectTo);
        return { success: true, user: data.user };
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
    clearAuthTokens();
    setUser(null);
    setIsAuthenticated(false);
    router.push('/');
  };

  const deleteAccount = async ({ confirmation, password } = {}) => {
    const result = await deleteAccountRequest({ confirmation, password });
    clearLocalAccountState(user?.id || user?._id);
    clearAuthTokens();
    setUser(null);
    setIsAuthenticated(false);
    router.push("/");
    return result;
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    googleLogin,
    logout,
    deleteAccount,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
