/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { pageInterchangeNameSchema, pageNodeIdSchema } from './page-design-tree'

/**
 * Contract for `pages/node-map.json`, everything about the exported pages
 * that is NOT visual.
 *
 * The design tree (`page-design-tree.ts`) is what a design tool may change;
 * this map is what it must never hold. Per page: its `path` and its `meta`.
 * Per node: its bindings, its data source, its visibility rule, its
 * translation keys, its interactions, where an expanded subtree came from, and
 * whether it is an island — plus a content hash, so an import can tell a node
 * the designer touched from one they did not. An import keeps every one of
 * these from the map and never reads them back from a drawing.
 *
 * ─── EXPRESSIONS, NEVER VALUES ─────────────────────────────────────────────
 *
 * A binding is carried as the expression the config writes (`$record.title`,
 * `$currentUser.name`) and the names it references — never the value it
 * resolved to. The map describes how a page is wired, not what any instance
 * holds, so it carries no table row, no env value and no secret.
 */

/** The node map format identifier. */
export const PAGE_NODE_MAP_FORMAT = 'sovrium.design-system.page-node-map'

/** One binding of a node: which property it fills, and from what. */
export const pageNodeBindingSchema = Schema.Struct({
  property: Schema.String.annotate({
    description: 'The node property the binding fills, as a dotted path from the node',
    examples: ['content', 'props.href'],
  }),
  expression: Schema.String.annotate({
    description: 'The binding expression exactly as the config writes it',
    examples: ['$record.title', '$currentUser.name', '$param.id'],
  }),
  references: Schema.Array(Schema.String).annotate({
    description: 'The tables, fields and parameters the expression names, never a value they hold',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageNodeBinding',
})

/** One translation key a node draws its text from. */
export const pageNodeTranslationSchema = Schema.Struct({
  property: Schema.String.annotate({
    description: 'The node property the translated text fills',
    examples: ['content'],
  }),
  key: Schema.String.annotate({
    description: 'The translation key, with its `$t:` prefix',
    examples: ['$t:dashboard.title'],
  }).check(Schema.isPattern(/^\$t:.+$/)),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageNodeTranslation',
})

/** Where an expanded, locked subtree came from. */
export const pageNodeProvenanceSchema = Schema.Struct({
  kind: Schema.Literals(['template', 'library-block', 'reference']).annotate({
    description:
      'What was expanded: a `template` from the app components, a `library-block`, or another `reference`',
  }),
  name: Schema.String.annotate({
    description: 'The template, block or reference name, as the placement writes it',
    examples: ['stat-card', 'app-footer'],
  }),
  placement: pageNodeIdSchema,
  variables: optionalField(
    Schema.Record(
      Schema.String,
      Schema.Union([
        Schema.String,
        Schema.Finite,
        Schema.Boolean,
        Schema.Array(Schema.Unknown).annotate({
          description: 'A list, for a template input of kind `json`',
        }),
        Schema.Record(Schema.String, Schema.Unknown).annotate({
          description: 'An object, for a template input of kind `json`',
        }),
      ])
    ).annotate({
      description:
        "The placement's own `$variable` values, as written. A text, number or boolean value an import may change; a list or an object, the value of a `json` input, is read-only, and an edit to what it draws is refused naming the input. The template's body an import may not change.",
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageNodeProvenance',
})

/** One node's entry in the map. */
export const pageNodeMapEntrySchema = Schema.Struct({
  id: pageNodeIdSchema,
  key: optionalField(Schema.String.annotate({ description: "The author's node key" })),
  type: Schema.String.annotate({ description: 'The component type, as the config names it' }),
  contentHash: Schema.String.annotate({
    description:
      'The SHA-256, lower-case hexadecimal, of the node as the design tree draws it, so an import can tell an edited node from an untouched one',
  }).check(Schema.isPattern(/^[0-9a-f]{64}$/)),
  bindings: optionalField(
    Schema.Array(pageNodeBindingSchema).annotate({
      description: 'Every property the node fills from a binding',
    })
  ),
  translations: optionalField(
    Schema.Array(pageNodeTranslationSchema).annotate({
      description: 'Every property the node fills from a translation key',
    })
  ),
  dataSource: optionalField(
    Schema.Unknown.annotate({
      description: "The node's `dataSource`, kept exactly as the config writes it",
    })
  ),
  visibility: optionalField(
    Schema.Unknown.annotate({
      description: "The node's `visibility` rule, kept exactly as the config writes it",
    })
  ),
  interactions: optionalField(
    Schema.Unknown.annotate({
      description: "The node's `interactions`, kept exactly as the config writes it",
    })
  ),
  provenance: optionalField(pageNodeProvenanceSchema),
  island: optionalField(
    Schema.Struct({
      seed: Schema.Literals(['synthetic', 'empty']).annotate({
        description:
          'What the island was drawn from: the `synthetic` seed the platform ships, or its `empty` state when the seed holds nothing for it',
      }),
    }).annotate({
      strictKeys: true,
      title: 'sovrium:strict-keys',
      description: 'Present when the node is an island: only its box is drawn and read back',
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageNodeMapEntry',
})

/** One page's entry in the map. */
export const pageNodeMapPageSchema = Schema.Struct({
  name: pageInterchangeNameSchema,
  path: Schema.String.annotate({
    description: "The page's route, kept from the config and never imported",
    examples: ['/dashboard', '/invoices/:id'],
  }),
  meta: optionalField(
    Schema.Unknown.annotate({
      description: "The page's `meta`, kept exactly as the config writes it and never imported",
    })
  ),
  nodes: Schema.Array(pageNodeMapEntrySchema).annotate({
    description: 'One entry per node of the page, in document order',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageNodeMapPage',
})

/**
 * The bundle's `pages/node-map.json`.
 *
 * @public Authored ahead of the export: `sovrium design-system --format bundle
 * --pages` writes it, and `sovrium design-system import --pages` reads it, when
 * the page round trip ships.
 */
export const pageNodeMapSchema = Schema.Struct({
  format: Schema.Literal(PAGE_NODE_MAP_FORMAT).annotate({
    description: 'The node map format identifier',
  }),
  version: Schema.Literal(1).annotate({ description: 'The node map version' }),
  pages: Schema.Array(pageNodeMapPageSchema).annotate({
    description: 'Every exported page, in config order',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageNodeMap',
})

/** @public */
export type PageNodeMap = typeof pageNodeMapSchema.Type
