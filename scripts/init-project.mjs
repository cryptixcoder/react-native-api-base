#!/usr/bin/env node
/**
 * Turn a fresh clone of this starter into a named project.
 *
 *   pnpm init-project <name> [--display-name "Friendly App"] [--dry-run] [--force] [--skip-install]
 *
 * Example: `pnpm init-project friendly` renames
 *   - the workspace scope        @repo/database  → @friendly/database (package names, imports, lockfile, filters)
 *   - the app identity           myapp:// scheme, JWT issuer/audience, queue prefix → friendly
 *   - the Expo app               name → "Friendly", slug → friendly
 *   - the repo                   root package name, README title, docker compose project + container names
 *   - the email sender name      "My App <noreply@…>" → "Friendly <noreply@…>"
 *
 * Uses only Node built-ins so it runs right after cloning, before installing anything.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PLACEHOLDER_SCOPE = '@repo/';
const PLACEHOLDER_REPO_NAME = 'react-native-api-base';

// ---------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const options = { name: undefined, displayName: undefined, dryRun: false, force: false, skipInstall: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--skip-install') options.skipInstall = true;
    else if (arg === '--display-name') options.displayName = argv[++i];
    else if (arg.startsWith('--display-name=')) options.displayName = arg.slice('--display-name='.length);
    else if (arg === '--help' || arg === '-h') usage(0);
    else if (arg.startsWith('-')) fail(`Unknown option: ${arg}`);
    else if (!options.name) options.name = arg;
    else fail(`Unexpected argument: ${arg}`);
  }

  if (!options.name) usage(1);
  return options;
}

function usage(code) {
  console.log('Usage: pnpm init-project <name> [--display-name "Friendly App"] [--dry-run] [--force] [--skip-install]');
  console.log('  <name>  lowercase letters, digits and dashes, e.g. "friendly" → @friendly/database, friendly:// links');
  process.exit(code);
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const titleCase = (value) =>
  value
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');

// ---------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------

const SKIP_PATHS = [/^specs\//, /(^|\/)node_modules\//, /\/src\/generated\//, /^scripts\/init-project\.mjs$/];
const BINARY_EXTENSIONS = /\.(png|jpe?g|gif|webp|ico|icns|svg|ttf|otf|woff2?|mp4|mov|zip|gz|jar|keystore|p12|jks)$/i;

function listFiles() {
  const output = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' });
  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => !SKIP_PATHS.some((pattern) => pattern.test(file)) && !BINARY_EXTENSIONS.test(file));
}

function readText(file) {
  try {
    const content = readFileSync(join(ROOT, file), 'utf8');
    return content.includes('\0') ? null : content;
  } catch {
    return null; // Deleted but still tracked, or unreadable.
  }
}

// ---------------------------------------------------------------------------------------------
// Replacements
// ---------------------------------------------------------------------------------------------

function buildReplacements({ name, displayName }) {
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return [
    // The README's "Starting a new project from this template" section only applies to the template itself.
    {
      label: 'template-only README section',
      files: /^README\.md$/,
      pattern: /^## Starting a new project from this template\n[\s\S]*?\n---\n\n/m,
      replacement: '',
    },
    { label: 'template-only README section', files: /^README\.md$/, pattern: /^- \[Starting a new project from this template\]\(#[^)]*\)\n/m, replacement: '' },
    // Workspace scope: package names, imports, tsconfig extends, pnpm --filter, lockfile importers.
    { label: '@repo/ scope', pattern: new RegExp(escapeRegExp(PLACEHOLDER_SCOPE), 'g'), replacement: `@${name}/` },
    // README title before the generic repo-name replacement below.
    { label: 'README title', files: /^README\.md$/, pattern: new RegExp(`^# ${escapeRegExp(PLACEHOLDER_REPO_NAME)}$`, 'm'), replacement: `# ${displayName}` },
    { label: 'repo name', pattern: new RegExp(escapeRegExp(PLACEHOLDER_REPO_NAME), 'g'), replacement: name },
    // App identity: myapp:// deep links + app.json scheme, JWT issuer/audience (myapp-api), queue prefix.
    { label: 'myapp identity', pattern: /\bmyapp\b/g, replacement: name },
    { label: 'email sender name', pattern: /\bMy App </g, replacement: `${displayName} <` },
    // Docker: compose project name and machine-global container names.
    { label: 'compose project', files: /^docker-compose\.ya?ml$/, pattern: /^name: .+$/m, replacement: `name: ${name}` },
    {
      label: 'container names',
      files: /^docker-compose\.ya?ml$/,
      pattern: /^(\s*container_name:\s*)(\S+)$/gm,
      replacement: (match, prefix, container) => (container.startsWith(`${name}-`) ? match : `${prefix}${name}-${container}`),
    },
  ];
}

function applyReplacements(file, content, replacements, counts) {
  let next = content;

  for (const rule of replacements) {
    if (rule.files && !rule.files.test(file)) continue;
    const matches = next.match(new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`));
    if (!matches) continue;
    next = next.replace(rule.pattern, rule.replacement);
    counts[rule.label] = (counts[rule.label] ?? 0) + (rule.pattern.flags.includes('g') ? matches.length : 1);
  }

  return next;
}

/** Structured edits for the Expo app config (display name + slug). */
function updateExpoConfig(content, { name, displayName }) {
  const config = JSON.parse(content);
  config.expo.name = displayName;
  config.expo.slug = name;
  return `${JSON.stringify(config, null, 2)}\n`;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

const options = parseArgs(process.argv.slice(2));
const name = options.name.toLowerCase();

if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(name) || name.includes('--')) {
  fail(`"${options.name}" is not a valid project name. Use lowercase letters, digits and single dashes (e.g. "friendly" or "friendly-app").`);
}
if (name === 'repo' || name === 'myapp') {
  fail(`"${name}" is the placeholder name; pick your project's name.`);
}

