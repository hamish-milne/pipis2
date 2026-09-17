import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        main: "index.html",
        docs: "docs.html",
      },
    },
  },
});
