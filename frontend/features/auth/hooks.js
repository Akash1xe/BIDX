"use client";

import { useMutation } from "@tanstack/react-query";
import useAuth from "@/hooks/useAuth";

export function useLogin() {
  const { login } = useAuth();
  return useMutation({ mutationFn: login });
}

export function useBeginSignup() {
  const { beginSignup } = useAuth();
  return useMutation({ mutationFn: beginSignup });
}

export function useCompleteSignup() {
  const { completeSignup } = useAuth();
  return useMutation({ mutationFn: completeSignup });
}

