import ascentMark from '../assets/brand/6ixsummit-mark-blue.svg'
import ascentWordmark from '../assets/brand/6ixsummit-logo-dark.svg'

/** Outlined wordmark: the twin-peak mark replaces the initial 6. */
export function Wordmark({ width = 210 }) {
  return (
    <img
      className="brand-wordmark"
      src={ascentWordmark}
      width={width}
      height={width / 7}
      alt="6ixSummit Labs"
    />
  )
}

/** The Ascent 6 mark, exported from the editable logo kit. */
export function Logo({ size = 32 }) {
  return (
    <img
      className="brand-mark"
      src={ascentMark}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
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
