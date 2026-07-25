import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Cast process to any to avoid TS error: Property 'cwd' does not exist on type 'Process'
  const cwd = (process as any).cwd();
  const env = loadEnv(mode, cwd, "");
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [react()],
    define: {
      // BEZPIECZEŃSTWO (audyt 2026-07-25 K3): nie inline'uj klucza Gemini do bundla.
      // Stała "" — klucz ładuje się client-side z tenant_config (DEK) po haśle Aliny.
      "process.env.API_KEY": JSON.stringify(""),
      "process.env.GEMINI_API_KEY": JSON.stringify(""),
    },
    resolve: {
      alias: {
        "@": path.resolve(cwd, "."),
      },
    },
  };
});
