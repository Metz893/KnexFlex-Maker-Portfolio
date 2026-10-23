"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/NavBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !pathname.startsWith("/login");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {showNav && <Navbar />}
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
