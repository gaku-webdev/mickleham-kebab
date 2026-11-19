import Skeleton from "./Skeleton";

type LoaderProps = {
  label?: string;
  size?: "sm" | "md";
  inline?: boolean;
  tone?: "default" | "inverse";
};

export default function Loader({
  label = "Loading...",
  size = "md",
  inline = false,
  tone = "default",
}: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      aria-busy="true"
      className={`${inline ? "inline-flex flex-row" : "flex w-full flex-col"} items-center justify-center gap-2`}
    >
      {inline ? (
        <Skeleton
          tone={tone}
          className={size === "sm" ? "h-3 w-16" : "h-4 w-24"}
        />
      ) : (
        <div
          className={`w-full ${
            size === "sm" ? "max-w-xs space-y-3" : "max-w-md space-y-4"
          }`}
        >
          <Skeleton
            className={size === "sm" ? "mx-auto h-4 w-2/5" : "h-6 w-2/3"}
          />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          {size === "md" && <Skeleton className="h-24 w-full rounded-xl" />}
        </div>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
