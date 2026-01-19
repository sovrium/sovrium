/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { relations } from 'drizzle-orm'
import { text, boolean, timestamp, pgSchema, index, uniqueIndex } from 'drizzle-orm/pg-core'

// Better Auth schema - isolated from main app schema
// All auth tables are created in the "auth" PostgreSQL schema
export const authSchema = pgSchema('auth')

// Better Auth Tables (using native table names in dedicated auth schema)
// Schema isolation prevents conflicts when users create their own tables
export const users = authSchema.table('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  // Admin plugin fields
  role: text('role'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  // Two-factor plugin fields
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
})

export const sessions = authSchema.table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Admin plugin fields
    impersonatedBy: text('impersonated_by'),
    // Organization plugin fields
    activeOrganizationId: text('active_organization_id'),
    // Teams feature fields
    activeTeamId: text('active_team_id'),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
)

export const accounts = authSchema.table(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
)

export const verifications = authSchema.table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
)

// Organization plugin tables
export const organizations = authSchema.table(
  'organization',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logo: text('logo'),
    metadata: text('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('organization_slug_uidx').on(table.slug)]
)

export const members = authSchema.table(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').default('member').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('member_organizationId_idx').on(table.organizationId),
    index('member_userId_idx').on(table.userId),
  ]
)

export const invitations = authSchema.table(
  'invitation',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Teams feature field (optional - for team-specific invitations)
    teamId: text('team_id'),
  },
  (table) => [
    index('invitation_organizationId_idx').on(table.organizationId),
    index('invitation_email_idx').on(table.email),
  ]
)

// Teams feature tables
export const teams = authSchema.table('team', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const teamMembers = authSchema.table('team_member', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Dynamic access control table (custom roles per organization)
export const organizationRoles = authSchema.table('role', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  permission: text('permission'), // Better Auth expects 'permission' (singular)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

// Two-factor plugin table
export const twoFactors = authSchema.table(
  'two_factor',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
  },
  (table) => [
    index('twoFactor_secret_idx').on(table.secret),
    index('twoFactor_userId_idx').on(table.userId),
  ]
)

// Drizzle Relations (for type-safe joins)
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  members: many(members),
  invitations: many(invitations),
  twoFactors: many(twoFactors),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(members),
  invitations: many(invitations),
  teams: many(teams),
}))

export const membersRelations = relations(members, ({ one }) => ({
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),
}))

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  inviter: one(users, {
    fields: [invitations.inviterId],
    references: [users.id],
  }),
}))

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  teamMembers: many(teamMembers),
}))

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}))

export const organizationRolesRelations = relations(organizationRoles, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationRoles.organizationId],
    references: [organizations.id],
  }),
}))

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, {
    fields: [twoFactors.userId],
    references: [users.id],
  }),
}))

// Type inference
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Verification = typeof verifications.$inferSelect
export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type Member = typeof members.$inferSelect
export type NewMember = typeof members.$inferInsert
export type Invitation = typeof invitations.$inferSelect
export type NewInvitation = typeof invitations.$inferInsert
export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
export type TeamMember = typeof teamMembers.$inferSelect
export type NewTeamMember = typeof teamMembers.$inferInsert
export type OrganizationRole = typeof organizationRoles.$inferSelect
export type NewOrganizationRole = typeof organizationRoles.$inferInsert
export type TwoFactor = typeof twoFactors.$inferSelect
export type NewTwoFactor = typeof twoFactors.$inferInsert
