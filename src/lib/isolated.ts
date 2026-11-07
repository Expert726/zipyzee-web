// Tools that run a big model in the browser (ormbg, LaMa, Swin2SR). Their pages are served cross-origin isolated
// (next.config.ts headers), which lets ONNX Runtime's WebAssembly use several CPU cores (about 3x faster than one).
export const ISOLATED_TOOLS = ['remove-bg', 'change-bg', 'passport-photo', 'sticker-maker', 'object-eraser', 'upscale-image'];

/**
 * Next.js moves between pages without reloading, so a tool page reached from another page doesn't get the headers.
 * Reloads it once (true when it does). Not when a file was handed over ("Continue to…" keeps it in memory), and only
 * once per page per tab, so a browser that can't be isolated (Safari without "credentialless") never loops.
 */
export function isolateOnce(toolId: string, handed: boolean): boolean {
  if (!ISOLATED_TOOLS.includes(toolId) || typeof window === 'undefined') return false;
  const key = `isolate:${location.pathname}`;
  try {
    if (globalThis.crossOriginIsolated) {
      sessionStorage.removeItem(key);
      return false;
    }
    if (handed || sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    return false;
  }
  location.reload();
  return true;
}
