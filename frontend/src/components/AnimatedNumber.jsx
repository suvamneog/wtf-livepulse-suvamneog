import { useEffect, useState } from "react";

export function AnimatedNumber({ value, className }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const start = display;
    const end = Number(value) || 0;
    const t0 = performance.now();
    const dur = 400;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const v = start + (end - start) * p;
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className={`font-mono tabular-nums transition-colors ${className || ""}`}>
      {typeof display === "number" && display % 1
        ? display.toFixed(0)
        : Math.round(display)}
    </span>
  );
}
