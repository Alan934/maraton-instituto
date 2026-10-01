import Link from "next/link";
import { LogOut, UserCircle } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-navy-900 text-white shadow-md">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-500 to-sun-400" style={{ backgroundSize: "100% 100%" }} />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 lg:flex-nowrap lg:py-3">
          <Link href="/escanear" className="flex shrink-0 items-center gap-2.5">
            <LogoMark size={32} />
            <span className="text-base font-extrabold tracking-tight">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-1 lg:order-3 lg:border-l lg:border-white/15 lg:pl-4">
            <UserMenu name={user.fullName} role={user.role} />
          </div>
          <div className="w-full min-w-0 lg:order-2 lg:w-auto lg:flex-1">
            <Nav isSuperadmin={user.role === "superadmin"} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-7">{children}</main>
    </div>
  );
}

function UserMenu({ name, role }: { name: string; role: string }) {
  return (
    <>
      <Link
        href="/cuenta"
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-brand-100 hover:bg-white/10"
        title="Mi cuenta"
      >
        <UserCircle className="size-5" aria-hidden />
        <span className="max-w-32 truncate font-semibold">{name}</span>
        {role === "superadmin" && <span className="badge badge-sun">Super</span>}
      </Link>
      <form action={logout}>
        <button type="submit" className="rounded-lg p-2 text-brand-100 hover:bg-white/10" title="Cerrar sesión" aria-label="Cerrar sesión">
          <LogOut className="size-5" />
        </button>
      </form>
    </>
  );
}
