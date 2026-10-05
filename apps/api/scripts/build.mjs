// Bundle the API into dist/server.js. Workspace packages (@repo/*) ship TypeScript source,
// so they are bundled in; third-party packages stay external and load from node_modules.
import { build } from 'esbuild';

const externalNpmPackages = {
  name: 'external-npm-packages',
  setup(pluginBuild) {
    const bundled = /^(@\/|@config\/|@repo\/)/;
    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => (bundled.test(args.path) ? undefined : { path: args.path, external: true }));
  },
};

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  plugins: [externalNpmPackages],
  logLevel: 'info',
});
