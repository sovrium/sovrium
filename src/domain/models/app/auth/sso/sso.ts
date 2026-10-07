/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SsoOidcConfigSchema } from './oidc'
import { SsoSamlConfigSchema } from './saml'
import { EmailDomainSchema, SsoProviderIdSchema, claimName } from './sso-fields'
import { validateSsoProvider } from './sso-validation'

/**
 * Role mapping: which Sovrium role an SSO user receives, read from one claim
 * (OIDC) or attribute (SAML) at every sign-in.
 */
export const SsoRoleMappingSchema = Schema.Struct({
  claim: claimName(
    'The claim or attribute holding the value to map — a string, or a list such as groups.',
    ['groups', 'department', 'memberOf']
  ),
  map: Schema.Record(Schema.String, Schema.String).pipe(
    Schema.annotate({
      description:
        'Claim value → role name. Entries are tried in the order written; the first value the user carries decides. Only an entry written here can grant an admin role.',
      examples: [{ 'it-admins': 'admin', staff: 'member', contractors: 'viewer' }],
    })
  ),
  default: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'The role given when no entry matches. Never an admin role. Defaults to auth.defaultRole.',
        examples: ['viewer'],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    title: 'SSO role mapping',
    description:
      'Map a claim or attribute to a Sovrium role. Applied at every sign-in, so the identity provider stays the source of truth.',
  })
)

/** @public */
export type SsoRoleMapping = Schema.Schema.Type<typeof SsoRoleMappingSchema>

/**
 * One identity provider, declared in config. Providers live in config only:
 * there is no runtime registration endpoint, and a provider cannot be added,
 * changed or removed over HTTP.
 */
export const SsoProviderSchema = Schema.Struct({
  id: SsoProviderIdSchema,
  type: Schema.Literals(['oidc', 'saml']).pipe(
    Schema.annotate({
      description: 'The protocol: oidc (OpenID Connect) or saml (SAML 2.0).',
    })
  ),
  label: Schema.String.pipe(
    Schema.annotate({
      description:
        'The text of the sign-in button for this provider. Supports $t:key translation references.',
      examples: ['Sign in with Okta', 'Acme corporate account', '$t:auth.sso.acme'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  domains: Schema.optional(
    Schema.Array(EmailDomainSchema).pipe(
      Schema.annotate({
        description:
          'Email domains this provider is authoritative for. A sign-in that starts from an email address in one of them is routed here, and an existing account with such an address is linked on first SSO sign-in.',
        examples: [['acme.com', 'acme.fr']],
      })
    )
  ),
  oidc: Schema.optional(SsoOidcConfigSchema),
  saml: Schema.optional(SsoSamlConfigSchema),
  roleMapping: Schema.optional(SsoRoleMappingSchema),
  allowSignUp: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        description:
          'Whether a first sign-in creates an account. false admits only accounts that already exist — invited, created by an admin, or provisioned through SCIM.',
        defaultNote: 'auth.allowSignUp, itself true by default',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'SsoProvider',
    title: 'SSO identity provider',
    description:
      'One single sign-on identity provider. type oidc takes an oidc block, type saml a saml block.',
    examples: [
      {
        id: 'okta',
        type: 'oidc' as const,
        label: 'Sign in with Okta',
        domains: ['acme.com'],
        oidc: {
          issuer: 'https://acme.okta.com',
          clientId: '$env.OKTA_CLIENT_ID',
          clientSecret: '$env.OKTA_CLIENT_SECRET',
        },
      },
    ],
  }),
  Schema.check(Schema.makeFilter((provider) => validateSsoProvider(provider) ?? true))
)

/** @public */
export type SsoProvider = Schema.Schema.Type<typeof SsoProviderSchema>

/** The `auth.sso` list. */
export const AuthSsoConfigSchema = Schema.Array(SsoProviderSchema).pipe(
  Schema.annotate({
    title: 'Single sign-on',
    description:
      'Identity providers users can sign in with, over OpenID Connect or SAML 2.0. Declared in config only — providers cannot be registered at runtime.',
  })
)

/** @public */
export type AuthSsoConfig = Schema.Schema.Type<typeof AuthSsoConfigSchema>
