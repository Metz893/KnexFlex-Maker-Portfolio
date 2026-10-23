// app/online/layout.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SideNav from "@/components/SideNav";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/lib/auth";

export default function OnlineLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-64 shrink-0 md:block">
          <SideNav />
        </aside>

        <main className="flex-1 space-y-5">
          <TopBar />
          {children}
        </main>
      </div>
    </div>
  );
}
