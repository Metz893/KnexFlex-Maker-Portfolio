"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/online/dashboard");
  }, [loading, user, router]);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.replace("/online/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-20 max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-2xl font-semibold text-slate-900">
        Welcome to <span className="text-blue-600">KnexFlex</span>
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Sign in to view sessions, or use Offline Live when connected to your device.
      </p>

      <div className="mt-6 flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setMode("login")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm ${
            mode === "login" ? "bg-white shadow-sm" : "text-slate-600"
          }`}
        >
          Login
        </button>
        <button
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm ${
            mode === "signup" ? "bg-white shadow-sm" : "text-slate-600"
          }`}
        >
          Sign up
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <input
          className="w-full rounded-xl border px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className="w-full rounded-xl border px-3 py-2"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Please wait…" : mode === "login" ? "Login" : "Create account"}
        </button>
      </div>

      <div className="mt-5 text-xs text-slate-500">
        Offline live angle requires connecting to the device Wi-Fi first.
      </div>
    </div>
  );
}
