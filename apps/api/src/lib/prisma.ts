// Load and validate env before the shared client reads DATABASE_URL.
import '@config/env.js';
import { prisma } from '@repo/database';

export { prisma };
