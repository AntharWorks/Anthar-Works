export function DropletMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <linearGradient id="aw-drop" x1="6" y1="2" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2dd4bf" />
          <stop offset="0.55" stopColor="#0d9488" />
          <stop offset="1" stopColor="#0e7490" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.2c.4 0 .77.2 1 .53 1.7 2.36 5.8 8.4 5.8 11.77a6.8 6.8 0 1 1-13.6 0c0-3.37 4.1-9.41 5.8-11.77.23-.33.6-.53 1-.53Z"
        fill="url(#aw-drop)"
      />
      <path
        d="M9.2 13.4c.2-1.5 1.2-2.9 2.5-3.7"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  className = '',
  mono = false,
}: {
  className?: string;
  mono?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <DropletMark />
      <span
        className={`font-display text-lg font-extrabold tracking-tight ${
          mono ? 'text-white' : 'text-slate-900'
        }`}
      >
        Anthar<span className={mono ? 'text-brand-200' : 'text-brand-600'}>Works</span>
      </span>
    </span>
  );
}
