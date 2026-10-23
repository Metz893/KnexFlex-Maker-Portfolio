// app/online/research/page.tsx
"use client";

import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="Research Mode"
        subtitle="Cohort exports, de-identified datasets, and batch analytics for studies."
      />

      <Card title="Batch Export (Roadmap-ready)">
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>Export all sessions to a single CSV bundle</li>
          <li>Export de-identified dataset (no userId)</li>
          <li>Auto-compute summary table (ROM/vel/reps per session)</li>
          <li>(Optional) IRB-friendly data dictionary generator</li>
        </ul>

        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          Want this fully implemented next? Tell me if you prefer:
          <b> one CSV</b> vs <b>a ZIP-like JSON bundle</b> format.
        </div>
      </Card>
    </div>
  );
}
