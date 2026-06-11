import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/main.js',
      fileName: () => '[name].js',
      formats: ['es'],
    },
  },
});
