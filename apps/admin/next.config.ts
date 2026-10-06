import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Self-contained server for Docker (see Dockerfile). Trace from the monorepo root so workspace
  // dependencies hoisted outside this app are included.
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  poweredByHeader: false,
};

export default nextConfig;
