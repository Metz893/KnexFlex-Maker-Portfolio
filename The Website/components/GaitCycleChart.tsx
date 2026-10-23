"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function GaitCycleChart({
  cycles,
  average,
  comparisonStroke,
  cyclesStroke,
}: {
  cycles: number[][];
  average: number[];
  comparisonStroke?: string; // NEW: used when cycles.length === 1 (comparison mode)
  cyclesStroke?: string; // NEW: used for normal faint cycles
}) {
  const data = average.map((val, i) => ({
    t: i, // 0–99
    avg: val,
    ...Object.fromEntries(cycles.map((c, idx) => [`c${idx}`, c[i]])),
  }));

  const isComparison = cycles.length === 1;

  const faintStroke = cyclesStroke ?? "#94a3b8"; // default grey
  const compareStroke = comparisonStroke ?? "#2563eb"; // default blue

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tickFormatter={(v) => `${v}%`}
            label={{ value: "Normalized Time", position: "insideBottom", offset: -4 }}
          />
          <YAxis
            domain={[0, 140]}
            tickFormatter={(v) => `${v}°`}
            label={{ value: "Angle", angle: -90, position: "insideLeft" }}
          />

          {/* ✅ Tooltip: hide c0/c1/c2/... entries, show only avg */}
          <Tooltip
            formatter={(v: any, name: any) => {
              if (isComparison) {
                if (name === "avg") {
                  return [`${Number(v).toFixed(1)}°`, "Average"];
                }
                if (typeof name === "string" && name.startsWith("c")) {
                  return [`${Number(v).toFixed(1)}°`, "Comparison"];
                }
                return null;
              }
              
              // hide all cycle series in tooltip
              if (typeof name === "string" && name.startsWith("c")) return null;

              // show avg only
              return [`${Number(v).toFixed(1)}°`, "Average"];
            }}
            labelFormatter={(l) => `Time: ${l}%`}
          />

          {/* Cycles */}
          {cycles.map((_, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={`c${i}`}
              stroke={isComparison ? compareStroke : faintStroke}
              dot={false}
              strokeWidth={isComparison ? 2.5 : 1}
              opacity={isComparison ? 0.9 : 0.3}
              strokeDasharray={isComparison ? "0" : "0"}
            />
          ))}

          {/* Average */}
          <Line
            type="monotone"
            dataKey="avg"
            stroke="#000000"
            dot={false}
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
