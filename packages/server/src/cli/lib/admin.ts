import bcrypt from 'bcryptjs';
import { and, asc, eq, or } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

import { createDb, schema, type UrucDb } from '../../core/database/index.js';
import { resolveFromPackageRoot } from '../../runtime-paths.js';
import { AdminService } from '../../core/admin/service.js';
import { loadServerEnv } from './env.js';

export interface AdminUserSummary {
  id: string;
  username: string;
  email: string | null;
  role: string;
  banned: number | null;
  createdAt: Date;
}

export interface AdminAgentSummary {
  id: string;
  name: string;
  userId: string;
  ownerName: string | null;
  isShadow: boolean;
  frozen: number | null;
  isOnline: boolean | null;
}

function openDb(dbPath?: string): UrucDb {
  if (!dbPath) loadServerEnv();
  return createDb(resolveCliDbPath(dbPath));
}

function resolveCliDbPath(dbPath?: string): string | undefined {
  if (!dbPath || dbPath === ':memory:') return dbPath;
  return resolveFromPackageRoot(dbPath);
}

type AdminUsersResult = Awaited<ReturnType<AdminService['getAllUsers']>>;

export async function listAdmins(): Promise<AdminUserSummary[]> {
  const db = openDb();
  return await db.select({
    id: schema.users.id,
    username: schema.users.username,
    email: schema.users.email,
    role: schema.users.role,
    banned: schema.users.banned,
    createdAt: schema.users.createdAt,
  }).from(schema.users).where(eq(schema.users.role, 'admin')).orderBy(asc(schema.users.username));
}

export async function createAdmin(username: string, password: string, email: string): Promise<{ created: boolean; reason?: string }> {
  const db = openDb();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.username, username));
  if (existing) return { created: false, reason: '用户名已存在' };
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(schema.users).values({
    id: nanoid(),
    username,
    email,
    passwordHash,
    role: 'admin',
    emailVerified: true,
    createdAt: new Date(),
  });
  return { created: true };
}

export async function promoteUser(target: string): Promise<{ id: string; username: string }> {
  const db = openDb();
  const user = await resolveUser(target);
  await db.update(schema.users).set({ role: 'admin' }).where(eq(schema.users.id, user.id));
  return { id: user.id, username: user.username };
}

export async function resetAdminPassword(target: string, password: string): Promise<{ id: string; username: string }> {
  const db = openDb();
  const user = await resolveUser(target);
  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, user.id));
  return { id: user.id, username: user.username };
}

export async function listUsers(search?: string): Promise<AdminUsersResult> {
  const db = openDb();
  const service = new AdminService(db);
  return service.getAllUsers(search, 100, 0);
}

export async function banUser(target: string, banned: boolean): Promise<{ id: string; username: string }> {
  const db = openDb();
  const service = new AdminService(db);
  const user = await resolveUser(target);
  await service.banUser(user.id, banned);
  return { id: user.id, username: user.username };
}

export async function listAgents(): Promise<AdminAgentSummary[]> {
  const db = openDb();
  const service = new AdminService(db);
  const rows = await service.getAllAgents();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    userId: row.userId,
    ownerName: row.ownerName ?? null,
    isShadow: !!row.isShadow,
    frozen: row.frozen ?? 0,
    isOnline: row.isOnline ?? false,
  }));
}

export async function freezeAgent(target: string, frozen: boolean): Promise<{ id: string; name: string }> {
  const db = openDb();
  const service = new AdminService(db);
  const agent = await resolveAgent(target);
  await service.freezeAgent(agent.id, frozen);
  return { id: agent.id, name: agent.name };
}

export async function adminExists(username: string, dbPath?: string): Promise<boolean> {
  const db = openDb(dbPath);
  const [user] = await db.select().from(schema.users).where(and(eq(schema.users.username, username), eq(schema.users.role, 'admin')));
  return !!user;
}

export async function getUserRole(username: string, dbPath?: string): Promise<string | null> {
  const db = openDb(dbPath);
  const [user] = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.username, username));
  return user?.role ?? null;
}

export async function resolveAdminPasswordState(username: string, password: string, dbPath?: string): Promise<'missing' | 'match' | 'mismatch'> {
  const db = openDb(dbPath);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
  if (!user) return 'missing';
  const matches = await bcrypt.compare(password, user.passwordHash);
  return matches ? 'match' : 'mismatch';
}

export async function kickAgent(target: string): Promise<{ success: boolean; message: string }> {
  loadServerEnv();
  const agent = await resolveAgent(target);
  const admin = await getPreferredAdmin();
  if (!admin) {
    return { success: false, message: '找不到可用管理员账号来生成本地管理 token' };
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { success: false, message: 'JWT_SECRET 未配置，无法生成管理 token' };
  }
  const token = jwt.sign({ userId: admin.id, role: 'admin' }, secret, { expiresIn: '7d' });
  const baseUrl = process.env.BASE_URL && process.env.BASE_URL.trim() !== ''
    ? process.env.BASE_URL.replace(/\/$/, '')
    : `http://127.0.0.1:${process.env.PORT ?? '3000'}`;
  const endpoint = `${baseUrl}/api/admin/agents/${agent.id}/kick`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      return { success: false, message: `kick failed with HTTP ${res.status}` };
    }
    return { success: true, message: `Agent ${agent.name} 已踢下线` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function resolveUser(target: string, dbPath?: string) {
  const db = openDb(dbPath);
  const matches = await db.select({
    id: schema.users.id,
    username: schema.users.username,
    role: schema.users.role,
  }).from(schema.users).where(or(eq(schema.users.id, target), eq(schema.users.username, target)));

  if (matches.length === 0) throw new Error(`用户不存在: ${target}`);
  if (matches.length > 1) throw new Error(`用户标识不唯一: ${target}`);
  return matches[0]!;
}

async function resolveAgent(target: string, dbPath?: string) {
  const db = openDb(dbPath);
  const matches = await db.select({
    id: schema.agents.id,
    name: schema.agents.name,
  }).from(schema.agents).where(or(eq(schema.agents.id, target), eq(schema.agents.name, target)));

  if (matches.length === 0) throw new Error(`Agent 不存在: ${target}`);
  if (matches.length > 1) throw new Error(`Agent 标识不唯一: ${target}`);
  return matches[0]!;
}

async function getPreferredAdmin() {
  const db = openDb();
  const configuredUsername = process.env.ADMIN_USERNAME;
  if (configuredUsername) {
    const [configured] = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users)
      .where(and(eq(schema.users.username, configuredUsername), eq(schema.users.role, 'admin')));
    if (configured) return configured;
  }
  const [fallback] = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users)
    .where(eq(schema.users.role, 'admin')).orderBy(asc(schema.users.username));
  return fallback ?? null;
}
