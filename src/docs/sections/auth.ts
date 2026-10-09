/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  AuthEmailTemplateSchema,
  AuthEmailTemplatesSchema,
  AuthSchema,
  AuthStrategySchema,
  EmailAndPasswordStrategySchema,
  MagicLinkStrategySchema,
  OAuthStrategySchema,
  PasskeysConfigSchema,
  ScimConfigSchema,
  SsoOidcConfigSchema,
  SsoProviderSchema,
  SsoSamlConfigSchema,
  TwoFactorConfigSchema,
} from '@/domain/models/app/auth'
import authEmailPasswordBody from '@/domain/models/app/auth/auth-email-password.docs.md' with { type: 'file' }
import authEmailTemplatesBody from '@/domain/models/app/auth/auth-email-templates.docs.md' with { type: 'file' }
import authOverviewBody from '@/domain/models/app/auth/auth-overview.docs.md' with { type: 'file' }
import authPasskeysBody from '@/domain/models/app/auth/auth-passkeys.docs.md' with { type: 'file' }
import authPasswordlessBody from '@/domain/models/app/auth/auth-passwordless.docs.md' with { type: 'file' }
import authRegistrationBody from '@/domain/models/app/auth/auth-registration.docs.md' with { type: 'file' }
import authScimBody from '@/domain/models/app/auth/auth-scim.docs.md' with { type: 'file' }
import authSocialOauthBody from '@/domain/models/app/auth/auth-social-oauth.docs.md' with { type: 'file' }
import authSsoBody from '@/domain/models/app/auth/auth-sso.docs.md' with { type: 'file' }
import authStrategiesBody from '@/domain/models/app/auth/auth-strategies.docs.md' with { type: 'file' }
import authTwoFactorBody from '@/domain/models/app/auth/auth-two-factor.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

