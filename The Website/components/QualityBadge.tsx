// components/QualityBadge.tsx
export default function QualityBadge({ score }: { score: number }) {
  const label =
    score >= 85 ? "Excellent" :
    score >= 70 ? "Good" :
    score >= 55 ? "Fair" : "Poor";

  const cls =
    score >= 85 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
    score >= 70 ? "bg-blue-50 text-blue-700 ring-blue-200" :
    score >= 55 ? "bg-amber-50 text-amber-700 ring-amber-200" :
                  "bg-red-50 text-red-700 ring-red-200";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${cls}`}>
      <span className="font-semibold">{label}</span>
      <span className="text-[11px] opacity-80">{Math.round(score)}/100</span>
    </span>
  );
}
