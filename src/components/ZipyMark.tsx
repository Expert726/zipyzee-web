import { useId } from 'react';

/**
 * The ZipyZee logo (the app's assets/brand/svg/zipyzee-icon.svg, the same as the favicon in src/app): a lime rounded
 * square, a white page with a green folded corner, a black Z. Brand colours, the same in both themes.
 */
export function ZipyMark({ size = 32 }: { size?: number }) {
  const g = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#CFF26B" />
          <stop offset="1" stopColor="#E9F5BE" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${g})`} />
      <path d="M144 86H316L396 166V398A28 28 0 0 1 368 426H144A28 28 0 0 1 116 398V114A28 28 0 0 1 144 86Z" fill="#FFFFFF" />
      <path d="M316 86V138A28 28 0 0 0 344 166H396Z" fill="#5FA336" />
      <path d="M176 188H336V226L236 324H336V364H176V326L276 228H176Z" fill="#121212" />
    </svg>
  );
}
