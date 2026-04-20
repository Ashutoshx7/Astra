import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // better-sqlite3 is a native addon — it CANNOT be bundled by Vite/Rollup.
      // We keep it external so the compiled main.js does: require('better-sqlite3')
      // electron-forge's AutoUnpackNativesPlugin + asarUnpack ensures the module
      // is physically present in app.asar.unpacked/node_modules/better-sqlite3/
      external: [
        'better-sqlite3',
        // Also externalize electron itself and Node builtins
        'electron',
      ],
    },
    // Ensure the output format is CommonJS (required for native addons)
    commonjsOptions: {
      ignoreDynamicRequires: true,
    },
  },
});
