"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authApi } from "@/features/auth/api";
import { readStoredSession, writeStoredSession } from "@/features/auth/storage";
import { authBridge } from "@/services/auth-bridge";

export const AuthContext = createContext(null);

function normalizeSession(data, fallbackUser = null) {
  return {
    user: data?.user || fallbackUser,
    tokens: data?.tokens,
  };
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [signupDraft, setSignupDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef(null);

  const commitSession = useCallback((nextSession) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    writeStoredSession(nextSession);
  }, []);

  useEffect(() => {
    const stored = readStoredSession();
    sessionRef.current = stored;
    setSession(stored);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    const refreshToken = current?.tokens?.refreshToken;

    if (!refreshToken) throw new Error("Your session has expired. Please sign in again.");

    const data = await authApi.refresh(refreshToken);
    const nextSession = normalizeSession(data, current.user);
    commitSession(nextSession);
    return nextSession.tokens.accessToken;
  }, [commitSession]);

  const clearSession = useCallback(() => {
    commitSession(null);
  }, [commitSession]);

  useEffect(() => {
    authBridge.configure({
      getAccessToken: () => sessionRef.current?.tokens?.accessToken || null,
      refresh,
      onAuthFailure: clearSession,
    });

    return () => authBridge.reset();
  }, [clearSession, refresh]);

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    const nextSession = normalizeSession(data);
    commitSession(nextSession);
    return nextSession;
  }, [commitSession]);

  const beginSignup = useCallback(async (draft) => {
    const data = await authApi.sendOtp(draft.email);
    setSignupDraft(draft);
    return data;
  }, []);

  const completeSignup = useCallback(async (otp) => {
    if (!signupDraft) {
      throw new Error("Your signup details are no longer available. Please restart signup.");
    }

    await authApi.verifyOtp(signupDraft.email, otp);
    const data = await authApi.signup(signupDraft);
    const nextSession = normalizeSession(data);
    setSignupDraft(null);
    commitSession(nextSession);
    return nextSession;
  }, [commitSession, signupDraft]);

  const resendOtp = useCallback(async () => {
    if (!signupDraft?.email) {
      throw new Error("Please restart signup to request another code.");
    }

    return authApi.sendOtp(signupDraft.email);
  }, [signupDraft]);

  const logout = useCallback(async () => {
    const refreshToken = sessionRef.current?.tokens?.refreshToken;
    clearSession();

    try {
      await authApi.logout(refreshToken);
    } catch {
      // Local logout remains successful even if the idempotent API call fails.
    }
  }, [clearSession]);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    isAuthenticated: Boolean(session?.user && session?.tokens?.accessToken),
    isLoading,
    signupDraft,
    login,
    beginSignup,
    completeSignup,
    resendOtp,
    refresh,
    logout,
  }), [beginSignup, completeSignup, isLoading, login, logout, refresh, resendOtp, session, signupDraft]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

