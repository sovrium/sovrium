/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Contract for `pages/<name>.tree.json`, the design tree of one page in the
 * design-system bundle (`sovrium design-system --format bundle --pages`).
 *
 * The bundle draws each page twice: once as Sovrium's own renderer paints it
 * (`pages/<name>.page.html`), and once as THIS tree — the part of the page a
 * design tool may change, and nothing else. Each node carries its type, its
 * identity, its variant and size, its layout and its literal content, each
 * value resolved to the token it came from. Everything that is not visual —
 * bindings, data sources, visibility, translations, interactions, the page's
 * path and meta, the provenance of an expanded reference — lives in the node
 * map (`page-node-map.ts`), so a design tool never holds it and an import
 * never has to guess it back.
 *
 * ─── IDENTITY ──────────────────────────────────────────────────────────────
 *
 * A node's `id` is its PATH: the page name, a colon, and the JSON Pointer of
 * the node inside the page entry (`dashboard:/components/0/children/1`). It is
 * computed, never authored, and it is what the renderer stamps as
 * `data-sovrium-id` when it draws for an export. A node may also carry the
 * author's `key`, which survives a move; an import matches by key first and
 * by path only when the type is the same.
 *
 * ─── LOCKED SUBTREES ───────────────────────────────────────────────────────
 *
 * A template placement, a library block and the content of any expanded
 * reference are drawn expanded, so the drawing is the page a visitor sees, but
 * each is marked `locked`: an edit inside one is refused on import. An island
 * is locked too, and drawn from the synthetic seed the platform ships, never
 * from an instance's tables.
 */

/** The tree format identifier. */
export const PAGE_DESIGN_TREE_FORMAT = 'sovrium.design-system.page-tree'

/**
 * A page's name as the bundle addresses it: the page entry's `name`, which
 * `--page` also takes.
 */
export const pageInterchangeNameSchema = Schema.String.annotate({
  description: 'The page, by the `name` of its entry in the config',
  examples: ['dashboard', 'invoice-detail'],
}).check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9_-]*$/))

/**
 * A node's path id: `<page name>:<JSON Pointer>`. Each pointer segment is
 * escaped per RFC 6901 (`~0` for `~`, `~1` for `/`); the page root itself is
 * never a node, so the pointer always has at least one segment.
 */
export const pageNodeIdSchema = Schema.String.annotate({
  description:
    'The node, by its path: the page name, a colon, and the JSON Pointer of the node inside the page entry',
  examples: ['dashboard:/components/0', 'dashboard:/components/0/children/2'],
}).check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9_-]*:(?:\/(?:[^/~]|~[01])+)+$/))

/** The layout properties a design tool may change on a container. */
export const pageLayoutPropertySchema = Schema.Literals([
  'direction',
  'gap',
  'align',
  'justify',
  'padding',
  'width',
]).annotate({
  description:
    'A container layout property: its `direction`, the `gap` between children, how they `align` and `justify`, its `padding`, and its `width`',
})

