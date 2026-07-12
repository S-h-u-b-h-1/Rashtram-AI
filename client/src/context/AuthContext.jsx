"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearAuthTokens,
  deleteAccount as deleteAccountRequest,
  getAuthState,
  getAuthToken,
  storeAuthToken,
  trackActivity,
} from "@/lib/api";

const AuthContext = createContext();

const clearLocalAccountState = (userId = null) => {
  if (typeof window === "undefined") return;
  if (userId) {
    localStorage.removeItem(`rashtram-comparison-documents:${userId}`);
    localStorage.removeItem(`rashtram:comparison-selection:${userId}`);
  }
  localStorage.removeItem("rashtram-comparison-documents");
  sessionStorage.removeItem("rashtram-activity-session");
};

const normalizeAuthState = (data) => {
  if (!data) return null;
  if (data.user) return data;
  return {
    user: data,
    profile: {},
    preferences: {},
    onboarding: {
      completed: Boolean(data.onboardingCompleted),
      skipped: Boolean(data.onboardingSkipped),
      completedAt: data.onboardingCompletedAt || null,
      required: false,
      legacyUser: true,
    },
  };
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
  const [authState, setAuthState] = useState(null);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
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
        setAuthState(null);
        setUser(null);
        setProfile(null);
        setPreferences(null);
        setOnboarding(null);
        setIsAuthenticated(false);
        setLoading(false);
        return null;
      }

      try {
        const state = normalizeAuthState(await getAuthState());
        setAuthState(state);
        setUser(state?.user || null);
        setProfile(state?.profile || null);
        setPreferences(state?.preferences || null);
        setOnboarding(state?.onboarding || null);
        setIsAuthenticated(true);
        return state;
      } catch {
        clearAuthTokens();
        setAuthState(null);
        setUser(null);
        setProfile(null);
        setPreferences(null);
        setOnboarding(null);
        setIsAuthenticated(false);
        return null;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      clearAuthTokens();
      setAuthState(null);
      setUser(null);
      setProfile(null);
      setPreferences(null);
      setOnboarding(null);
      setIsAuthenticated(false);
      return null;
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


        const state = await checkAuthStatus();
        trackActivity({
          event_type: "login",
          entity_type: "account",
          page_path: "/login",
        });


        const nextPath = state?.onboarding?.required ? "/app/onboarding" : "/app";
        router.push(nextPath);
        return { success: true, state };
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


        const state = hydrate ? await checkAuthStatus() : null;


        if (redirectTo) router.push(redirectTo);
        return { success: true, user: data.user, state };
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
    setAuthState(null);
    setUser(null);
    setProfile(null);
    setPreferences(null);
    setOnboarding(null);
    setIsAuthenticated(false);
    router.push('/');
  };

  const deleteAccount = async ({ confirmation, password } = {}) => {
    const result = await deleteAccountRequest({ confirmation, password });
    clearLocalAccountState(user?.id || user?._id);
    clearAuthTokens();
    setAuthState(null);
    setUser(null);
    setProfile(null);
    setPreferences(null);
    setOnboarding(null);
    setIsAuthenticated(false);
    router.push("/");
    return result;
  };

  const value = {
    user,
    authState,
    profile,
    preferences,
    onboarding,
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
