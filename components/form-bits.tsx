"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export type FormState = { error?: string; ok?: string };

export function SubmitButton({
  children, className = "btn btn-primary", pendingLabel,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{state.ok}</p>;
  return null;
}
