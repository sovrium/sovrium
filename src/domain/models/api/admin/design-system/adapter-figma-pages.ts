/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import {
  pageExportStampSchema,
  pageInterchangeNameSchema,
  pageNodeIdSchema,
} from './page-design-tree'

/**
 * Contract for `adapters/figma/pages/<name>.figma.json`, the page document the
 * Sovrium Figma plugin reads and writes.
 *
 * Figma has no file format a CLI can write offline, so its page adapter is a
 * JSON document Sovrium defines end to end: the export writes it, the plugin
 * builds frames from it inside Figma and tags each frame with its node
 * identity, and the plugin writes the edited result back in the SAME shape for
 * `sovrium design-system import --pages --from figma` to read. The plugin
 * never talks to an instance; this file is its only input and output.
 *
 * ─── WHAT IS FIGMA'S AND WHAT IS OURS ──────────────────────────────────────
 *
 * The node fields are named after the Figma Plugin API properties the plugin
 * sets (`layoutMode`, `itemSpacing`, the four paddings, the two axis
 * alignments, `characters`, `boundVariables`), so the plugin copies them
 * rather than translating them. Their values follow that API, which the pinned
 * plugin-API fixture under `[internal ref]` holds;
 * this schema follows the fixture, not memory. The `sovrium` field is ours: it
 * is the plugin data the frame carries, and a layer without it is not a node
 * the import can place.
 *
 * ─── ONE BOARD PER BREAKPOINT ──────────────────────────────────────────────
 *
 * Figma frames have no breakpoints. A page whose nodes set a layout at a
 * breakpoint is drawn as one board at the base width and one per breakpoint
 * it uses, so a designer changes the `md` layout by editing the `md` board.
 *
 * ─── THE EXPORT STAMP ──────────────────────────────────────────────────────
 *
 * `exported` lists the nodes the export drew and a content hash of each. A
 * page node missing from the drawing counts as the designer's deletion only
 * when the stamp lists it; a node the config gained after the export is not in the
 * stamp, so a drawing made before it cannot remove it.
 *
 * ─── NOTHING SOVRIUM-SPECIFIC TO EDIT ──────────────────────────────────────
 *
 * The document carries no binding, data source, visibility rule, translation
 * key, interaction, page path or meta. Those stay in the bundle's node map, so
 * the plugin has nothing of the kind to show and nothing to change.
 */

/** The Figma page document format identifier. */
export const FIGMA_PAGE_DOCUMENT_FORMAT = 'sovrium.figma.page'

