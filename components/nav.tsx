"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, Flag, GraduationCap, Layers, ScanLine, ShieldCheck, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; superOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/escanear", label: "Escanear", icon: ScanLine },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/registros", label: "Registros", icon: ClipboardList },
  { href: "/alumnos", label: "Alumnos", icon: GraduationCap },
  { href: "/cursos", label: "Cursos", icon: Layers, superOnly: true },
  { href: "/paradas", label: "Paradas", icon: Flag, superOnly: true },
  { href: "/admins", label: "Administradores", icon: ShieldCheck, superOnly: true },
];

export function Nav({ isSuperadmin }: { isSuperadmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="no-scrollbar -mx-4 overflow-x-auto px-4 xl:mx-0 xl:px-0">
      <ul className="flex min-w-max gap-1 lg:justify-center">
        {ITEMS.filter((i) => !i.superOnly || isSuperadmin).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition-colors xl:px-2 2xl:px-3 ${
                  active ? "bg-sun-400 text-navy-950 shadow-sm" : "text-brand-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
