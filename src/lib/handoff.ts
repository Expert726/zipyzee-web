'use client';
// "Continue to…": a result handed straight to the next tool, so nobody downloads and picks the file again. Kept in
// memory only (the files never leave the page) and taken by the next tool's flow when it opens.
let pending: { toolId: string; files: File[] } | null = null;

export function handOff(toolId: string, files: File[]) {
  pending = { toolId, files };
}

/** The files handed to this tool (read in a state initializer, which React may run twice: clear it after). */
export const peekHandoff = (toolId: string): File[] | null => (pending?.toolId === toolId ? pending.files : null);

/** Once the tool has them. */
export function clearHandoff(toolId: string) {
  if (pending?.toolId === toolId) pending = null;
}
