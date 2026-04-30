import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator';

export default defineConfig(({ mode }) => ({
  plugins: [
    mode === 'obfuscated' && obfuscatorPlugin({
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 1,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        stringArray: true,
        stringArrayEncoding: ['rc4'],
        stringArrayThreshold: 1,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
      },
    }),
    viteSingleFile(),
  ],
  build: {
    outDir: mode === 'obfuscated' ? 'dist/obfuscated' : 'dist/plain',
  },
}));
