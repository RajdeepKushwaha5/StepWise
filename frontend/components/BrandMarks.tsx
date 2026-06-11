type BrandMarkProps = {
  size?: number;
};

export function GeminiMark({ size = 14 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="gemini-mark-gradient" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4285F4" />
          <stop offset="0.32" stopColor="#A142F4" />
          <stop offset="0.62" stopColor="#EA4335" />
          <stop offset="1" stopColor="#FBBC04" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.6c.72 4.84 2.56 6.68 7.4 7.4-4.84.72-6.68 2.56-7.4 7.4-.72-4.84-2.56-6.68-7.4-7.4 4.84-.72 6.68-2.56 7.4-7.4Z"
        fill="url(#gemini-mark-gradient)"
      />
      <path
        d="M18.2 14.8c.28 1.8.98 2.5 2.8 2.8-1.82.28-2.52.98-2.8 2.8-.3-1.82-1-2.52-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z"
        fill="#34A853"
        opacity="0.95"
      />
    </svg>
  );
}

export function WolframMark({ size = 14 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="wolfram-mark-gradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF7A59" />
          <stop offset="0.55" stopColor="#E63B2E" />
          <stop offset="1" stopColor="#9D1B16" />
        </linearGradient>
      </defs>
      <path
        d="M12 1.8 14.2 7l5.1-2.35-2.34 5.1 5.24 2.25-5.24 2.25 2.34 5.1-5.1-2.35L12 22.2 9.8 17l-5.1 2.35 2.34-5.1L1.8 12l5.24-2.25-2.34-5.1L9.8 7 12 1.8Z"
        fill="url(#wolfram-mark-gradient)"
      />
      <circle cx="12" cy="12" r="3.15" fill="#1B0D0B" opacity="0.72" />
      <circle cx="12" cy="12" r="1.6" fill="#FFD3C8" />
    </svg>
  );
}
