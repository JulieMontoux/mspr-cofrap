import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/function": {
        target: "http://192.168.1.45:8080",
        changeOrigin: true,
      }
    }
  }
})
