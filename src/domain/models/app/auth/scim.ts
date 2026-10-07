/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SsoProviderIdSchema, envSecretReference } from './sso/sso-fields'

/**
 * SCIM 2.0 Provisioning Configuration
 *
 * Lets an identity provider (Okta, Entra ID, Google Workspace, JumpCloud…)
 * create, update and deactivate the app's users and their group memberships
 * through the SCIM 2.0 endpoints mounted under `/api/scim/v2/`.
 *
 * - `token`: the bearer token the identity provider presents, as an `$env.`
 *   reference. A request carrying anything else answers 404 — the endpoints do
 *   not admit to existing.
 * - `providers`: the `auth.sso` providers provisioned accounts sign in
 *   through. A provisioned account and the SSO identity with the same email are
 *   one account, never two.
 *
 * Deactivation (`active: false`) signs the user out everywhere and blocks
 * sign-in; it erases nothing — erasure stays the account-deletion flow's. SCIM
 * groups map to the groups declared in `auth.groups`, by name: config stays
 * the source of truth for which groups exist. Every SCIM write is recorded in
 * the audit log.
 *
 * @example
 * ```yaml
 * auth:
 *   strategies:
 *     - type: emailAndPassword
 *   sso:
 *     - id: okta
 *       type: oidc
 *       label: Sign in with Okta
 *       oidc: { issuer: https://acme.okta.com, clientId: $env.OKTA_CLIENT_ID, clientSecret: $env.OKTA_CLIENT_SECRET }
 *   scim:
 *     token: $env.SCIM_TOKEN
 *     providers: [okta]
 * ```
 */
export const ScimConfigSchema = Schema.Struct({
  token: envSecretReference(
    'The bearer token the identity provider sends, as an $env. reference. Any other token answers 404.'
  ),
  providers: Schema.optional(
    Schema.Array(SsoProviderIdSchema).pipe(
      Schema.annotate({
        description:
          'The auth.sso providers provisioned accounts sign in through. A provisioned account and the SSO identity with the same email are one account.',
        examples: [['okta']],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    title: 'SCIM provisioning',
    description:
      'SCIM 2.0 user and group provisioning under /api/scim/v2/, authenticated by a bearer token from the environment. Deactivating a user signs them out and blocks sign-in; it erases nothing.',
    examples: [{ token: '$env.SCIM_TOKEN', providers: ['okta'] }],
  })
)

/** @public */
export type ScimConfig = Schema.Schema.Type<typeof ScimConfigSchema>
