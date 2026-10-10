/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { deployRequestSchema } from '../automations'

/**
 * The app-address lookup `sovrium deploy` makes before it uploads anything.
 *
 * Like the rest of the deploy contract, no route of the engine serves it: the
 * cloud is an ordinary Sovrium app whose config declares an `app-address`
 * webhook (`POST /api/automations/app-address/webhook`, `auth: { type:
 * session }`, so a session or an `x-api-key`). The CLI posts the address it
 * means to deploy to — {@link appAddressRequestSchema} — and the cloud answers
 * whether that address is one of the caller's apps, free to create, taken by
 * another account, or not an address it accepts.
 *
 * - `200` {@link appAddressYoursSchema}: one of the caller's apps — the CLI
 *   deploys to it. Its variables come with it, by name and kind, never by
 *   value.
 * - `200` {@link appAddressFreeSchema}: nobody holds it — the CLI offers to
 *   create it, then creates it through the cloud's `new-app` form
 *   (`POST /api/forms/new-app/submissions`, `{ name, slug }`, same key).
 * - `409` / `422` {@link appAddressRefusalSchema}: taken by another account,
 *   or not an address the cloud accepts (its shape, or a reserved name). The
 *   CLI refuses before uploading.
 * - `404`: a cloud older than the lookup. The CLI skips it and deploys as it
 *   did before.
 */

/**
 * An address the cloud accepts: 3 to 28 lowercase letters, digits and inner
 * hyphens. 28 is the longest a fleet machine turns into its system user name
 * (`sa-<slug>`, 31 characters). The engine's own deploy rule
 * (`deployRequestSchema.app`) admits 2 characters for clouds of its own; the
 * address the CLI derives or creates holds to this one.
 *
 * @public
 */
export const APP_ADDRESS_PATTERN = /^[a-z0-9][a-z0-9-]{1,26}[a-z0-9]$/

/**
 * Addresses no app may take: they name, or could pass for, the platform's own
 * hosts. The CLI refuses them before it asks the cloud.
 *
 * @public
 */
export const RESERVED_APP_ADDRESSES = [
  'www',
  'api',
  'admin',
  'cloud',
  'app',
  'apps',
  'status',
  'docs',
  'mail',
] as const

/**
 * Body of the lookup: the address the CLI resolved — from `--app`, from the
 * project's link file, or derived from the config `name`.
 *
 * @public
 */
export const appAddressRequestSchema = Schema.Struct({
  slug: deployRequestSchema.fields.app,
})

/** @public */
export type AppAddressRequest = Schema.Schema.Type<typeof appAddressRequestSchema>

/**
 * One variable set on the app, as the lookup shows it: its name and kind,
 * never its value — a plain value included, since the answer lands in
 * terminals and logs.
 *
 * @public
 */
export const appVariableSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The variable, by name' }),
  kind: Schema.Literals(['plain', 'secret']).annotate({
    description:
      "'secret': readable by the operator only once saved; 'plain': readable by the owner",
  }),
})

/** @public */
export type AppVariable = Schema.Schema.Type<typeof appVariableSchema>

/**
 * The caller's app at that address.
 *
 * `id` and `liveDeployment` are read when the cloud sends them: `id` names the
 * app to its variables webhook (`?app=<id>`) and its page, `liveDeployment`
 * the deployment a redeploy reuses. A cloud that omits them answers the
 * lookup all the same.
 *
 * @public
 */
export const appAddressAppSchema = Schema.Struct({
  id: optionalField(
    Schema.String.annotate({
      description:
        "The app's record id in the cloud: what its variables webhook and its page are keyed by",
    }).check(Schema.isMinLength(1))
  ),
  slug: deployRequestSchema.fields.app,
  url: Schema.String.annotate({
    description: 'Address the app is served at once a deployment is live',
  }).check(Schema.isMinLength(1)),
  state: optionalField(
    Schema.NullOr(Schema.String).annotate({
      description:
        "What the app's machine last reported (for example 'no-deploy', 'live', 'stopped'), shown as written",
    })
  ),
  placed: Schema.Boolean.annotate({
    description:
      'Whether the cloud has put the app on a machine yet; a deployment to an app not yet placed waits for one',
  }),
  liveDeployment: optionalField(
    Schema.String.annotate({
      description:
        'Id of the deployment the app runs, once one went live; a redeploy names it to reuse its bundle',
    }).check(Schema.isMinLength(1))
  ),
}).annotate({ description: "One of the caller's apps" })

