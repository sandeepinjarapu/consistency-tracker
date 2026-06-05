"use client";

import { useEffect, useState } from "react";

/**
 * A calm progress ring for "this week": fills `done / total` in the category
 * accent on a near-invisible track. No percent, nothing in the center. At
 * completion it closes and shows a quiet check. Never red, never a deficit —
 * it shows what you did, not what you owe (anti-shame).
 */
export default function ProgressRing({
  done,
  total,
  color,
  size = 54,
}: {
  done: number;
  total: number;
  color: string;
  size?: number;
}) {
  const r = (size - 10) / 2; // 5px stroke, centered
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(done / total, 1) : 0;
  const complete = total > 0 && done >= total;

  // Calm ease-out fill on mount: start empty, settle to the real ratio.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(ratio));
    return () => cancelAnimationFrame(id);
  }, [ratio]);

  const cx = size / 2;
  const label = `${done} of ${total} done this week`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
    >
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#edeef0" strokeWidth={5} />
      {complete ? (
        <>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={5} />
          <path
            d={`M${cx - 7} ${cx + 0.5} l4.5 4.5 L${cx + 7} ${cx - 4.5}`}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${shown * c} ${c}`}
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      )}
    </svg>
  );
}
