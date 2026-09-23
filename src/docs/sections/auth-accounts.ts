/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import accountAvatarBody from '@/domain/models/app/auth/account-avatar.docs.md' with { type: 'file' }
import apiKeysBody from '@/domain/models/app/auth/api-keys.docs.md' with { type: 'file' }
import authInvitationsBody from '@/domain/models/app/auth/auth-invitations.docs.md' with { type: 'file' }
import authOauthServerBody from '@/domain/models/app/auth/auth-oauth-server.docs.md' with { type: 'file' }
import authSessionsBody from '@/domain/models/app/auth/auth-sessions.docs.md' with { type: 'file' }
import userManagementBody from '@/domain/models/app/auth/user-management.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

export const authAccounts = defineSection({
  slug: 'auth-accounts',
  title: 'Accounts',
  order: 7400,
  tab: 'auth',
  articles: [
    defineArticle({
      slug: 'auth-sessions',
      title: 'Sessions',
      description:
        'Understand server-managed sessions, inspection and revocation endpoints, and the active-scope session API for multi-tenant assignment switching.',
      keywords: [
        'sovrium',
        'sessions',
        'session management',
        'revoke session',
        'sign out',
        'active scope',
        'scopeTables',
        'user_access',
        'multi-tenant',
        'currentUser assignments',
      ],
      order: 7400,
      sidebarLabel: 'Sessions',
      body: authSessionsBody,
      documents: [],
      stories: [
        'US-AUTH-ACTIVE-SCOPE-SESSION',
        'US-AUTH-SESSION-MANAGEMENT-SESSION-INSPECTION-AND-SIGN-OUT',
        'US-AUTH-SESSION-MANAGEMENT-SESSION-REVOCATION',
      ],
    }),
    defineArticle({
      slug: 'api-keys',
      title: 'API Keys',
      description:
        'Self-service API keys — let a signed-in user mint, use and revoke their own long-lived credentials, and authenticate REST requests with the x-api-key header.',
      keywords: [
        'sovrium',
        'api keys',
        'x-api-key',
        'auth.apiKeys',
        'self-service credentials',
        'revoke key',
        'machine authentication',
        'script authentication',
        'key inherits role',
        'banned user',
      ],
      order: 7404,
      sidebarLabel: 'API Keys',
      body: apiKeysBody,
      documents: [],
      stories: ['US-AUTH-API-KEYS'],
    }),
    defineArticle({
      slug: 'user-management',
      title: 'User Management',
      description:
        'Provision the first admin from env vars, a one-time token, or the CLI — then create, list, and manage users through the authenticated admin API.',
      keywords: [
        'sovrium',
        'user management',
        'admin bootstrap',
        'AUTH_ADMIN_EMAIL',
        'one-time token',
        'bootstrap claim',
        'admin API',
        'create-user',
        'impersonate',
        'no manual database',
      ],
      order: 7410,
      sidebarLabel: 'User Management',
      body: userManagementBody,
      documents: [],
      stories: [
        'US-ACCOUNT-ACCOUNT-DELETION',
        'US-ACCOUNT-DATA-EXPORT',
        'US-ACCOUNT-ERASURE-COVERAGE',
        'US-ACCOUNT-PENDING-ERASURE',
        'US-USER-MGMT-ADMIN-BOOTSTRAP',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-001',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-002',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-003',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-004',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-005',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-006',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-007',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-008',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-009',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-010',
        'US-USER-MGMT-ADMIN-USER-MANAGEMENT-011',
      ],
    }),
    defineArticle({
      slug: 'auth-invitations',
      title: 'Invitations',
      description:
        'Onboard users passwordlessly — the admin invite endpoint, the single-use accept link, the role an invitee receives, and how invitations differ from create-user.',
      keywords: [
        'sovrium',
        'invitations',
        'invite-user',
        'accept-invitation',
        'passwordless onboarding',
        'single-use token',
        'role assignment',
        'defaultRole',
        'invitationTokenExpiry',
      ],
      order: 7414,
      sidebarLabel: 'Invitations',
      body: authInvitationsBody,
      documents: [],
      stories: [
        'US-AUTH-INVITATION-LIFECYCLE',
        'US-AUTH-SCOPED-INVITATIONS',
        'US-USER-MGMT-ADMIN-INVITATION-FLOW',
      ],
    }),
    defineArticle({
      slug: 'account-avatar',
      title: 'Profile Avatars',
      description:
        'Let a signed-in user upload their own profile picture — the two endpoints, where the picture is stored, and why the image URL cannot be set by hand.',
      keywords: [
        'sovrium',
        'avatar',
        'profile picture',
        'account avatar',
        'image upload',
        'content sniffing',
        'avatars bucket',
        'update-user',
      ],
      order: 7416,
      sidebarLabel: 'Profile Avatars',
      body: accountAvatarBody,
      documents: [],
      stories: ['US-ACCOUNT-AVATAR-UPLOAD'],
    }),
    defineArticle({
      slug: 'auth-oauth-server',
      title: 'OAuth Server',
      description:
        'Use Sovrium as an OAuth 2.1 / OIDC authorization server that issues tokens for downstream apps and MCP clients.',
      keywords: [
        'sovrium',
        'OAuth server',
        'OIDC',
        'OpenID Connect',
        'authorization server',
        'access token',
        'refresh token',
        'dynamic client registration',
        'MCP',
        'PKCE',
        'JWKS',
      ],
      order: 7420,
      sidebarLabel: 'OAuth Server',
      body: authOauthServerBody,
      documents: [],
      stories: ['US-AUTH-OAUTH-SERVER'],
    }),
  ],
})
