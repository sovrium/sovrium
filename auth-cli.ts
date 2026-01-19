/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Better Auth CLI Configuration
 *
 * This file is used by `bunx @better-auth/cli generate` to generate
 * the Better Auth database schema with all plugins activated.
 *
 * Usage:
 *   bunx @better-auth/cli generate --config auth-cli.ts
 *
 * IMPORTANT: Keep this in sync with src/infrastructure/auth/better-auth/auth.ts
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, organization, twoFactor } from 'better-auth/plugins'
import { magicLink } from 'better-auth/plugins/magic-link'
import {
  users,
  sessions,
  accounts,
  verifications,
  organizations,
  members,
  invitations,
  teams,
  teamMembers,
  organizationRoles,
  twoFactors,
} from './src/infrastructure/auth/better-auth/schema'
import { db } from './src/infrastructure/database'

/**
 * Schema mapping for Better Auth's drizzle adapter
 *
 * IMPORTANT: Keys must be Better Auth's internal model names,
 * NOT custom table names. Actual table names come from pgTable() definitions.
 */
const drizzleSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  organization: organizations,
  member: members,
  invitation: invitations,
  team: teams,
  teamMember: teamMembers,
  role: organizationRoles,
  twoFactor: twoFactors,
}

/**
 * Better Auth instance with ALL plugins enabled for schema generation
 */
export const auth = betterAuth({
  // Required environment variables
  secret: process.env.BETTER_AUTH_SECRET || 'dummy-secret-for-cli-generation',
  baseURL: process.env.BETTER_AUTH_BASE_URL || 'http://localhost:3000',

  // Database adapter with custom schema
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: false,
    schema: drizzleSchema,
  }),

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      console.log(`Password reset for ${user.email}: ${url}`)
    },
  },

  // Email verification
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`Email verification for ${user.email}: ${url}`)
    },
  },

  // User settings
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, newEmail, url }) => {
        console.log(`Email change for ${user.email} to ${newEmail}: ${url}`)
      },
    },
  },

  // Social providers (all major providers)
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || '',
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID || '',
      clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
    },
  },

  // Plugins - ALL enabled for complete schema generation
  plugins: [
    // Admin plugin for user management
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
      impersonationSessionDuration: 60 * 60, // 1 hour
    }),

    // Organization plugin for multi-tenancy
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
      sendInvitationEmail: async ({ email, invitation, organization }) => {
        console.log(
          `Organization invitation for ${email} to ${organization.name}: ${invitation.id}`
        )
      },
    }),

    // Two-factor authentication plugin
    twoFactor({
      issuer: 'Sovrium',
      totpWindow: 1,
      backupCodeLength: 10,
      backupCodeCount: 10,
    }),

    // Magic link plugin for passwordless authentication
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        console.log(`Magic link for ${email}: ${url}`)
      },
    }),
  ],

  // Security settings
  trustedOrigins: ['*'],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    disableCSRFCheck: process.env.NODE_ENV !== 'production',
  },

  // Rate limiting
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
    customRules: {
      '/admin/*': {
        window: 1,
        max: 2,
      },
    },
  },
})
