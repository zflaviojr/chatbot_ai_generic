import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      legacy({
        targets: ['defaults', 'not IE 11']
      })
    ],
    build: {
      outDir: 'dist',
      sourcemap: isProduction ? false : true,
      minify: isProduction ? 'terser' : false,
      cssMinify: isProduction,
      rollupOptions: {
        input: {
          main: 'src/index.js'
        },
        output: {
          // Code splitting for better caching
          manualChunks: {
            vendor: ['ws'],
            utils: [
              'src/utils/PerformanceOptimizer.js',
              'src/utils/LazyLoader.js',
              'src/utils/TouchGestureHandler.js',
              'src/utils/AccessibilityManager.js',
              'src/utils/PWAInstaller.js'
            ]
          },
          // Asset naming for better caching
          chunkFileNames: isProduction ? 'assets/js/[name]-[hash].js' : 'assets/js/[name].js',
          entryFileNames: isProduction ? 'assets/js/[name]-[hash].js' : 'assets/js/[name].js',
          assetFileNames: isProduction ? 'assets/[ext]/[name]-[hash].[ext]' : 'assets/[ext]/[name].[ext]'
        }
      },
      // Production optimizations
      terserOptions: isProduction ? {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      } : undefined,
      // Bundle size analysis
      reportCompressedSize: isProduction,
      chunkSizeWarningLimit: 500
    },
    server: {
      port: 3000,
      open: true
    },
    preview: {
      port: 3000
    },
    // Environment variables
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __PROD__: isProduction
    },
    // CSS optimization
    css: {
      devSourcemap: !isProduction
    }
  };
});