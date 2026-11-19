type SkeletonProps = {
  className?: string;
  tone?: "default" | "warm" | "inverse";
};

export default function Skeleton({
  className = "",
  tone = "default",
}: SkeletonProps) {
  const toneClass =
    tone === "inverse"
      ? "bg-white/40"
      : tone === "warm"
        ? "bg-[#EFE7DB]"
        : "bg-[#E8DED2]";

  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded ${toneClass} motion-reduce:animate-none ${className}`}
    />
  );
}
