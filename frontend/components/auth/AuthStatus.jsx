import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function AuthStatus({ type = "error", children }) {
  if (!children) return null;

  return (
    <div className={`auth-status auth-status-${type}`} role={type === "error" ? "alert" : "status"}>
      {type === "error" ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
      <span>{children}</span>
    </div>
  );
}