/** @public */
export type AppAddressApp = Schema.Schema.Type<typeof appAddressAppSchema>

/**
 * `200`: the address is one of the caller's apps.
 *
 * `envNames` lists the names of the variables set on the app, sorted, and
 * `env` the same with their kind. The CLI compares the names with the
 * variables the bundle's config requires and names the missing ones before it
 * uploads. A lookup that omits them leaves the cloud's intake as the only
 * check.
 *
 * @public
 */
export const appAddressYoursSchema = Schema.Struct({
  status: Schema.Literal('yours').annotate({
    description: "'yours': the address is one of the caller's apps",
  }),
  app: appAddressAppSchema,
  envNames: optionalField(
    Schema.Array(
      Schema.String.annotate({ description: 'Name of a variable set on the app' })
    ).annotate({
      description:
        'Names of the variables set on the app, sorted; never their values. Absent from a lookup that does not report them',
    })
  ),
  env: optionalField(
    Schema.Array(appVariableSchema).annotate({
      description: 'The variables set on the app, by name and kind; never their values',
    })
  ),
})

/** `200`: nobody holds the address; the caller may create it. @public */
export const appAddressFreeSchema = Schema.Struct({
  status: Schema.Literal('free').annotate({
    description: "'free': no app holds the address; the caller may create it",
  }),
  slug: deployRequestSchema.fields.app,
})

/**
 * The lookup's `200` answer.
 *
 * @public
 */
export const appAddressResponseSchema = Schema.Union([
  appAddressYoursSchema,
  appAddressFreeSchema,
]).annotate({ description: 'Whether the address is one of your apps, or free to create' })

/** @public */
export type AppAddressResponse = Schema.Schema.Type<typeof appAddressResponseSchema>

/**
 * The refusal codes of the lookup: `address-taken` (409), the address belongs
 * to another account; `invalid-address` (422), the cloud does not accept it —
 * its shape, or a name it keeps for itself.
 *
 * @public
 */
export const appAddressRefusalCodes = ['address-taken', 'invalid-address'] as const

/** `409` / `422`: the lookup's refusal. Nothing is created. @public */
export const appAddressRefusalSchema = Schema.Struct({
  error: Schema.Literals(appAddressRefusalCodes).annotate({
    description:
      "'address-taken' (409): another account holds the address; 'invalid-address' (422): the cloud does not accept it",
  }),
  message: optionalField(Schema.String.annotate({ description: 'Why, for a person' })),
})

/** @public */
export type AppAddressRefusal = Schema.Schema.Type<typeof appAddressRefusalSchema>

/**
 * Body the CLI submits to the cloud's `new-app` form to create the app it is
 * about to deploy to: the config `name` and the address. The form is the one
 * creation path and holds the one set of checks; it answers 201 with the new
 * row's `linkedRecordId`, and a field error on `slug` means another account
 * took the address in the meantime.
 *
 * @public
 */
export const newAppSubmissionSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The app name, as written in the config' }).check(
    Schema.isMinLength(1)
  ),
  slug: Schema.String.annotate({
    description: 'The address: 3 to 28 lowercase letters, digits and inner hyphens',
  }).check(Schema.isPattern(APP_ADDRESS_PATTERN)),
})

/** @public */
export type NewAppSubmission = Schema.Schema.Type<typeof newAppSubmissionSchema>

/**
 * The project's link file, `<config directory>/.sovrium/cloud.json`: which app
 * of which cloud this project deploys to. Written once a deployment is
 * accepted; read on the next `sovrium deploy` when no `--app` is given. It
 * never chooses the cloud: a link for another host is ignored.
 *
 * @public
 */
export const cloudLinkSchema = Schema.Struct({
  version: Schema.Literal(1).annotate({ description: 'Layout of this file' }),
  host: Schema.String.annotate({
    description: 'Origin of the cloud the app lives on, for example https://cloud.sovrium.com',
  }).check(Schema.isMinLength(1)),
  app: deployRequestSchema.fields.app,
  linkedAt: Schema.String.annotate({
    description: 'When the link was written (ISO 8601, UTC)',
  }).check(Schema.isMinLength(1)),
})

/** @public */
export type CloudLink = Schema.Schema.Type<typeof cloudLinkSchema>
