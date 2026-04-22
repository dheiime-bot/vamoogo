import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Quebra o bundle em chunks por vendor para que o cache do navegador
        // seja melhor aproveitado e o JS inicial seja bem menor.
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("react-hook-form") || id.includes("zod") || id.includes("@hookform")) return "vendor-forms";
          if (id.includes("date-fns")) return "vendor-date";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("embla-carousel")) return "vendor-carousel";
          return "vendor";
        },
      },
    },
  },
}));
