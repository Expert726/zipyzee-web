'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { canGoBack } from './history';

/** "‹ PDF tools": back to the page you came from (same filter and scroll), or to `href` when you arrived here first. */
export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (!canGoBack() || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        router.back();
      }}
      className="inline-flex items-center gap-1 text-sm font-medium text-secondary hover:text-text"
    >
      <ChevronLeft size={18} className="flip-rtl" aria-hidden="true" />
      {label}
    </Link>
  );
}
