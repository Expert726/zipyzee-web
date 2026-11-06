/** The ZipyZee mark: a lime page with a folded green corner (the app's lime/ZipyMark; brand colours, both themes). */
export function ZipyMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="zm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#CFF26B" />
          <stop offset="1" stopColor="#E9F5BE" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#121212" />
      <path d="M9 7h10l5 5v13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" fill="url(#zm)" />
      <path d="M19 7v5h5z" fill="#5FA336" />
      <path d="M12 15h8l-8 6h8" stroke="#121212" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
