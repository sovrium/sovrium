/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * A credential written as an environment reference, never as a literal.
 *
 * A literal secret in config is committed to git, reviewed in a pull request
 * and mirrored to any remote — three places it can never be recalled from. So
 * the shape itself refuses anything but `$env.NAME`; whether `NAME` is declared
 * in `app.env` is checked by the app-wide environment-reference rule, which
 * names the variable to declare.
 */
const ENV_SECRET_MESSAGE =
  "a secret must be an $env. reference (e.g. '$env.ACME_OIDC_CLIENT_SECRET'), never a literal — a literal secret in config is committed to git, reviewed in a pull request and mirrored to any remote"

/**
 * Build an environment secret reference carrying its own description. The
 * description is annotated BEFORE the pattern check, the only placement whose
 * prose survives to the published JSON Schema.
 */
export const envSecretReference = (description: string) =>
  Schema.String.pipe(
    Schema.annotate({
      title: 'Environment secret reference',
      description,
      examples: ['$env.ACME_OIDC_CLIENT_SECRET', '$env.SCIM_TOKEN'],
    }),
    Schema.check(Schema.isPattern(/^\$env\.[A-Z][A-Z0-9_]*$/, { message: ENV_SECRET_MESSAGE }))
  )

/**
 * The stable identifier of an identity provider. It appears in callback URLs
 * (`/api/auth/sso/callback/<id>`, `/api/auth/sso/saml2/sp/acs/<id>`), so
 * changing it breaks the redirect URI registered at the provider.
 */
export const SsoProviderIdSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'SSO provider id',
    description:
      'Stable identifier of the identity provider, used in its callback URL. Lowercase letters, digits and hyphens, starting with a letter. Changing it breaks the redirect URI registered at the provider.',
    examples: ['okta', 'entra-id', 'acme-saml'],
  }),
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]{0,62}$/))
)

/** An email domain, lowercase, without a leading `@`. */
export const EmailDomainSchema = Schema.String.pipe(
  Schema.annotate({
    description: 'An email domain, lowercase, without the @ (e.g. acme.com).',
    examples: ['acme.com', 'eu.acme.com'],
  }),
  Schema.check(
    Schema.isPattern(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/)
  )
)

/** An absolute http(s) URL carrying its own description and examples. */
export const httpUrl = (description: string, examples: readonly string[]) =>
  Schema.String.pipe(
    Schema.annotate({ description, examples: [...examples] }),
    Schema.check(Schema.isPattern(/^https?:\/\/[^\s/]+/))
  )

/** An identity-provider claim or attribute name. */
export const claimName = (description: string, examples: readonly string[] = []) =>
  Schema.String.pipe(
    Schema.annotate({ description, examples: [...examples] }),
    Schema.check(Schema.isMinLength(1))
  )
