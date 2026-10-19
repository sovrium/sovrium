/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { designSystemModeSchema } from './design-system'

/**
 * API contract for the portable design-system bundle's `manifest.json`.
 *
 * The bundle is ONE directory a design tool or an assistant can be handed
 * whole: the markdown brief, an `llms.txt` index, the DTCG token documents for
 * each colour mode with the resolver that chooses between them, the CSS the app
 * paints with, a rendered component kit, and the assets those reference. It is
 * served three ways — written to disk by `sovrium design-system --format
 * bundle`, downloaded as a zip from `GET /api/admin/design-system.zip`, and
 * read file by file from `GET /api/admin/design-system/bundle` — and this
 * manifest is what all three agree on.
 *
 * ─── THE MANIFEST IS THE BUNDLE'S OWN CHECKSUM ─────────────────────────────
 *
 * Every file except the manifest itself is listed with its byte length and the
 * SHA-256 of its bytes, so a consumer can verify what it was handed without
 * trusting the transport, and two exports of one config can be compared file
 * by file. The manifest cannot list itself: a hash of a file that contains its
 * own hash has no fixed point.
 *
 * ─── PATHS ARE RELATIVE, AND NEVER CLIMB ───────────────────────────────────
 *
 * A path is relative to the bundle root, uses `/`, has no leading slash and no
 * `..` segment. The same string addresses the file on disk, inside the zip and
 * through the per-file read, and a path that could climb out of the bundle
 * would be one the per-file read had to refuse on every request instead of once
 * here.
 *
 * ─── WHAT IS NEVER IN IT ───────────────────────────────────────────────────
 *
 * The same bound as the two exports it is built from: no `app.env[]` value and
 * no table data. A bundle describes how an app looks, not what it holds, and it
 * is made to be handed to someone else.
 */

/** The bundle format this manifest declares. Bumped only on a breaking layout change. */
export const DESIGN_SYSTEM_BUNDLE_FORMAT = 'sovrium.design-system.bundle'

/** What one file is for, so a consumer can find the tokens without knowing the layout. */
export const designSystemBundleFileRoleSchema = Schema.Literals([
  'brief',
  'index',
  'tokens',
  'resolver',
  'css',
  'kit',
  'asset',
  'font',
  'adapter',
]).annotate({
  description:
    'What the file is for: the markdown `brief`, the `index` an assistant reads first, a `tokens` document for one mode, the `resolver` that picks a mode, a `css` stylesheet, a `kit` page or its manifest, a copied `asset` or `font`, or a provider `adapter` projection.',
})

/** A bundle-relative path: `/`-separated, no leading slash, no `..` segment. */
const bundlePathSchema = Schema.String.annotate({
  description:
    'Path of the file inside the bundle, relative to its root, `/`-separated. The same string addresses it on disk, inside the zip and through the per-file read.',
  examples: ['tokens/base.tokens.json', 'components/button.html'],
}).check(
  Schema.isPattern(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@-]+)*$/)
)

/** One file of the bundle, measured from the bytes it holds. */
export const designSystemBundleFileSchema = Schema.Struct({
  path: bundlePathSchema,
  mediaType: Schema.String.annotate({
    description: 'The media type the file is served with',
    examples: ['application/json', 'text/css', 'text/html', 'font/woff2'],
  }).check(Schema.isPattern(/^[a-z]+\/[a-z0-9.+-]+$/)),
  bytes: Schema.Int.annotate({
    description: 'The length of the file in bytes',
  }).check(Schema.isGreaterThanOrEqualTo(0)),
  sha256: Schema.String.annotate({
    description: 'The SHA-256 of the file bytes, lower-case hexadecimal',
  }).check(Schema.isPattern(/^[0-9a-f]{64}$/)),
  role: designSystemBundleFileRoleSchema,
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignSystemBundleFile',
})

/**
 * The bundle's `manifest.json`, and the body of `GET /api/admin/design-system/bundle`.
 *
 * `modes` lists the colour modes the bundle carries a token document for —
 * always both, since an app that declares no dark colours still paints the
 * inherited dark defaults. `adapters` names the provider projections the
 * bundle carries under `adapters/`, and is empty when it carries none.
 *
 * @public Authored ahead of route wiring: the bundle builder, the zip and the
 * manifest read adopt it when the bundle ships.
 */
export const designSystemBundleManifestSchema = Schema.Struct({
  format: Schema.Literal(DESIGN_SYSTEM_BUNDLE_FORMAT).annotate({
    description: 'The bundle format identifier',
  }),
  version: Schema.Literal(1).annotate({
    description: 'The bundle layout version',
  }),
  app: Schema.Struct({
    name: Schema.String.annotate({ description: 'The name of the app the bundle describes' }),
  }).annotate({ strictKeys: true, title: 'sovrium:strict-keys' }),
  modes: Schema.Array(designSystemModeSchema).annotate({
    description: 'The colour modes the bundle carries a token document for',
  }),
  files: Schema.Array(designSystemBundleFileSchema).annotate({
    description: 'Every file of the bundle except this manifest, in path order',
  }),
  adapters: Schema.Array(Schema.String).annotate({
    description: 'The provider projections the bundle carries under `adapters/`; empty for none',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignSystemBundleManifest',
})

/**
 * The query of `GET /api/admin/design-system/bundle/file`.
 *
 * One required `path`, as the manifest lists it. The read answers TEXT files
 * only: a font or an image is in the zip, and a read that base64-encoded it
 * into a text body would hand an assistant a payload it cannot use and the
 * bundle itself refuses to carry. A path the manifest does not list — a typo, a
 * binary file, or one that climbs out with `..` — is answered the same 404.
 *
 * @public Authored ahead of route wiring: the per-file read adopts it when the
 * bundle ships.
 */
export const designSystemBundleFileQuerySchema = Schema.Struct({
  path: Schema.String.annotate({
    description: 'The bundle-relative path of one text file, as the manifest lists it',
    examples: ['css/theme.css', 'components/manifest.json'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignSystemBundleFileQuery',
})

/** @public */
export type DesignSystemBundleFileRole = typeof designSystemBundleFileRoleSchema.Type
/** @public */
export type DesignSystemBundleFile = typeof designSystemBundleFileSchema.Type
/** @public */
export type DesignSystemBundleManifest = typeof designSystemBundleManifestSchema.Type
/** @public */
export type DesignSystemBundleFileQuery = typeof designSystemBundleFileQuerySchema.Type
