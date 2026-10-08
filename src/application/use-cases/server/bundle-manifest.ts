/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { isoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * `manifest.json` of a deployable bundle — the archive `sovrium bundle` writes
 * and a host verifies before it deploys anything.
 *
 * A bundle is DATA, not code: `project/app.json` is the config RESOLVED and
 * VALIDATED by the engine that wrote it (every `$ref` inlined, never
 * TypeScript), beside the static `public/**` tree and the `seed/**` files. The
 * manifest lists every other entry with its size and sha256, so a reader can
 * refuse a truncated or altered archive before it trusts a single byte.
 *
 * It is an archive format rather than an app property: it travels between
 * processes — the CLI that writes it and the host that reads it — and is never
 * part of the config itself. It sits beside `backup-manifest.ts`, the other
 * archive format the CLI writes, for the same reason that one does: no HTTP
 * route of the engine serves it, so it is not an `api/` wire contract.
 *
 * Changing a field here changes a file format hosts keep for years. Add
 * optional fields; never rename or remove one without a `formatVersion` bump.
 */

export const BUNDLE_FORMAT = 'sovrium-bundle'
export const BUNDLE_FORMAT_VERSION = 1
export const BUNDLE_MANIFEST_ENTRY = 'manifest.json'
export const BUNDLE_CONFIG_ENTRY = 'project/app.json'

const SHA256_HEX = /^[0-9a-f]{64}$/

const sha256Hex = (description: string) =>
  Schema.String.annotate({ description }).check(Schema.isPattern(SHA256_HEX))

/**
 * An entry path: the resolved config, or a file under `public/` or `seed/`.
 * Forward slashes, relative, never a `.` or `..` segment — a path an extractor
 * could follow out of the directory it unpacks into is refused at decode.
 */
const ENTRY_PATH = /^(?:project\/app\.json|(?:public|seed)\/[^\0\\]+)$/
const hasDotSegment = (path: string): boolean =>
  path.split('/').some((segment) => segment === '.' || segment === '..' || segment === '')

const entryPathSchema = Schema.String.annotate({
  description:
    "Path inside the archive: 'project/app.json', or a file under 'public/' or 'seed/'. Forward slashes, relative, no '.' or '..' segment",
}).check(
  Schema.isPattern(ENTRY_PATH),
  Schema.makeFilter((path: string) =>
    hasDotSegment(path) ? 'an entry path with no empty, . or .. segment' : undefined
  )
)

export const bundleEntrySchema = Schema.Struct({
  path: entryPathSchema,
  sha256: sha256Hex('Lowercase hex SHA-256 of the entry bytes'),
  size: Schema.Number.annotate({ description: 'Size of the entry in bytes' }).check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0)
  ),
})

/** @public */
export type BundleEntry = Schema.Schema.Type<typeof bundleEntrySchema>

/**
 * Reserved for a detached Ed25519 signature over the manifest. Nothing writes
 * it yet; a reader that finds it must verify it rather than ignore it.
 */
export const bundleSignatureSchema = Schema.Struct({
  keyId: Schema.String.annotate({
    description: 'Identifier of the public key that verifies the signature',
  }).check(Schema.isMinLength(1)),
  algorithm: Schema.Literal('ed25519').annotate({ description: 'Signature algorithm' }),
  value: Schema.String.annotate({
    description: 'Base64 detached signature over the manifest without its signature field',
  }).check(Schema.isMinLength(1)),
})

/** @public */
export type BundleSignature = Schema.Schema.Type<typeof bundleSignatureSchema>

export const bundleManifestSchema = Schema.Struct({
  format: Schema.Literal(BUNDLE_FORMAT).annotate({
    description: "Constant 'sovrium-bundle': identifies the archive as a deployable bundle",
  }),
  formatVersion: Schema.Literal(BUNDLE_FORMAT_VERSION).annotate({
    description: 'Version of this manifest layout; a reader refuses one it does not know',
  }),
  engine: Schema.Struct({
    minVersion: Schema.String.annotate({
      description:
        'Version of the engine that resolved and validated the config; a host running an older engine refuses the bundle',
    }).check(Schema.isPattern(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)),
  }).annotate({ description: 'The engine the bundle needs' }),
  app: Schema.Struct({
    name: Schema.String.annotate({ description: 'The app name, as written in the config' }).check(
      Schema.isMinLength(1)
    ),
    slug: Schema.String.annotate({
      description:
        "URL-safe form of the name: lowercase letters, digits and '-', a scope's '@' dropped and its '/' written '-'",
    }).check(Schema.isPattern(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)),
  }).annotate({ description: 'The app the bundle deploys' }),
  configHash: sha256Hex(
    "Lowercase hex SHA-256 of 'project/app.json' — the same value as that entry's sha256, so two bundles of the same resolved config compare equal"
  ),
  createdAt: isoDateTime({ description: 'When the bundle was written (ISO 8601, UTC)' }),
  entries: Schema.Array(bundleEntrySchema)
    .annotate({
      description:
        "Every entry of the archive except manifest.json itself, with its size and sha256. Always holds 'project/app.json'",
    })
    .check(Schema.isMinLength(1)),
  signature: optionalField(bundleSignatureSchema),
}).annotate({
  identifier: 'BundleManifest',
  title: 'Bundle Manifest',
  description: 'manifest.json of a sovrium bundle archive',
})

export type BundleManifest = Schema.Schema.Type<typeof bundleManifestSchema>
