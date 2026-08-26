import { Label } from "@/components/ui/label";

export default function FormField({ id, label, error, children }) {
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

