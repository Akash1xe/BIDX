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
    if (!stored?.user) {
      sessionRef.current = null;
      const readyTimer = window.setTimeout(() => {
        setSession(null);
        setIsLoading(false);
      }, 0);
      return () => window.clearTimeout(readyTimer);
    }

    let cancelled = false;
    authApi.refresh(stored.tokens?.refreshToken)
      .then((data) => {
        if (!cancelled) commitSession(normalizeSession(data, stored.user));
      })
      .catch(() => {
        if (!cancelled) commitSession(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [commitSession]);

  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    const refreshToken = current?.tokens?.refreshToken;

    const data = await authApi.refresh(refreshToken);
    const nextSession = normalizeSession(data, current?.user);
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

  const becomeSeller = useCallback(async () => {
    await authApi.becomeSeller();
    await refresh();
    return sessionRef.current;
  }, [refresh]);

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
    becomeSeller,
    logout,
  }), [becomeSeller, beginSignup, completeSignup, isLoading, login, logout, refresh, resendOtp, session, signupDraft]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
