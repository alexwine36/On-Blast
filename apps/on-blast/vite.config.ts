import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],

  // @ultralytics/yolo ships wasm-bindgen glue that resolves its .wasm via
  // `new URL(..., import.meta.url)`. Prebundling rewrites that and breaks it.
  optimizeDeps: {
    exclude: ["@ultralytics/yolo"],
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Rust rebuilds shouldn't retrigger the frontend watcher.
      ignored: ["**/src-tauri/**"],
    },
  },
}));
