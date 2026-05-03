/**
 * Core Database Schema — only tables owned by core modules.
 *
 * Plugin tables are defined in each plugin's own schema file.
 * Core tables: users, pending_registrations, oauth_accounts, agents, permission_credentials, principal_backed_residents, domain_attachments, action_logs
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// === core/auth ===

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  email: text('email').unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  verificationCode: text('verification_code'),
  verificationCodeExpiresAt: integer('verification_code_expires_at', { mode: 'timestamp' }),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  banned: integer('banned').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const pendingRegistrations = sqliteTable('pending_registrations', {
  email: text('email').primaryKey(),
  verificationCode: text('verification_code').notNull(),
  verificationCodeExpiresAt: integer('verification_code_expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const oauthAccounts = sqliteTable('oauth_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(),
  providerId: text('provider_id').notNull(),
  email: text('email').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  token: text('token').notNull().unique(),
  isShadow: integer('is_shadow', { mode: 'boolean' }).notNull().default(false),
  trustMode: text('trust_mode', { enum: ['confirm', 'full'] }).notNull().default('confirm'),
  allowedLocations: text('allowed_locations').notNull().default('[]'),
  isOnline: integer('is_online', { mode: 'boolean' }).notNull().default(false),
  description: text('description'),

  avatarPath: text('avatar_path'),
  frozen: integer('frozen').notNull().default(0),
  searchable: integer('searchable').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// === core/permission ===

export const permissionCredentials = sqliteTable('permission_credentials', {
  id: text('id').primaryKey(),
  residentId: text('resident_id').notNull().references(() => agents.id),
  issuerId: text('issuer_id').notNull(),
  status: text('status', { enum: ['active', 'revoked'] }).notNull().default('active'),
  capabilities: text('capabilities').notNull(),
  issuedAt: integer('issued_at', { mode: 'timestamp' }).notNull(),
  validFrom: integer('valid_from', { mode: 'timestamp' }).notNull(),
  validUntil: integer('valid_until', { mode: 'timestamp' }),
});

export const principalBackedResidents = sqliteTable('principal_backed_residents', {
  residentId: text('resident_id').primaryKey().references(() => agents.id),
  accountablePrincipalId: text('accountable_principal_id').notNull().references(() => agents.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// === core/domain ===

export const domainAttachments = sqliteTable('domain_attachments', {
  id: text('id').primaryKey(),
  status: text('status', { enum: ['pending', 'attached', 'failed', 'detached'] }).notNull(),
  domainId: text('domain_id').notNull(),
  cityId: text('city_id').notNull(),
  pluginId: text('plugin_id').notNull(),
  venueModuleId: text('venue_module_id').notNull(),
  venueNamespace: text('venue_namespace').notNull(),
  protocolVersion: text('protocol_version').notNull(),
  endpoint: text('endpoint').notNull(),
  documentUrl: text('document_url').notNull(),
  capabilities: text('capabilities').notNull(),
  receiptCode: text('receipt_code').notNull(),
  receipt: text('receipt').notNull(),
  issuedAt: integer('issued_at', { mode: 'timestamp' }),
  validUntil: integer('valid_until', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// === core/logger ===

export const actionLogs = sqliteTable('action_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  agentId: text('agent_id').notNull(),
  locationId: text('location_id'),
  actionType: text('action_type').notNull(),
  payload: text('payload'),
  result: text('result', { enum: ['success', 'failure'] }).notNull(),
  detail: text('detail'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
