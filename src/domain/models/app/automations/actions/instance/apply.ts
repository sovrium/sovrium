/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { InstanceSlugSchema, literalOrWholeTemplate, wholeTemplate } from './instance-slug'

/**
 * A revision names the directory a release is written to
 * (`<SOVRIUM_INSTANCES_DIR>/<slug>/rev-<revision>`), so it is held to a
 * filename-safe shape: no `/`, no leading `.`, at most 64 characters.
 */
export const INSTANCE_REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/** An environment variable name the release's env file may set. */
export const INSTANCE_ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/

const BundleSourceSchema = Schema.Union([
  Schema.Struct({
    objectKey: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Storage key of the bundle archive — one this app uploaded, or one another app wrote into a shared bucket: the object’s size is read from the store and no catalog row is required (supports template variables)',
      })
    ),
  }),
  Schema.Struct({
    base64: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The bundle archive itself, base64-encoded (supports template variables). For small bundles; prefer objectKey',
      })
    ),
  }),
]).annotate({
  description:
    'Where the bundle archive written by `sovrium bundle` comes from: a storage key, or the archive inline as base64',
})

const BundleSignatureSchema = Schema.Struct({
  keyId: TemplateStringSchema.pipe(
    Schema.annotate({
      description:
        'Identifier of the public key in SOVRIUM_BUNDLE_PUBLIC_KEYS that verifies the signature',
    })
  ),
  algorithm: Schema.Literal('ed25519').pipe(
    Schema.annotate({ description: "Signature algorithm: always 'ed25519'" })
  ),
  value: TemplateStringSchema.pipe(
    Schema.annotate({
      description:
        'Base64 detached Ed25519 signature over the exact bytes of the bundle’s manifest.json',
    })
  ),
}).annotate({
  description:
    'Detached signature over the bundle manifest. The release is written only if it verifies',
})

const EnvValuesSchema = Schema.Union([
  // The key is checked by a filter on the whole record, not by the key schema:
  // `Schema.Record` silently DROPS a key its key schema refuses, which would
  // turn a misspelt variable into a missing one instead of a refusal.
  Schema.Record(
    Schema.String.annotate({ description: 'Variable name, UPPER_SNAKE_CASE' }),
    Schema.String.annotate({ description: 'Variable value, on one line' }).check(
      Schema.isPattern(/^[^\n\r\0]*$/)
    )
  ).check(
    Schema.makeFilter((values: Readonly<Record<string, string>>) => {
      const bad = Object.keys(values).find((key) => !INSTANCE_ENV_KEY_PATTERN.test(key))
      return bad === undefined
        ? undefined
        : `environment variable names are UPPER_SNAKE_CASE (got "${bad}")`
    })
  ),
  wholeTemplate('One whole {{template}} resolving to an object of variables'),
]).annotate({
  description:
    'Environment the app runs with, written to its env file (mode 0640), each value double-quoted and escaped so it reaches the app unchanged. Names are UPPER_SNAKE_CASE; a value holding a line break is refused. PORT is the loopback port the instance listens on, which health probes',
})

/**
 * Instance Apply Action (type: instance, operator: apply)
 *
 * Writes a new release of a supervised app and restarts it. In order, and
 * stopping at the first failure with nothing written:
 *
 * 1. reads the bundle (`objectKey` from this app's storage, or `base64`);
 * 2. verifies `signature` over the exact bytes of its `manifest.json` against
 *    the key `keyId` names in `SOVRIUM_BUNDLE_PUBLIC_KEYS`;
 * 3. checks every entry against the manifest's sizes and sha256s;
 * 4. writes `<SOVRIUM_INSTANCES_DIR>/<slug>/rev-<revision>/` under a temporary
 *    name and renames it into place, then points `current` at it, writes
 *    `env` (0640) and `status.json`;
 * 5. restarts `sovrium-app@<slug>.service`.
 *
 * Applying the revision `current` already points at is a no-op
 * (`applied: false`) — the reconcile loop calls this on every tick.
 */
export const InstanceApplyActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('apply').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: InstanceSlugSchema,
    bundle: BundleSourceSchema,
    signature: BundleSignatureSchema,
    revision: literalOrWholeTemplate(
      INSTANCE_REVISION_PATTERN,
      'a revision of 1 to 64 letters, digits, ".", "_" and "-", not starting with "." or "-"',
      'Revision identifier of the release, used as its directory name rev-<revision>: 1 to 64 letters, digits, ".", "_" and "-", not starting with "." or "-", or one whole {{template}} resolving to one'
    ),
    env: EnvValuesSchema,
  }).annotate({
    description:
      'The app to update, its signed bundle, the revision it becomes, and the environment it runs with.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceApplyAction',
    title: 'Instance Apply Action',
    description:
      'Verify a signed bundle, write it as a new release of a supervised app, and restart the app',
  })
)

/** @public */
export type InstanceApplyAction = Schema.Schema.Type<typeof InstanceApplyActionSchema>
