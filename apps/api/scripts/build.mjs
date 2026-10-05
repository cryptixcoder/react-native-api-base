// Bundle the API entry points into dist/. Workspace packages (dependencies declared as "workspace:*")
// ship TypeScript source, so they are bundled in; third-party packages stay external and load
// from node_modules.
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const workspacePackages = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter(([, version]) => String(version).startsWith('workspace:'))
  .map(([name]) => name);

const isBundled = (specifier) =>
  specifier.startsWith('@/') ||
  specifier.startsWith('@config/') ||
  workspacePackages.some((name) => specifier === name || specifier.startsWith(`${name}/`));

const externalNpmPackages = {
  name: 'external-npm-packages',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => (isBundled(args.path) ? undefined : { path: args.path, external: true }));
  },
};

await build({
  entryPoints: ['src/server.ts', 'src/worker.ts'],
  outdir: 'dist',
  bundle: true,
  splitting: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  plugins: [externalNpmPackages],
  logLevel: 'info',
});
