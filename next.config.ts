import type { NextConfig } from "next";
import { ISOLATED_TOOLS } from "./src/lib/isolated";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // no Next.js "N" badge in the corner while developing (it never shows on the live site); errors still open the
  // full-screen error overlay
  devIndicators: false,
  // The tools that run a big model in the browser (src/lib/isolated.ts) get cross-origin isolation, which lets
  // ONNX Runtime's WebAssembly use several CPU cores (about 3x faster than one). Only these pages: isolation stops
  // cross-origin iframes and popups (reCAPTCHA, Google sign-in) that Zee and Make with Zee will need. "credentialless"
  // keeps cross-origin downloads (the models from Hugging Face) working; browsers that don't know it just stay
  // single-core.
  async headers() {
    return ISOLATED_TOOLS.map((id) => ({
      source: `/:lang/tools/${id}`,
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
      ],
    }));
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