export const auth = defineSection({
  slug: 'auth',
  title: 'Authentication',
  order: 7000,
  tab: 'auth',
  articles: [
    defineArticle({
      slug: 'auth-overview',
      title: 'Authentication Overview',
      description:
        'Enable built-in authentication, understand the auth config block, and learn the default roles that ship with every Sovrium app.',
      keywords: [
        'sovrium',
        'authentication',
        'auth config',
        'enable auth',
        'Better Auth',
        'default roles',
        'admin member viewer',
        'AUTH_SECRET',
        'BASE_URL',
      ],
      order: 7000,
      sidebarLabel: 'Overview',
      body: authOverviewBody,
      documents: [AuthSchema],
      stories: ['US-AUTH-ROLE-LANDING-ON-SUCCESS', 'US-AUTH-LOGIN-PAGE'],
    }),
    defineArticle({
      slug: 'auth-strategies',
      title: 'Strategies Overview',
      description:
        'The auth.strategies array — the three strategy types, how the discriminated union is validated, and how to pick the right one for your app.',
      keywords: [
        'sovrium',
        'auth strategies',
        'strategies array',
        'emailAndPassword',
        'magicLink',
        'oauth',
        'discriminated union',
        'duplicate types',
        'choosing a strategy',
      ],
      order: 7010,
      sidebarLabel: 'Strategies Overview',
      body: authStrategiesBody,
      documents: [AuthStrategySchema],
      stories: ['US-AUTH-AUTH-STRATEGIES', 'US-AUTH-SECURITY-ENFORCEMENT'],
    }),
    defineArticle({
      slug: 'auth-email-password',
      title: 'Email & Password',
      description:
        'The emailAndPassword strategy — password length bounds, email verification before sign-in, and automatic sign-in after sign-up.',
      keywords: [
        'sovrium',
        'emailAndPassword',
        'minPasswordLength',
        'maxPasswordLength',
        'requireEmailVerification',
        'autoSignIn',
        'password policy',
        'email verification',
      ],
      order: 7012,
      sidebarLabel: 'Email & Password',
      body: authEmailPasswordBody,
      documents: [EmailAndPasswordStrategySchema],
      stories: [
        'US-AUTH-EMAIL-PASSWORD-AUTH-CREDENTIALS-IDENTITY-LIFECYCLE',
        'US-AUTH-EMAIL-PASSWORD-AUTH-EMAIL-VERIFICATION-LIFECYCLE',
        'US-AUTH-PASSWORD-RECOVERY',
      ],
    }),
    defineArticle({
      slug: 'auth-passwordless',
      title: 'Magic Link & Email OTP',
      description:
        'The two passwordless flows — the magicLink strategy with its expiry, and email-OTP, which is enabled by defining a template rather than by a strategy entry.',
      keywords: [
        'sovrium',
        'magic link',
        'magicLink',
        'expirationMinutes',
        'email OTP',
        'emailOtp',
        'passwordless',
        'one-time code',
        'SMTP required',
      ],
      order: 7014,
      sidebarLabel: 'Magic Link & OTP',
      body: authPasswordlessBody,
      documents: [MagicLinkStrategySchema],
      stories: ['US-AUTH-MAGIC-LINK-AUTH'],
    }),
    defineArticle({
      slug: 'auth-social-oauth',
      title: 'Social & OAuth Providers',
      description:
        'The oauth strategy — the five supported identity providers, the environment variables their credentials load from, and how callback URLs are derived.',
      keywords: [
        'sovrium',
        'oauth strategy',
        'social login',
        'google',
        'github',
        'microsoft',
        'slack',
        'gitlab',
        'CLIENT_ID',
        'CLIENT_SECRET',
        'callback URL',
        'BASE_URL',
      ],
      order: 7016,
      sidebarLabel: 'Social & OAuth',
      body: authSocialOauthBody,
      documents: [OAuthStrategySchema],
      stories: [],
    }),
    defineArticle({
      slug: 'auth-registration',
      title: 'Registration Control',
      description:
        'Decide who may create an account — allowSignUp for public self-registration, and invitation gating with invitationTokenExpiry when it is closed.',
      keywords: [
        'sovrium',
        'allowSignUp',
        'self-registration',
        'disable signup',
        'invitation gating',
        'invitationTokenExpiry',
        'admin create-user',
        'closed registration',
      ],
      order: 7018,
      sidebarLabel: 'Registration Control',
      body: authRegistrationBody,
      documents: [],
      stories: ['US-AUTH-REGISTRATION-CONTROL'],
    }),
    defineArticle({
      slug: 'auth-email-templates',
      title: 'Email Templates',
      description:
        'Customize the subject and body of every authentication email — the eight templates, their $variable substitutions, and the one whose presence enables a flow.',
      keywords: [
        'sovrium',
        'emailTemplates',
        'verification',
        'resetPassword',
        'magicLink',
        'emailOtp',
        'invitation',
        'welcome',
        'accountDeletion',
        'twoFactorBackupCodes',
        'variable substitution',
      ],
      order: 7019,
      sidebarLabel: 'Email Templates',
      body: authEmailTemplatesBody,
      documents: [AuthEmailTemplatesSchema, AuthEmailTemplateSchema],
      stories: ['US-AUTH-EMAIL-TEMPLATES'],
    }),
    defineArticle({
      slug: 'auth-two-factor',
      title: 'Two-Factor Authentication',
      description:
        'Enable TOTP-based two-factor authentication with authenticator apps, configure the issuer and code format, and generate backup codes.',
      keywords: [
        'sovrium',
        'two-factor',
        '2FA',
        'TOTP',
        'authenticator app',
        'backup codes',
        'issuer',
        'digits',
        'period',
        'MFA',
      ],
      order: 7020,
      sidebarLabel: 'Two-Factor',
      body: authTwoFactorBody,
      documents: [TwoFactorConfigSchema],
      stories: ['US-AUTH-TWO-FACTOR-AUTH'],
    }),
    defineArticle({
      slug: 'auth-sso',
      title: 'Single Sign-On (OIDC & SAML)',
      description:
        'Declare OpenID Connect and SAML 2.0 identity providers in config — the sign-in buttons, email-domain routing, role mapping from a claim, and who may sign up.',
      keywords: [
        'sovrium',
        'single sign-on',
        'SSO',
        'OIDC',
        'OpenID Connect',
        'SAML',
        'Okta',
        'Entra ID',
        'Keycloak',
        'identity provider',
        'role mapping',
        'domains',
      ],
      order: 7022,
      sidebarLabel: 'Single Sign-On',
      body: authSsoBody,
      documents: [SsoProviderSchema, SsoOidcConfigSchema, SsoSamlConfigSchema],
      stories: [
        'US-AUTH-SSO-001',
        'US-AUTH-SSO-002',
        'US-AUTH-SSO-003',
        'US-AUTH-SSO-004',
        'US-AUTH-SSO-005',
        'US-AUTH-SSO-006',
      ],
    }),
    defineArticle({
      slug: 'auth-passkeys',
      title: 'Passkeys',
      description:
        'Enable passkey (WebAuthn) sign-in beside the other strategies — registering a passkey, the passkey sign-in button, and requiring one for administrators.',
      keywords: [
        'sovrium',
        'passkeys',
        'WebAuthn',
        'FIDO2',
        'passwordless',
        'security key',
        'rpName',
        'requireForAdmin',
      ],
      order: 7024,
      sidebarLabel: 'Passkeys',
      body: authPasskeysBody,
      documents: [PasskeysConfigSchema],
      stories: ['US-AUTH-PASSKEYS-001', 'US-AUTH-PASSKEYS-002', 'US-AUTH-PASSKEYS-003'],
    }),
    defineArticle({
      slug: 'auth-scim',
      title: 'SCIM Provisioning',
      description:
        'Let the identity provider create, update and deactivate users and group memberships over SCIM 2.0, authenticated by a bearer token from the environment.',
      keywords: [
        'sovrium',
        'SCIM',
        'SCIM 2.0',
        'provisioning',
        'deprovisioning',
        'joiners and leavers',
        'Okta',
        'Entra ID',
        'bearer token',
        'groups',
      ],
      order: 7026,
      sidebarLabel: 'SCIM Provisioning',
      body: authScimBody,
      documents: [ScimConfigSchema],
      stories: ['US-AUTH-SCIM-001', 'US-AUTH-SCIM-002', 'US-AUTH-SCIM-003'],
    }),
  ],
})
