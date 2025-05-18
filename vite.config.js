import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import rollupNodePolyFill from 'rollup-plugin-node-polyfills'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      stream: 'stream-browserify',
      buffer: 'buffer',
      util: 'util',
      process: 'process/browser',
    }
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  optimizeDeps: {
    include: ['buffer', 'process', 'stream-browserify', 'util'],
  },
  build: {
    rollupOptions: {
      plugins: [rollupNodePolyFill()],
    }
  }
})
