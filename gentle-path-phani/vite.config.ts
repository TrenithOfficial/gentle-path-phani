import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "::",
    port: 8080,
  },
  // ✅ Railway runs `vite preview` behind its own host, so allow it there.
  // This does NOT affect your local dev setup.
  preview: {
    host: true,
    port: Number(process.env.PORT) || 8080,
    allowedHosts: ["gentle-path-production.up.railway.app", ".up.railway.app"],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
