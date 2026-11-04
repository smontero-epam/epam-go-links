import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const apiServer = "http://localhost:3000";

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": apiServer,
      "/go": apiServer,
      "/health": apiServer,
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  test: {
    // Vite's root is web/, but tests live at the project root.
    root: import.meta.dirname,
    include: ["test/**/*.test.ts"],
  },
});
