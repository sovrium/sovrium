/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { claimName, envSecretReference, httpUrl } from './sso-fields'

/**
 * OpenID Connect settings. Endpoints are discovered from
 * `<issuer>/.well-known/openid-configuration`; the ID token is verified against
 * the issuer's published keys.
 */
export const SsoOidcConfigSchema = Schema.Struct({
  issuer: httpUrl(
    'The issuer URL. Endpoints and signing keys are discovered from <issuer>/.well-known/openid-configuration, and the ID token issuer must equal it.',
    ['https://acme.okta.com', 'https://login.microsoftonline.com/<tenant>/v2.0']
  ),
  clientId: Schema.String.pipe(
    Schema.annotate({
      description:
        'The client id issued by the provider. Not a secret; may be a literal or an $env. reference.',
      examples: ['0oa1b2c3d4', '$env.ACME_OIDC_CLIENT_ID'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  clientSecret: envSecretReference(
    'The client secret issued by the provider, as an $env. reference. A literal is refused.'
  ),
  scopes: Schema.optional(
    Schema.Array(claimName('One scope.')).pipe(
      Schema.annotate({
        description:
          'Scopes requested at the authorization endpoint. openid is always sent, whether listed or not.',
        defaultNote: "['openid', 'email', 'profile']",
        examples: [['openid', 'email', 'profile', 'groups']],
      })
    )
  ),
  pkce: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        description: 'Send a PKCE (S256) code challenge with the authorization request.',
        defaultNote: 'true',
      })
    )
  ),
  claimMapping: Schema.optional(
    Schema.Struct({
      email: Schema.optional(
        claimName(
          'The claim holding the email address. Map only a claim your provider verifies: an existing account is linked only when the provider asserts email_verified.',
          ['preferred_username']
        )
      ),
      name: Schema.optional(claimName('The claim holding the display name.', ['display_name'])),
      image: Schema.optional(claimName('The claim holding the picture URL.', ['avatar_url'])),
    }).pipe(
      Schema.annotate({
        description:
          'Which claims carry the email, display name and picture, when the provider does not use the standard email, name and picture.',
        examples: [{ email: 'preferred_username', name: 'display_name' }],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    title: 'OIDC settings',
    description: 'OpenID Connect settings for an identity provider of type oidc.',
  })
)

/** @public */
export type SsoOidcConfig = Schema.Schema.Type<typeof SsoOidcConfigSchema>