const displayName = options.displayName?.trim() || titleCase(name);

const rootPackage = readText('package.json') ?? '';
if (!rootPackage.includes(`"name": "${PLACEHOLDER_REPO_NAME}"`) && !rootPackage.includes(PLACEHOLDER_SCOPE)) {
  fail('This repository has already been initialized (no placeholder names left).');
}

if (!options.dryRun && !options.force) {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status) fail('Your git working tree has uncommitted changes. Commit or stash them first, or pass --force.');
}

console.log(`\n${options.dryRun ? '[dry run] ' : ''}Initializing "${displayName}" (scope @${name}/, scheme ${name}://)\n`);

const replacements = buildReplacements({ name, displayName });
const totals = {};
const changedFiles = [];

for (const file of listFiles()) {
  const content = readText(file);
  if (content === null) continue;

  const counts = {};
  let next = applyReplacements(file, content, replacements, counts);
  if (file === 'apps/mobile/app.json') {
    const updated = updateExpoConfig(next, { name, displayName });
    if (updated !== next) counts['Expo name/slug'] = 1;
    next = updated;
  }

  if (next === content) continue;

  changedFiles.push(file);
  for (const [label, count] of Object.entries(counts)) totals[label] = (totals[label] ?? 0) + count;
  const summary = Object.entries(counts)
    .map(([label, count]) => `${label} ×${count}`)
    .join(', ');
  console.log(`  ${options.dryRun ? 'would update' : 'updated'}  ${file}  (${summary})`);

  if (!options.dryRun) writeFileSync(join(ROOT, file), next);
}

console.log(`\n${changedFiles.length} files ${options.dryRun ? 'would change' : 'changed'}:`);
for (const [label, count] of Object.entries(totals)) console.log(`  - ${label}: ${count}`);

if (options.dryRun) {
  console.log('\nDry run only; nothing was written.\n');
  process.exit(0);
}

if (!options.skipInstall) {
  console.log('\nRelinking workspace packages (pnpm install)…\n');
  const install = spawnSync('pnpm', ['install'], { cwd: ROOT, stdio: 'inherit' });
  if (install.status !== 0) fail('pnpm install failed; fix the error above and run it again.');
}

console.log(`
✔ "${displayName}" is ready. Next steps:

  1. Review the changes:          git diff
  2. Copy env files:              cp packages/database/.env.example packages/database/.env
                                  cp apps/api/.env.example apps/api/.env   (set JWT_ACCESS_SECRET)
                                  cp apps/mobile/.env.example apps/mobile/.env
  3. Start infrastructure:        docker compose up -d db redis
  4. Create the database schema:  pnpm db:migrate
  5. Run everything:              pnpm dev
`);
