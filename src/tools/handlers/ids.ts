/** Tools that work on the web site now: each has a handler in ./index.ts. Kept apart so the registry stays light. */
export const WEB_TOOLS = new Set([
  'merge-pdf',
  'split-pdf',
  'rotate-pdf',
  'page-numbers',
  'images-to-pdf',
  'compress-image',
  'resize-image',
  'convert-image',
]);
