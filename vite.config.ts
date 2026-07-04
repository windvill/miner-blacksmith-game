import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        game: resolve(__dirname, 'game.html')
      }
    }
  },
  server: {
    port: 3000
  }
});
