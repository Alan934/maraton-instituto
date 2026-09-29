import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-[color:var(--muted)]">
          {user.fullName} · @{user.username} · {user.role === "superadmin" ? "Superadministrador" : "Administrador"}
        </p>
      </div>
      <PasswordForm />
    </div>
  );
}
