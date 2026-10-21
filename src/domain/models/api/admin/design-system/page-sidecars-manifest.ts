/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { pageInterchangeNameSchema } from './page-design-tree'

/**
 * Contract for `pages/page-sidecars.json`, which the page export writes for a
 * TypeScript config.
 *
 * A page import never edits a TypeScript file. It writes a page back as a
 * `<name>.page.json` sidecar beside the module that owns the page, which that
 * module imports — as the token import writes `design.json`. To know where
 * each sidecar goes, the import reads this manifest from the bundle: per page,
 * the module that declares it and the sidecar path, both relative to the
 * config. A page with no sidecar yet still has its path here; the import
 * writes a new file there and prints the line to add.
 */

/** The sidecar manifest format identifier. */
export const PAGE_SIDECARS_FORMAT = 'sovrium.design-system.page-sidecars'

/** A config-relative path: `/`-separated, no leading slash, no `..` segment. */
const configRelativePathSchema = Schema.String.annotate({
  description: 'A path relative to the config file, `/`-separated',
  examples: ['config/pages/dashboard.ts', 'config/pages/dashboard.page.json'],
}).check(
  Schema.isPattern(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@-]+)*$/)
)

/** Where one page lives, and where its sidecar goes. */
export const pageSidecarEntrySchema = Schema.Struct({
  page: pageInterchangeNameSchema,
  module: optionalField(
    configRelativePathSchema.annotate({
      description:
        'The TypeScript module that declares the page; absent when the config file declares it inline',
    })
  ),
  sidecar: configRelativePathSchema
    .annotate({
      description: 'Where the page sidecar is, or will be written, ending in `.page.json`',
    })
    .check(Schema.isPattern(/\.page\.json$/)),
  exists: Schema.Boolean.annotate({
    description: 'Whether the page is already read from that sidecar',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageSidecarEntry',
})

/**
 * The bundle's `pages/page-sidecars.json`.
 *
 * @public Authored ahead of the export: the page export writes it for a
 * TypeScript config when the page round trip ships.
 */
export const pageSidecarsManifestSchema = Schema.Struct({
  format: Schema.Literal(PAGE_SIDECARS_FORMAT).annotate({
    description: 'The sidecar manifest format identifier',
  }),
  version: Schema.Literal(1).annotate({ description: 'The sidecar manifest version' }),
  pages: Schema.Array(pageSidecarEntrySchema).annotate({
    description: 'One entry per exported page, in config order',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageSidecarsManifest',
})

/** @public */
export type PageSidecarsManifest = typeof pageSidecarsManifestSchema.Type
