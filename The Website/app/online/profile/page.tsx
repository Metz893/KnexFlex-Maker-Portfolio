// app/online/profile/page.tsx
"use client";

import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import { useAuth } from "@/lib/auth";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <SectionTitle title="Profile" subtitle="Account identity, privacy controls, and preferences." />

      <Card title="Account">
        <div className="text-sm text-slate-700">
          <div><b>Email:</b> {user?.email ?? "—"}</div>
          <div className="mt-2 text-xs text-slate-500">
            (Optional enhancement) Save preferences like default leg, injury type, privacy opt-in.
          </div>
        </div>
      </Card>

      <Card title="Privacy">
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>Community sharing is anonymous</li>
          <li>Share links are read-only and tokenized</li>
          <li>(Optional enhancement) Add link expiration + revoke manager</li>
        </ul>
      </Card>
    </div>
  );
}
