"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";


export default function Navbar() {
  const { user } = useAuth();
  const path = usePathname();
  const router = useRouter();

  const Item = ({ href, label }: any) => (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-sm ${
        path.startsWith(href)
          ? "bg-blue-100 text-blue-700"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto flex justify-between px-4 py-3">
        <div className="flex gap-4 items-center">
          <Link
            href="/online/dashboard"
            className="font-semibold text-blue-600"
          >
            KnexFlex
          </Link>
          <Item href="/online/dashboard" label="Dashboard" />
          <Item href="/online/sessions" label="Sessions" />
          <Item href="/online/gait-similarity" label="Gait Similarity" />
          <Item href="/online/import" label="Import" />
          <Item href="/online/community" label="Community" />
          <Item href="/online/admin/sessions" label="Admin" />
        </div>

        <div className="flex gap-3 items-center">
          <span className="text-xs text-slate-500">
            {user?.email}
          </span>
          <button
            onClick={async () => {
              await signOut(auth);
              router.replace("/login");
          }}
          className="border rounded-lg px-3 py-1.5 text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
