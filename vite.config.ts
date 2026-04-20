import path from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import createHtmlPlugin from "vite-plugin-simple-html";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      open: false,
      filename: "./dist/stats.html",
    }),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          mainScript: `src/main.tsx`,
        },
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        navigateFallback: null,           // SPA fallback przez .htaccess, nie SW
        cleanupOutdatedCaches: true,
      },
      manifest: false,
      // Wyłącz PWA w produkcji na podfolderze /alina/ — hash-fragment auth
      // flow Supabase nie współgra z service workerem na subpath.
      disable: true,
    }),
  ],
  define: {
    // Shim for legacy-v1 (CRM-ALINA) which reads process.env.API_KEY for Gemini.
    // Leave undefined → V1 code has `if (!process.env.API_KEY) return null` fallback.
    "process.env.API_KEY": JSON.stringify(process.env.GEMINI_API_KEY || ""),
    "process.env.GEMINI_API_KEY": JSON.stringify(process.env.GEMINI_API_KEY || ""),
    ...(process.env.NODE_ENV === "production" && process.env.VITE_SUPABASE_URL
      ? {
          "import.meta.env.VITE_IS_DEMO": JSON.stringify(process.env.VITE_IS_DEMO),
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.VITE_SUPABASE_URL),
          "import.meta.env.VITE_SB_PUBLISHABLE_KEY": JSON.stringify(process.env.VITE_SB_PUBLISHABLE_KEY),
          "import.meta.env.VITE_INBOUND_EMAIL": JSON.stringify(process.env.VITE_INBOUND_EMAIL),
          "import.meta.env.VITE_ATTACHMENTS_BUCKET": JSON.stringify(process.env.VITE_ATTACHMENTS_BUCKET),
        }
      : {}),
  },
  base: process.env.VITE_BASE_PATH || "/",
  esbuild: {
    keepNames: true,
  },
  build: {
    sourcemap: false,
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
