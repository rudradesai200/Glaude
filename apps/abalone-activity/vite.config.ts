import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

function requestLogger(): Plugin {
  return {
    name: "request-logger",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const upgrade = req.headers["upgrade"];
        const type = upgrade === "websocket" ? "WS" : "HTTP";
        console.log(`[vite] ${type} ${req.method ?? ""} ${req.url} (from: ${req.headers["origin"] ?? req.headers["host"] ?? "?"})`);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), requestLogger()],
  server: {
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      // @napi-rs/canvas is Node-only; the activity app never imports render.ts,
      // but guard against transitive pulls.
      external: ["@napi-rs/canvas"],
    },
  },
});
