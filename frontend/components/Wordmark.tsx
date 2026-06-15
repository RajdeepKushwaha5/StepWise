export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="29" height="29" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 16.4l3.8 3.8L22 11"
        stroke="var(--color-verify)"
        strokeWidth="2.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex select-none items-center gap-2.5">
      <Mark size={28} />
      <span className="font-mono text-[21px] font-bold text-text">
        Step<span style={{ color: "var(--color-verify)" }}>Wise</span>
      </span>
    </div>
  );
}
