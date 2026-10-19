/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Contract for `project/design-system.json`, the INDEX of a Claude Design
 * "Design System" artifact kept in files (contract 0.2.47).
 *
 * The artifact page reads this file first. Without it a published `project/`
 * folder has no index: the page opens as an empty system and ignores the
 * files beside it. The bundle's Claude Design adapter writes one at
 * `adapters/claude-design/project/design-system.json`, so the folder publishes
 * as it is.
 *
 * ─── THE MARKER ────────────────────────────────────────────────────────────
 *
 * `v: 3`, `layout: "files"` and a `createdOnFiles` object together are the
 * marker. A file without them is not an index, and the page opens read-only
 * rather than overwrite it.
 *
 * ─── WHAT THE PAGE OWNS ────────────────────────────────────────────────────
 *
 * `sections`, `blobs` and `docs.sections` are the page's own: a new index
 * carries them empty and the page fills them. `assetGroups` names the asset
 * uploads, each by the blob id an upload returned — which is why a folder
 * written to disk, which cannot upload, carries none. Keys this schema does not
 * name are kept, not refused: the page may add its own.
 */

/** An ASCII JavaScript identifier: the global a bundle would assign. */
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** An ISO-8601 instant in UTC, as the index writes its dates. */
const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

const instantSchema = Schema.String.annotate({
  description: 'An ISO-8601 instant in UTC',
  examples: ['2026-09-14T18:20:00Z'],
}).check(Schema.isPattern(UTC_INSTANT_PATTERN))

/** One library the previews load, such as React. */
export const claudeDesignIndexLibrarySchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'Library name, as the previews load it',
    examples: ['react'],
  }),
  version: Schema.String.annotate({ description: 'Library version', examples: ['18'] }),
}).annotate({ identifier: 'ClaudeDesignIndexLibrary' })

/** One uploaded asset, named by the blob id its upload returned. */
export const claudeDesignIndexAssetSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'The path below the group folder',
    examples: ['acme-mark.svg'],
  }),
  blob: Schema.String.annotate({
    description: 'The id of the upload, from the `/_blob/<id>` it returned',
  }),
  size: Schema.Finite.annotate({ description: 'Size in bytes' }),
  type: Schema.String.annotate({ description: 'Media type', examples: ['image/svg+xml'] }),
}).annotate({ identifier: 'ClaudeDesignIndexAsset' })

/** One asset group: its tile size, its tile order and its uploads. */
export const claudeDesignIndexAssetGroupSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Group name', examples: ['Logos'] }),
  tile: optionalField(
    Schema.String.annotate({ description: 'Tile size, from `l` to `xs`', examples: ['l'] })
  ),
  order: Schema.Array(Schema.String).annotate({ description: 'Asset names in tile order' }),
  files: Schema.Record(Schema.String, claudeDesignIndexAssetSchema).annotate({
    description: 'The group uploads, keyed by asset name',
  }),
}).annotate({ identifier: 'ClaudeDesignIndexAssetGroup' })

/** Who changed the system last, and when. */
export const claudeDesignIndexLastChangeSchema = Schema.Struct({
  by: Schema.String.annotate({ description: 'Who made the change' }),
  at: instantSchema,
  via: optionalField(Schema.String.annotate({ description: 'The surface the change came from' })),
  note: optionalField(Schema.String.annotate({ description: 'One line saying what changed' })),
}).annotate({ identifier: 'ClaudeDesignIndexLastChange' })

/** The index of a Design System artifact kept in files. */
export const claudeDesignIndexSchema = Schema.Struct({
  v: Schema.Literal(3).annotate({ description: 'Index format version' }),
  layout: Schema.Literal('files').annotate({
    description: 'The system keeps its content in files under `project/`',
  }),
  createdOnFiles: Schema.Struct({
    v: Schema.Literal(1).annotate({ description: 'Marker version' }),
    at: instantSchema,
  }).annotate({ description: 'The marker: when the system was created in files' }),
  title: Schema.String.annotate({
    description: "The system's name",
    examples: ['Acme'],
  }).check(Schema.isMinLength(1)),
  namespace: Schema.String.annotate({
    description: 'The global a component bundle assigns, an ASCII identifier',
    examples: ['Acme'],
  }).check(Schema.isPattern(IDENTIFIER_PATTERN)),
  libraries: Schema.Array(claudeDesignIndexLibrarySchema).annotate({
    description: 'What the previews load; empty when there is no component bundle',
  }),
  sections: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'Card titles a reader set; the page owns them',
  }),
  groups: Schema.Array(Schema.String).annotate({ description: 'Asset groups, in order' }),
  assetGroups: Schema.Record(Schema.String, claudeDesignIndexAssetGroupSchema).annotate({
    description: 'Each asset group, keyed by its name',
  }),
  blobs: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'The page record of stored uploads',
  }),
  docs: Schema.Struct({
    readme: Schema.String.annotate({
      description: 'The brand book path',
      examples: ['project/README.md'],
    }),
    sections: Schema.Array(Schema.Unknown).annotate({
      description: 'Further brand book sections; the page fills them',
    }),
  }).annotate({ description: 'Where the brand book is' }),
  lastChange: optionalField(claudeDesignIndexLastChangeSchema),
}).annotate({ identifier: 'ClaudeDesignIndex' })

/** @public */
export type ClaudeDesignIndex = Schema.Schema.Type<typeof claudeDesignIndexSchema>
