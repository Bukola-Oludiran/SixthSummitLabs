/** The 6ixSummit peak mark. */
export function Logo({ size = 26, withRidge = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path
        d="M2 22 L9.5 8 L14 15.5 L17 10 L24 22 Z"
        stroke="var(--brand-stroke)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {withRidge && <path d="M7 16 L12 16" stroke="var(--brand-250)" strokeWidth="1.4" />}
    </svg>
  )
}

export function ArrowRight({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function ImageIcon({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}
