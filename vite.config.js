import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    minify: true, // JS + CSS are minified (this is also the default)
    sourcemap: false, // don't ship source maps, so the original source isn't exposed
  },
});