/** The plugin data a Sovrium frame carries. */
export const figmaPageNodeTagSchema = Schema.Struct({
  id: optionalField(pageNodeIdSchema),
  type: Schema.String.annotate({
    description: 'The kit component type the frame draws',
    examples: ['flex', 'button', 'card'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  description:
    'The node this layer was drawn from; `id` is absent on a kit component the designer added',
})

/** One layer of a board. */
export interface FigmaPageNode {
  readonly name: string
  readonly nodeType: 'FRAME' | 'TEXT' | 'INSTANCE' | 'GROUP' | 'RECTANGLE' | 'VECTOR'
  readonly sovrium?: typeof figmaPageNodeTagSchema.Type | undefined
  readonly locked?: boolean | undefined
  readonly layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE' | undefined
  readonly itemSpacing?: number | undefined
  readonly paddingTop?: number | undefined
  readonly paddingRight?: number | undefined
  readonly paddingBottom?: number | undefined
  readonly paddingLeft?: number | undefined
  readonly primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' | undefined
  readonly counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE' | undefined
  readonly width?: number | undefined
  readonly layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL' | undefined
  readonly layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL' | undefined
  readonly layoutPositioning?: 'AUTO' | 'ABSOLUTE' | undefined
  readonly boundVariables?: { readonly [property: string]: string } | undefined
  readonly characters?: string | undefined
  readonly componentProperties?: { readonly [property: string]: string } | undefined
  readonly children: readonly FigmaPageNode[]
}

const pxField = (description: string) =>
  optionalField(Schema.Finite.annotate({ description }).check(Schema.isGreaterThanOrEqualTo(0)))

// The explicit annotation is what makes the recursion typeable.
export const figmaPageNodeSchema: Schema.Codec<FigmaPageNode> = Schema.suspend(
  (): Schema.Codec<FigmaPageNode> =>
    Schema.Struct({
      name: Schema.String.annotate({ description: 'The layer name, as Figma shows it' }),
      nodeType: Schema.Literals([
        'FRAME',
        'TEXT',
        'INSTANCE',
        'GROUP',
        'RECTANGLE',
        'VECTOR',
      ]).annotate({ description: 'The Figma node type of the layer' }),
      sovrium: optionalField(figmaPageNodeTagSchema),
      locked: optionalField(
        Schema.Boolean.annotate({
          description:
            'Whether the layer is locked: a template, a library block, an expanded reference or an island',
        })
      ),
      layoutMode: optionalField(
        Schema.Literals(['HORIZONTAL', 'VERTICAL', 'NONE']).annotate({
          description: 'The auto-layout direction, computed from the container layout',
        })
      ),
      itemSpacing: pxField('The gap between children, in px'),
      paddingTop: pxField('The top padding, in px'),
      paddingRight: pxField('The right padding, in px'),
      paddingBottom: pxField('The bottom padding, in px'),
      paddingLeft: pxField('The left padding, in px'),
      primaryAxisAlignItems: optionalField(
        Schema.Literals(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']).annotate({
          description: 'How children are distributed along the layout direction',
        })
      ),
      counterAxisAlignItems: optionalField(
        Schema.Literals(['MIN', 'CENTER', 'MAX', 'BASELINE']).annotate({
          description: 'How children are aligned across the layout direction',
        })
      ),
      width: pxField('The layer width, in px'),
      layoutSizingHorizontal: optionalField(
        Schema.Literals(['FIXED', 'HUG', 'FILL']).annotate({
          description:
            'How the layer is sized across its width: a fixed size, hugging its contents, or filling its auto-layout parent',
        })
      ),
      layoutSizingVertical: optionalField(
        Schema.Literals(['FIXED', 'HUG', 'FILL']).annotate({
          description:
            'How the layer is sized across its height: a fixed size, hugging its contents, or filling its auto-layout parent',
        })
      ),
      layoutPositioning: optionalField(
        Schema.Literals(['AUTO', 'ABSOLUTE']).annotate({
          description:
            "Whether the layer takes its place in its parent's auto layout or is positioned absolutely; an absolutely positioned layer has no page layout to read back and is reported",
        })
      ),
      boundVariables: optionalField(
        Schema.Record(Schema.String, Schema.String).annotate({
          description:
            'The Figma variable each layout property is bound to, by variable name, as the Figma token files name it',
        })
      ),
      characters: optionalField(
        Schema.String.annotate({ description: 'The text a text layer draws' })
      ),
      componentProperties: optionalField(
        Schema.Record(Schema.String, Schema.String).annotate({
          description: "The kit instance's properties: its `variant` and its `size`",
        })
      ),
      children: Schema.Array(figmaPageNodeSchema).annotate({
        description: 'The child layers, in drawing order',
      }),
    }).annotate({ strictKeys: true, title: 'sovrium:strict-keys' })
).annotate({ identifier: 'FigmaPageNode' })

/** One board: the page drawn at one width. */
export const figmaPageBoardSchema = Schema.Struct({
  breakpoint: Schema.String.annotate({
    description: 'The breakpoint the board draws: `base`, or a breakpoint name the design declares',
    examples: ['base', 'md', 'lg'],
  }),
  width: Schema.Int.annotate({ description: 'The board width, in px' }).check(
    Schema.isGreaterThan(0)
  ),
  nodes: Schema.Array(figmaPageNodeSchema).annotate({
    description: "The page's top-level layers on this board",
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'FigmaPageBoard',
})

/**
 * The Figma page document.
 *
 * @public Authored ahead of the page adapter: the export writes it and the
 * Sovrium Figma plugin reads and writes it when the Figma page adapter ships.
 */
export const figmaPageDocumentSchema = Schema.Struct({
  format: Schema.Literal(FIGMA_PAGE_DOCUMENT_FORMAT).annotate({
    description: 'The document format identifier',
  }),
  version: Schema.Literal(1).annotate({ description: 'The document version' }),
  page: pageInterchangeNameSchema,
  variables: Schema.Array(Schema.String).annotate({
    description:
      'The Figma token files whose variables the layers bind to, relative to the Figma adapter folder',
    examples: [['light.tokens.json', 'dark.tokens.json']],
  }),
  boards: Schema.Array(figmaPageBoardSchema).annotate({
    description: 'The page at its base width, then once per breakpoint its layout uses',
  }),
  exported: pageExportStampSchema,
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'FigmaPageDocument',
})

/** @public */
export type FigmaPageDocument = typeof figmaPageDocumentSchema.Type
