'use client';
// A person's or group's round initials (the app's ui/Avatar, colours from src/chat/format.ts avatarColor); the
// ZipyZee Team chat shows the brand mark.
import { Users } from 'lucide-react';
import { avatarColor, initials } from '@/chat/format';
import { ZipyMark } from '../ZipyMark';

export function Avatar({ uid, name, team, group, size = 40 }: { uid: string; name: string; team?: boolean; group?: boolean; size?: number }) {
  if (team)
    return (
      <span className="shrink-0 rounded-full bg-category-tint grid place-items-center" style={{ width: size, height: size }} aria-hidden="true">
        <ZipyMark size={size * 0.6} />
      </span>
    );
  const c = avatarColor(uid);
  return (
    <span className="shrink-0 rounded-full grid place-items-center font-semibold" style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.36 }} aria-hidden="true">
      {group ? <Users size={size * 0.45} /> : initials(name || '?')}
    </span>
  );
}
