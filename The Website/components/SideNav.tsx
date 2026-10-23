// components/SideNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/online/dashboard", label: "Dashboard" },
  { href: "/online/vault", label: "Data Vault" },
  { href: "/online/analytics", label: "Advanced Analytics" },
  { href: "/online/gait-lab", label: "Gait Lab" },
  {href: "/online/gait-similarity", label: "Gait Similarity"},
  { href: "/online/compare", label: "Compare" },
  { href: "/online/reports", label: "Reports" },
  { href: "/online/community", label: "Community" },
  { href: "/online/research", label: "Research Mode" },
  { href: "/online/profile", label: "Profile" },
  { href: "/online/sessions", label: "Sessions" },
  { href: "/online/import", label: "Import" },
];

export default function SideNav() {
  const path = usePathname();

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="px-2 pb-3">
        <div className="text-sm font-semibold text-slate-900">
          <span className="text-blue-600">KnexFlex</span> Pro
        </div>
        <div className="text-xs text-slate-500">Biomechanics + rehab intelligence</div>
      </div>

      <nav className="space-y-1">
        {items.map((it) => {
          const active = path?.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                "block rounded-xl px-3 py-2 text-sm",
                active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
