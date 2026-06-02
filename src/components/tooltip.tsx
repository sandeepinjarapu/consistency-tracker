"use client";

import { useEffect, useRef, useState } from "react";

type Tip = { x: number; y: number; text: string };

/**
 * Shared near-instant hover tooltip for HTML-based charts (bars, grids).
 *
 * The native `title` attribute has a long, browser-controlled show-delay
 * even when all data is already rendered. This shows our own tooltip after
 * ~120ms (small delay avoids flicker when sweeping across elements).
 *
 * Usage:
 *   const { tip, bind } = useHoverTip();
 *   <div {...bind("Mon · Done")} />
 *   <HoverTip tip={tip} />
 */
export function useHoverTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const bind = (text: string) => ({
    onMouseEnter: (e: React.MouseEvent) => {
      const { clientX: x, clientY: y } = e;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setTip({ x, y, text }), 120);
    },
    onMouseLeave: () => {
      if (timer.current) clearTimeout(timer.current);
      setTip(null);
    },
  });

  return { tip, bind };
}

export function HoverTip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      className="text-[11px] text-white whitespace-nowrap rounded-md px-2 py-1"
      style={{
        position: "fixed",
        left: tip.x,
        top: tip.y - 30,
        transform: "translateX(-50%)",
        background: "rgba(10,10,10,0.92)",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {tip.text}
    </div>
  );
}
