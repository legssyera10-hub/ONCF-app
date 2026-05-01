import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-router-dom") || id.includes("\\react\\") || id.includes("\\react-dom\\")) {
              return "react-vendor";
            }
            if (id.includes("leaflet") || id.includes("react-leaflet")) {
              return "map-vendor";
            }
            if (id.includes("three") || id.includes("@react-three") || id.includes("@dimforge")) {
              return "three-vendor";
            }
          }
        },
      },
    },
  },
});
