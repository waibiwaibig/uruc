import type { UrucDb } from './core/database/index.js';
import { schema as coreSchema } from './core/database/index.js';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

const schema = { users: coreSchema.users };

/**
 * Seed default admin user from environment variables.
 *
 * Required env vars:
 *   ADMIN_USERNAME  (default: none — skips seeding if not set)
 *   ADMIN_PASSWORD  (required if ADMIN_USERNAME is set)
 *   ADMIN_EMAIL     (default: admin@localhost)
 */
export async function seedAdmin(db: UrucDb) {
  const username = process.env.ADMIN_USERNAME;
  if (!username) {
    // No admin configured — skip silently
    return;
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.warn('⚠ ADMIN_USERNAME is set but ADMIN_PASSWORD is missing — skipping admin seed');
    return;
  }

  const email = process.env.ADMIN_EMAIL ?? 'admin@localhost';

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.username, username));
  if (existing) {
    const passwordMatches = await bcrypt.compare(password, existing.passwordHash);
    if (!passwordMatches) {
      console.warn(
        `⚠ ADMIN_USERNAME "${username}" already exists and ADMIN_PASSWORD does not match. ` +
        'Existing account kept; password not overwritten.',
      );
    }
    if (existing.role !== 'admin') {
      console.warn(
        `⚠ ADMIN_USERNAME "${username}" exists but role="${existing.role}". ` +
        'Set role to admin manually if this account should be an administrator.',
      );
    }
    return;
  }

  const normalizedEmail = email.trim();
  if (normalizedEmail) {
    const [emailOwner] = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      role: schema.users.role,
    }).from(schema.users).where(eq(schema.users.email, normalizedEmail));
    if (emailOwner && emailOwner.username !== username) {
      console.warn(
        `⚠ ADMIN_EMAIL "${normalizedEmail}" already belongs to ${emailOwner.role} "${emailOwner.username}" — skipping admin seed.`,
      );
      return;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(schema.users).values({
    id: nanoid(), username, email, passwordHash,
    role: 'admin', emailVerified: true,
    createdAt: new Date(),
  });
  console.log(`Admin user "${username}" created`);
}
