import { Radio, WifiOff } from "lucide-react";

const labels = {
  connected: "Live updates connected",
  connecting: "Connecting live updates",
  unavailable: "REST refresh active",
  disconnected: "Sign in for live updates",
};

export default function RealtimeBadge({ status }) {
  const connected = status === "connected";
  return <div className={`realtime-badge realtime-${status}`}>{connected ? <Radio /> : <WifiOff />}<span>{labels[status] || labels.disconnected}</span></div>;
}

