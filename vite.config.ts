import { defineConfig } from "vite"
import { resolve } from "path"
import checker from "vite-plugin-checker"
import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"

export default defineConfig(() => ({
  // Use relative paths - works everywhere including GitHub Pages
  base: "./",
  resolve: {
    alias: {
      "@game": resolve(__dirname, "src/burgershop"),
      "@": resolve(__dirname, "src"),
    },
  },
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d"],
  },
  server: {
    port: 3033,
    host: "0.0.0.0", // This allows external connections
    open: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    target: "esnext",
    assetsInlineLimit: 0,
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 2
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('three')) {
              return 'three';
            }
            if (id.includes('rapier')) {
              return 'rapier';
            }
            if (id.includes('stowkit')) {
              return 'stowkit';
            }
            return 'vendor';
          }
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
  },
  // Copy public assets to build directory
  publicDir: "public",
  plugins: [
      wasm(),
      topLevelAwait(),
      // TypeScript checking disabled - d.ts declaration issues cause false errors
      // checker({ typescript: true }),
  ],
}))
