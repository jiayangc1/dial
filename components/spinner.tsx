export function Spinner({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
