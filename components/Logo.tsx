export default function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <g transform="translate(6,6)">
        <path d="M74 36 L24 100 L74 164" fill="none" stroke="#3a3468" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M126 36 L176 100 L126 164" fill="none" stroke="#3a3468" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 94.1 66.5 L 105.7 88.3 L 130.0 84.0 L 112.9 101.8 L 124.5 123.6 L 102.3 112.8 L 85.1 130.6 L 88.5 106.1 L 66.3 95.3 L 90.6 91.0 Z" fill="#3a3468" />
      </g>

      <path d="M74 36 L24 100 L74 164" fill="none" stroke="#3a3468" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M126 36 L176 100 L126 164" fill="none" stroke="#3a3468" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />

      <path d="M74 36 L24 100 L74 164" fill="none" stroke="#503fcb" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M126 36 L176 100 L126 164" fill="none" stroke="#503fcb" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />

      <path
        d="M 94.1 66.5 L 105.7 88.3 L 130.0 84.0 L 112.9 101.8 L 124.5 123.6 L 102.3 112.8 L 85.1 130.6 L 88.5 106.1 L 66.3 95.3 L 90.6 91.0 Z"
        fill="#b87502"
        stroke="#3a3468"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
