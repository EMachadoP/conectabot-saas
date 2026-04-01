import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      new Date().toISOString()
    ),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    {
      name: "app-version-manifest",
      generateBundle() {
        const version =
          process.env.VERCEL_GIT_COMMIT_SHA ||
          process.env.GITHUB_SHA ||
          new Date().toISOString();

        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify(
            {
              version,
              generatedAt: new Date().toISOString(),
            },
            null,
            2
          ),
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
