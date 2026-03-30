export function Skeleton({ className }) {
  return (
    <div
      className={`animate-pulse rounded bg-white/5 ${className || "h-8 w-full"}`}
    />
  );
}
