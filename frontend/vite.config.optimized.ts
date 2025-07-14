import { defineConfig, splitVendorChunkPlugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Split vendor chunks for better caching
    splitVendorChunkPlugin(),
    // Gzip compression
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // Brotli compression
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    // Bundle analyzer (only in analyze mode)
    process.env.ANALYZE && visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    
    // Minification options
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    
    // Output configuration
    rollupOptions: {
      output: {
        // Manual chunk splitting strategy
        manualChunks: (id) => {
          // Split node_modules into vendor chunks
          if (id.includes('node_modules')) {
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            
            // UI libraries
            if (id.includes('@radix-ui') || id.includes('class-variance-authority') || 
                id.includes('tailwind') || id.includes('clsx')) {
              return 'ui-vendor';
            }
            
            // Form and validation
            if (id.includes('react-hook-form') || id.includes('zod')) {
              return 'form-vendor';
            }
            
            // Date utilities
            if (id.includes('date-fns')) {
              return 'date-vendor';
            }
            
            // Socket.io
            if (id.includes('socket.io')) {
              return 'socket-vendor';
            }
            
            // Chart libraries
            if (id.includes('recharts') || id.includes('d3')) {
              return 'chart-vendor';
            }
            
            // Everything else from node_modules
            return 'vendor';
          }
          
          // Split large application modules
          if (id.includes('src/pages/')) {
            const module = id.split('src/pages/')[1].split('/')[0];
            return `page-${module}`;
          }
          
          if (id.includes('src/components/')) {
            if (id.includes('src/components/ui/')) {
              return 'components-ui';
            }
            return 'components';
          }
          
          if (id.includes('src/services/')) {
            return 'services';
          }
        },
        
        // Asset file naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          
          if (/woff2?|ttf|otf|eot/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          
          return `assets/[name]-[hash][extname]`;
        },
        
        // Chunk file naming
        chunkFileNames: 'js/[name]-[hash].js',
        
        // Entry file naming
        entryFileNames: 'js/[name]-[hash].js',
      },
    },
    
    // Source map configuration
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Asset inlining threshold
    assetsInlineLimit: 4096, // 4kb
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'socket.io-client',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
    ],
    exclude: ['@vite/client', '@vite/env'],
  },
  
  // Server configuration
  server: {
    // Enable HMR
    hmr: true,
    
    // Pre-transform known heavy dependencies
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/pages/**/*.tsx',
      ],
    },
  },
  
  // CSS configuration
  css: {
    // CSS modules
    modules: {
      localsConvention: 'camelCase',
    },
    
    // PostCSS configuration (for Tailwind)
    postcss: {
      plugins: [
        // Tailwind and Autoprefixer are already configured in postcss.config.js
      ],
    },
  },
  
  // Performance hints
  esbuild: {
    // Drop console and debugger in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    
    // Legal comments
    legalComments: 'none',
  },
})