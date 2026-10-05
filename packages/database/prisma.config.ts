import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Read lazily rather than with env(): `prisma generate` must work without a database
    // (CI, Docker builds, fresh clones). Commands that connect still fail clearly when it is unset.
    url: process.env.DATABASE_URL ?? '',
  },
});
