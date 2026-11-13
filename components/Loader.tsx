type LoaderProps = {
  label?: string;
  size?: "sm" | "md";
  inline?: boolean;
  className?: string;
};

export default function Loader({
  label = "Loading...",
  size = "md",
  inline = false,
  className = "",
}: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${inline ? "inline-flex flex-row" : "flex flex-col"} items-center justify-center gap-2 text-[#C2410C] ${className}`}
    >
      <span
        className={`newtons-cradle ${size === "sm" ? "newtons-cradle--small" : ""}`}
        aria-hidden="true"
      >
        <span className="newtons-cradle__dot" />
        <span className="newtons-cradle__dot" />
        <span className="newtons-cradle__dot" />
        <span className="newtons-cradle__dot" />
      </span>
      <span className={inline ? "text-xs font-semibold" : "text-sm font-medium"}>
        {label}
      </span>
    </div>
  );
}
