// components/TopBar.tsx
"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

export default function TopBar() {
  const { user } = useAuth();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">Online</div>
        <div className="text-xl font-semibold text-slate-900">KnexFlex</div>
      </div>

      <div className="flex items-center gap-2">

      </div>
    </div>
  );
}
