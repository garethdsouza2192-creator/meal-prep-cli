import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  server: {
    host: "0.0.0.0",
    port: 3001,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "192.168.86.25",
      "100.69.205.98",
      "meal-prep-cli.gareth-dsouza-2192.workers.dev",
    ],
  },
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react"],
  },
});
