import { ROUTES } from "@/constants/routes";

export function safeReturnTo(value, fallback = ROUTES.DASHBOARD) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function roleHome(role) {
  if (role === "ADMIN") return ROUTES.ADMIN;
  if (role === "SELLER") return ROUTES.SELLER;
  return ROUTES.DASHBOARD;
}

