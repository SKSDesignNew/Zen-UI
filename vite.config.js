import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Cosmograph's compiled code references @/cosmograph/style.module.css
      // (a file they didn't ship). Stub it before our generic @/ alias matches.
      {
        find: '@/cosmograph/style.module.css',
        replacement: path.resolve(__dirname, './src/lib/cosmograph-stub.module.css'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});
