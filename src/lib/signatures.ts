'use client';
// Saved signatures ("Save for next time", the app's signatureStore): PNG data URLs kept in this browser only.
import { useStored } from './useStored';

export type SavedSignature = { id: string; png: string; w: number; h: number };
const KEEP = 6;

export function useSignatures() {
  const [list, setList] = useStored<SavedSignature[]>('signatures', []);
  return {
    signatures: list,
    add: (s: SavedSignature) => setList((cur) => [s, ...cur.filter((x) => x.png !== s.png)].slice(0, KEEP)),
    remove: (id: string) => setList((cur) => cur.filter((x) => x.id !== id)),
  };
}
