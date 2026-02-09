import react from "@vitejs/plugin-react";
import path from "path";
import {defineConfig} from "vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        target: "esnext",
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, "index.html"),
                "recording-popup": path.resolve(__dirname, "recording-popup.html"),
            },
        },
    },
    clearScreen: false,
    server: {
        port: 1421,
        strictPort: true,
    },
});
