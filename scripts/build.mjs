#!/usr/bin/env node
// Build script for Vercel:
// 1. prisma generate (always — required for types and client)
// 2. prisma migrate deploy (best-effort — warns on failure, doesn't block build)
// 3. nuxt build (strict — fails the deploy if Nuxt fails)
import { execSync } from 'node:child_process';

function run(cmd, { required = true } = {}) {
  console.log(`[build] $ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (required) {
      console.error(`[build] FAILED: ${msg}`);
      process.exit(1);
    }
    console.warn(`[build] WARNING (non-fatal): ${msg}`);
    return false;
  }
}

run('npx prisma generate', { required: true });

const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.DIRECT_URL);
if (hasDbUrl) {
  run('npx prisma migrate deploy', { required: false });
} else {
  console.warn('[build] Skipping migrate: no DATABASE_URL or DIRECT_URL');
}

run('npx nuxt build', { required: true });
