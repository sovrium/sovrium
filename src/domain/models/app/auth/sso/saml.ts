/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { claimName, httpUrl } from './sso-fields'

/**
 * SAML 2.0 settings. Sovrium is the service provider; the identity provider is
 * described either by its metadata XML, or by its entity id, sign-in URL and
 * signing certificate.
 */
export const SsoSamlConfigSchema = Schema.Struct({
  metadata: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'The identity provider metadata XML, inline or as an $env. reference. When set, entityId, entryPoint and cert are read from it.',
        examples: ['$env.ACME_SAML_METADATA'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  entityId: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'The identity provider entity id (its Issuer). Required without metadata.',
        examples: ['http://www.okta.com/exk1a2b3c4'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  entryPoint: Schema.optional(
    httpUrl(
      'The identity provider single sign-on URL the browser is sent to. Required without metadata.',
      ['https://acme.okta.com/app/sovrium/exk1a2b3c4/sso/saml']
    )
  ),
  cert: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'The identity provider signing certificate (PEM), inline or as an $env. reference. Responses not signed by it are refused. Required without metadata.',
        examples: ['$env.ACME_SAML_CERT'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  spEntityId: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'The entity id Sovrium announces as service provider, and the audience assertions must carry.',
        defaultNote: '<BASE_URL>/api/auth/sso/saml2/sp/metadata?providerId=<id>',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  attributeMapping: Schema.optional(
    Schema.Struct({
      email: Schema.optional(claimName('The attribute holding the email address.', ['mail'])),
      name: Schema.optional(claimName('The attribute holding the display name.', ['displayName'])),
      firstName: Schema.optional(claimName('The attribute holding the first name.', ['givenName'])),
      lastName: Schema.optional(claimName('The attribute holding the last name.', ['sn'])),
    }).pipe(
      Schema.annotate({
        description:
          'Which assertion attributes carry the email and the name. Without it the email is read from the email attribute (else the NameID), and the name from firstName and lastName (else displayName).',
        examples: [
          {
            email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
            firstName: 'givenName',
            lastName: 'sn',
          },
        ],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    title: 'SAML settings',
    description:
      'SAML 2.0 settings for an identity provider of type saml: metadata, or entityId + entryPoint + cert.',
  })
)

/** @public */
export type SsoSamlConfig = Schema.Schema.Type<typeof SsoSamlConfigSchema>
