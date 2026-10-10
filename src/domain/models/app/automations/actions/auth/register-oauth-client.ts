/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Auth Register OAuth Client Action (type: auth, operator: registerOAuthClient)
 *
 * Register a sign-in client of this app's OpenID Connect provider for one
 * other app — the client a platform creates for every app it hosts, so that
 * app's admins can sign in with their platform account.
 *
 * Only the name and the return address are chosen. Everything else is fixed,
 * because one shape is what such a client needs and every other one is a way
 * to misuse it: a confidential client (it holds a secret) that skips the
 * consent screen, requires PKCE, uses the `authorization_code` grant only,
 * asks for `openid email profile` only, returns to exactly `redirectUri`, and
 * is never a client of the app's MCP server.
 *
 * Output: `{ clientId, clientSecret }`. The secret is recorded as `***` in the
 * run history.
 */
export const AuthRegisterOAuthClientActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('registerOAuthClient').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    name: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Name of the client: the app it signs in, usually its address. Shown to operators, never to the person signing in, since the client skips consent',
      })
    ),
    redirectUri: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The one address the client returns to after sign-in, matched exactly: an absolute https URL without a fragment (http on a loopback host only). Any other rendered value fails the step and registers nothing',
        examples: [
          'https://{{trigger.data.record.slug}}.cloud.example.com/api/auth/callback/sovrium-cloud',
        ],
      })
    ),
  }).annotate({
    description: 'The client to register: its name and its exact return address.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthRegisterOAuthClientAction',
    title: 'Auth Register OAuth Client Action',
    description:
      'Register a consent-less, PKCE-only sign-in client for another app, returning its client id and secret',
  })
)

/** @public */
export type AuthRegisterOAuthClientAction = Schema.Schema.Type<
  typeof AuthRegisterOAuthClientActionSchema
>
