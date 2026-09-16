import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [TanStackRouterVite(), react(), tailwindcss(), tsconfigPaths()],
  // Production builds ship no debug output and no source maps.
  esbuild:
    mode === "production"
      ? { drop: ["debugger"], pure: ["console.debug", "console.log"] }
      : undefined,
  build: {
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": "/src",
      "@deriv/core": "/packages/core/src/index.ts",
    },
  },
  server: {
    port: 8080,
    host: true,
  },
}));