/** One layout value, and the token it is on the scale of. */
export const pageLayoutValueSchema = Schema.Struct({
  value: Schema.String.annotate({
    description: 'The value as the page paints it',
    examples: ['1rem', 'column', 'center', '100%'],
  }),
  token: optionalField(
    Schema.String.annotate({
      description:
        'The design token the value is on the scale of, by its dotted path; absent for an enumerated value such as a direction',
      examples: ['spacing.4', 'radius.md'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageLayoutValue',
})

/** A node's layout, one value per property it sets. */
const pageLayoutSchema = Schema.Struct({
  direction: optionalField(pageLayoutValueSchema),
  gap: optionalField(pageLayoutValueSchema),
  align: optionalField(pageLayoutValueSchema),
  justify: optionalField(pageLayoutValueSchema),
  padding: optionalField(pageLayoutValueSchema),
  width: optionalField(pageLayoutValueSchema),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  description: 'The layout properties the node sets, each with its value and token',
})

/** A node's layout as a plain object, one optional entry per property. */
type PageLayout = {
  readonly [P in typeof pageLayoutPropertySchema.Type]?:
    typeof pageLayoutValueSchema.Type | undefined
}

/** Why a subtree is drawn but may not be edited. */
export const pageLockedKindSchema = Schema.Literals([
  'template',
  'library-block',
  'reference',
  'island',
]).annotate({
  description:
    'Why the subtree is locked: an expanded `template` placement, a `library-block`, the content of an expanded `reference`, or an `island` whose box alone is drawn',
})

/** One node of the design tree. */
export interface PageDesignTreeNode {
  readonly id: string
  readonly key?: string | undefined
  readonly type: string
  readonly variant?: string | undefined
  readonly size?: string | undefined
  readonly layout?: PageLayout | undefined
  readonly responsive?: { readonly [breakpoint: string]: PageLayout } | undefined
  readonly content?: string | undefined
  readonly locked?: typeof pageLockedKindSchema.Type | undefined
  readonly children: readonly PageDesignTreeNode[]
}

// The explicit annotation is what makes the recursion typeable.
export const pageDesignTreeNodeSchema: Schema.Codec<PageDesignTreeNode> = Schema.suspend(
  (): Schema.Codec<PageDesignTreeNode> =>
    Schema.Struct({
      id: pageNodeIdSchema,
      key: optionalField(
        Schema.String.annotate({
          description: "The author's node key, when the config sets one",
        }).check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      ),
      type: Schema.String.annotate({
        description: 'The component type, as the config names it',
        examples: ['container', 'card', 'button'],
      }),
      variant: optionalField(
        Schema.String.annotate({ description: 'The variant the node is drawn in' })
      ),
      size: optionalField(Schema.String.annotate({ description: 'The size the node is drawn at' })),
      layout: optionalField(pageLayoutSchema),
      responsive: optionalField(
        Schema.Record(Schema.String, pageLayoutSchema).annotate({
          description: 'The layout the node sets at each breakpoint, by breakpoint name',
        })
      ),
      content: optionalField(
        Schema.String.annotate({
          description:
            'The literal text the node draws. Bound or translated text is drawn but carried in the node map, never here',
        })
      ),
      locked: optionalField(pageLockedKindSchema),
      children: Schema.Array(pageDesignTreeNodeSchema).annotate({
        description: 'The child nodes, in the order they are drawn',
      }),
    }).annotate({ strictKeys: true, title: 'sovrium:strict-keys' })
).annotate({ identifier: 'PageDesignTreeNode' })

/**
 * The design tree of one page.
 *
 * @public Authored ahead of the export: `sovrium design-system --format bundle
 * --pages` writes it when the page export ships.
 */
export const pageDesignTreeSchema = Schema.Struct({
  format: Schema.Literal(PAGE_DESIGN_TREE_FORMAT).annotate({
    description: 'The tree format identifier',
  }),
  version: Schema.Literal(1).annotate({ description: 'The tree version' }),
  page: pageInterchangeNameSchema,
  nodes: Schema.Array(pageDesignTreeNodeSchema).annotate({
    description: "The page's top-level nodes, in the order they are drawn",
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageDesignTree',
})

/** @public */
export type PageDesignTree = typeof pageDesignTreeSchema.Type

/**
 * The export stamp every page drawing carries: each node the export drew, with
 * its key and a content hash of it.
 *
 * One contract for every tool. The Claude Design canvas, the Figma page
 * document and the Penpot file each carry it, and the import reads it the same
 * way: a page node missing from a drawing counts as the designer's deletion
 * only when the stamp lists it, so a node the config gained after the export
 * cannot be removed by a drawing made before it.
 */
export const pageExportStampSchema = Schema.Array(
  Schema.Struct({
    id: pageNodeIdSchema,
    key: optionalField(
      Schema.String.annotate({
        description:
          "The node's key at export time, so a node moved in the config since is still found",
      })
    ),
    contentHash: Schema.String.annotate({
      description: 'The SHA-256 of the node as it was exported, lower-case hexadecimal',
    }).check(Schema.isPattern(/^[0-9a-f]{64}$/)),
  }).annotate({ strictKeys: true, title: 'sovrium:strict-keys' })
).annotate({
  description:
    'Every node the export drew, with its content hash. A design tool never changes it: it is how the import tells a node the designer deleted from one added to the config since the export, which it keeps',
})

/** The export stamp of one drawing. */
export type PageExportStamp = typeof pageExportStampSchema.Type
