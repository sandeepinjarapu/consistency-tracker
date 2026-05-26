"use client";

import { useEffect, useRef } from "react";

/**
 * Horizontally scrolls its content to the right edge on mount so that
 * "today" (rightmost cell in the heatmap) is visible by default.
 */
export default function HeatmapScroller({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Scroll all the way right so today is in view
    el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div ref={ref} className="overflow-x-auto">
      {children}
    </div>
  );
}
