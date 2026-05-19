/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { relations } from 'drizzle-orm'
import {
  accounts,
  invitations,
  members,
  oauthAccessTokens,
  oauthClients,
  oauthConsents,
  oauthRefreshTokens,
  organizations,
  sessions,
  teamMembers,
  teams,
  twoFactors,
  users,
} from './schema-tables'

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  twoFactors: many(twoFactors),
  members: many(members),
  teamMembers: many(teamMembers),
  oauthClients: many(oauthClients),
  oauthRefreshTokens: many(oauthRefreshTokens),
  oauthAccessTokens: many(oauthAccessTokens),
  oauthConsents: many(oauthConsents),
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

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, {
    fields: [twoFactors.userId],
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
  members: many(teamMembers),
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

export const oauthClientsRelations = relations(oauthClients, ({ one, many }) => ({
  user: one(users, {
    fields: [oauthClients.userId],
    references: [users.id],
  }),
  refreshTokens: many(oauthRefreshTokens),
  accessTokens: many(oauthAccessTokens),
  consents: many(oauthConsents),
}))

export const oauthRefreshTokensRelations = relations(oauthRefreshTokens, ({ one, many }) => ({
  client: one(oauthClients, {
    fields: [oauthRefreshTokens.clientId],
    references: [oauthClients.id],
  }),
  session: one(sessions, {
    fields: [oauthRefreshTokens.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [oauthRefreshTokens.userId],
    references: [users.id],
  }),
  accessTokens: many(oauthAccessTokens),
}))

export const oauthAccessTokensRelations = relations(oauthAccessTokens, ({ one }) => ({
  client: one(oauthClients, {
    fields: [oauthAccessTokens.clientId],
    references: [oauthClients.id],
  }),
  session: one(sessions, {
    fields: [oauthAccessTokens.sessionId],
    references: [sessions.id],
  }),
  refreshToken: one(oauthRefreshTokens, {
    fields: [oauthAccessTokens.refreshId],
    references: [oauthRefreshTokens.id],
  }),
  user: one(users, {
    fields: [oauthAccessTokens.userId],
    references: [users.id],
  }),
}))

export const oauthConsentsRelations = relations(oauthConsents, ({ one }) => ({
  user: one(users, {
    fields: [oauthConsents.userId],
    references: [users.id],
  }),
  client: one(oauthClients, {
    fields: [oauthConsents.clientId],
    references: [oauthClients.id],
  }),
}))
