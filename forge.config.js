import { VitePlugin } from '@electron-forge/plugin-vite';

export default {
  packagerConfig: {
    // icon: './src/assets/icon', // TODO: add icon later
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          arch: 'x64',
        },
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['linux'],
    },
  ],
  plugins: [
    new VitePlugin({
      // main process code is native ESM — no vite bundling needed
      build: [
        {
          entry: 'src/main/main.js',
          target: 'main',
          config: 'vite.main.config.mjs',
        },
        {
          entry: 'src/main/preload.js',
          target: 'preload',
          config: 'vite.preload.config.mjs',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mjs',
        },
      ],
    }),
  ],
};
