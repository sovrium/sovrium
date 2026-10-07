/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { CssLengthSchema } from '../../../../../css-length'
import {
  CardClickActionSchema,
  CrudActionSchema,
  FillActionSchema,
  OpenDrawerActionSchema,
} from '../../../action'

// ---------------------------------------------------------------------------
// KanbanGroupBySchema
// ---------------------------------------------------------------------------

/**
 * Kanban group-by configuration
 *
 * Defines how records are grouped into columns. The `field` must reference
 * a select/status field whose distinct values become column headers.
 *
 * @example
 * ```yaml
 * kanbanGroupBy:
 *   field: status
 *   collapsed: [done]
 * ```
 */
export const KanbanGroupBySchema = Schema.Struct({
  /** Field name to group records by (select/status field) */
  field: Schema.String.annotate({
    description:
      'Field name whose distinct values create kanban columns (typically a select/status field)',
  }),
  /**
   * Column values drawn folded on first render — the column counterpart of
   * `swimlanes.collapsed`, with the same reasoning: folding is always
   * available, so this names a starting state rather than a capability.
   */
  collapsed: Schema.optional(
    Schema.Array(
      Schema.String.annotate({ description: 'One column value, as the grouping field spells it' })
    ).pipe(
      Schema.annotate({
        description:
          'Column values that render folded on first load; a folded column keeps its heading and record count, and the reader can expand it',
        examples: [['Won'], ['Done', 'Cancelled']],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * How the columns share the board's width from the `md` breakpoint up.
   *
   * `fixed` (the default) gives every column the same readable width and lets
   * the board scroll sideways — the right shape for a board with many columns.
   * `fill` lets the columns share the width the board has, so a five-column
   * pipeline fits a desktop screen without a scrollbar. Below `md` the columns
   * keep their fixed width either way: a phone cannot fit several side by side.
   */
  columnSizing: Schema.optional(
    Schema.Literals(['fixed', 'fill']).annotate({
      description:
        "How the columns share the board's width from the md breakpoint up: 'fixed' (default) gives each column the same width and the board scrolls sideways; 'fill' lets the columns share the available width. Below md the columns keep their fixed width.",
    })
  ),
  /**
   * A fixed width for named columns — the narrow closing columns of a pipeline
   * (`Won`, `Lost`, `Closed`) that hold few cards and do not deserve an equal
   * share. Applied from the `md` breakpoint up, under either sizing.
   *
   * Keyed by the column value as the grouping field spells it, which is an
   * open string set (the field's options can change), so a key no column
   * carries styles nothing.
   */
  columnWidths: Schema.optional(
    Schema.Record(
      Schema.String.annotate({ description: 'One column value, as the grouping field spells it' }),
      CssLengthSchema.annotate({
        description: 'The width that column keeps from the md breakpoint up, in px or rem',
      })
    ).annotate({
      description:
        'A fixed width, in px or rem, for named columns from the md breakpoint up — typically the narrow closing columns of a pipeline. The other columns follow columnSizing.',
      examples: [{ Won: '6rem', Lost: '6rem' }],
    })
  ),
}).annotate({
  identifier: 'KanbanGroupBy',
  title: 'Kanban Group By',
  description: 'Configuration for how records are grouped into kanban columns',
})

// ---------------------------------------------------------------------------
// KanbanSwimlanesSchema
// ---------------------------------------------------------------------------

/**
 * Kanban swimlane configuration — the board's SECOND grouping axis.
 *
 * `kanbanGroupBy` places a card horizontally (which column); `swimlanes` places
 * it vertically (which lane). Declaring both turns the board from a row of
 * columns into a grid: one lane per distinct value of the lane field, and inside
 * every lane the full column set. A card sits at the intersection of its two
 * field values.
 *
 * ─── WHY THIS MIRRORS `kanbanGroupBy` AND NOT `timeline`'s `groupBy` ───────
 *
 * The timeline component also draws swimlanes, and reaching for it as the model
 * is the obvious move — it is where the word `swimlane` already appears in this
 * codebase. It is the wrong model twice over. Its TYPED declaration
 * (`display/timeline/schema.ts`) is dead code: nothing outside its own test
 * imports it, as `component-field-references.ts` records. What the live timeline
 * actually reads is an untyped `props.groupBy` string, whose island groups lanes
 * by FIRST-APPEARANCE order and can express nothing else — no empty lane, no
 * collapse, no declared order.
 *
 * So the model here is the board's own first axis, one file up. `kanbanGroupBy`
 * is a `Struct` rather than a bare string precisely because an axis accumulates
 * options, and the second axis inherits the first's semantics wholesale: lane
 * order is the lane field's DECLARED option order (not first-appearance), a lane
 * value present in the data but undeclared is appended rather than dropped, and
 * records whose lane field is null/empty collect in one `Uncategorized` lane.
 * An author who has learned how columns behave has learned how lanes behave.
 *
 * ─── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────
 *
 * There is no `sort` key. Lane order follows the field's option order, which is
 * exactly the rule the column axis already runs, and `kanbanGroupBy` exposes no
 * `sort` of its own. Giving the second axis an ordering vocabulary the first
 * lacks would make the same concept configurable in one direction and fixed in
 * the other — the asymmetry `component-field-references.ts` was written to end.
 * Ordering belongs to a later change that gives it to BOTH axes at once.
 *
 * @example
 * ```yaml
 * kanbanGroupBy:
 *   field: status      # → columns
 * swimlanes:
 *   field: team        # → lanes
 *   showEmpty: false
 *   collapsed: [Archive]
 * ```
 */
export const KanbanSwimlanesSchema = Schema.Struct({
  /** Field name whose distinct values become the board's lanes */
  field: Schema.String.annotate({
    description:
      'Field name whose distinct values create kanban swimlanes — the board’s second grouping axis, crossing the columns (typically a select/status field)',
    examples: ['team', 'priority', 'category'],
  }),
  /**
   * Whether a declared lane option holding no records still renders.
   *
   * Default `true`, matching the column axis: a declared option renders its
   * column even when empty, which is what makes `emptyColumnMessage` reachable.
   * Set `false` on a lane field with many options to draw only the lanes the
   * data actually populates.
   */
  showEmpty: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'true',
      description:
        'Render a declared lane option that holds no records (default: true, matching the column axis)',
    })
  ),
  /**
   * Lane values drawn collapsed on first render.
   *
   * Collapsing is always AVAILABLE — every lane header carries its disclosure
   * control — so this names a starting state rather than granting a capability.
   * That is why there is no companion `collapsible` boolean: a `collapsible:
   * false` plus a non-empty `collapsed` list would declare a lane that can
   * never be opened, and a shape with no valid reading is better not expressible
   * than refused by a `Schema.check` (which, on a Struct carrying an
   * `identifier`, silently deletes that identifier).
   */
  collapsed: Schema.optional(
    Schema.Array(
      Schema.String.annotate({ description: 'One lane value, as the grouping field spells it' })
    ).pipe(
      Schema.annotate({
        description: 'Lane values that render collapsed on first load; the reader can expand them',
        examples: [['Archive'], ['Done', 'Cancelled']],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
  identifier: 'KanbanSwimlanes',
  title: 'Kanban Swimlanes',
  description:
    'Second grouping axis for a kanban board: one horizontal lane per distinct value of a field, crossing the columns',
})

// ---------------------------------------------------------------------------
// KanbanCardFooterItemSchema
// ---------------------------------------------------------------------------

/**
 * A single metadata field shown in the card footer
 */
export const KanbanCardFooterItemSchema = Schema.Struct({
  /** Field name to display */
  field: Schema.String.annotate({
    description: 'Field name from the data source table',
  }),
  /** Display format for the value */
  format: Schema.optional(
    Schema.Literals([
      'relative-date',
      'short-date',
      'avatar',
      'badge',
      'text',
      'currency',
    ]).annotate({
      description:
        "How to format the field value in the footer — `currency` formats a number with the bound column's own currency, precision and separators",
    })
  ),
}).annotate({
  title: 'Kanban Card Footer Item',
  description: 'Metadata field displayed in the kanban card footer',
})

// ---------------------------------------------------------------------------
// KanbanCardSchema
// ---------------------------------------------------------------------------

/**
 * Kanban card template configuration
 *
 * Defines how each record renders as a card on the board.
 * Supports child components with `$record.*` variable substitution,
 * cover images, click actions, footer metadata, and color coding.
 *
 * @example
 * ```yaml
 * card:
 *   children:
 *     - type: heading
 *       props: { className: 'text-sm font-medium' }
 *       content: '$record.title'
 *   onClick:
 *     type: navigate
 *     path: /tasks/$record.id
 *   coverImage: '$record.thumbnail'
 *   colorField: priority
 * ```
 */
export const KanbanCardSchema = Schema.Struct({
  /** Child components for the card body (supports $record.* variables) */
  children: Schema.optional(
    Schema.Array(
      Schema.Record(Schema.String, Schema.Unknown).annotate({
        description: 'One child component definition, rendered inside the card',
      })
    ).pipe(
      Schema.annotate({
        description: 'Child component definitions for the card body',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** What a click on the card does — `navigate` or `openDrawer` */
  onClick: Schema.optional(CardClickActionSchema),
  /** Field reference or $record.* variable for the cover image URL */
  coverImage: Schema.optional(
    Schema.String.annotate({
      description:
        'Image URL or $record.* variable for card cover image; a `$record.*` naming an attachment field draws its file',
      examples: ['$record.thumbnail', '$record.coverImage'],
    })
  ),
  /** Field name whose values map to card background colors */
  colorField: Schema.optional(
    Schema.String.annotate({
      howTo:
        'Nothing validates this name. A misspelling, or a field with no options, is not an error — the board simply stays monochrome and nothing reports the typo.',
      description: 'Field name whose values determine card background color',
      examples: ['priority', 'category'],
    })
  ),
  /** Metadata fields displayed in the card footer */
  footer: Schema.optional(
    Schema.Array(KanbanCardFooterItemSchema).pipe(
      Schema.annotate({
        description: 'Metadata fields displayed in the card footer area',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
  identifier: 'KanbanCard',
  title: 'Kanban Card',
  description: 'Template configuration for how records render as kanban cards',
})

// ---------------------------------------------------------------------------
// KanbanDropHookSchema
// ---------------------------------------------------------------------------

/**
 * What runs after a card dropped into one column has been saved.
 *
 * Some moves need a value from the person at that moment — the amount when a
 * deal is won, the reason when it is lost. A hook names the column value it
 * answers to and the action to run once the move has persisted, with the moved
 * card's record in scope: `openDrawer` opens the named drawer on that record
 * (the quick-edit drawer holding the amount), `fill` writes one of its values
 * into a form on the page.
 *
 * Post-persist only: the move is saved first, and a move that fails to save
 * runs no hook. A drop into a column no hook names runs nothing extra.
 *
 * @example
 * ```yaml
 * drag:
 *   onDrop:
 *     - when: { value: Won }
 *       action: { action: openDrawer, component: deal-won }
 * ```
 */
export const KanbanDropHookSchema = Schema.Struct({
  /** Which drops the hook answers to. */
  when: Schema.Struct({
    /** The column value, as the grouping field spells it. */
    value: Schema.String.annotate({
      description:
        'The column value a card must be dropped into for the hook to run, as the grouping field spells it',
      examples: ['Won', 'Lost'],
    }),
  }).annotate({
    description: 'Which drops the hook answers to',
  }),
  /** The action run once the move has been saved, on the moved card's record. */
  action: Schema.Union([OpenDrawerActionSchema, FillActionSchema]).annotate({
    description:
      'What runs once the move has been saved, with the moved card as `$record`: `openDrawer` opens the named drawer on that record, `fill` writes one of its values into a form control on the page',
  }),
}).annotate({
  identifier: 'KanbanDropHook',
  title: 'Kanban Drop Hook',
  description: 'An action run after a card dropped into one column has been saved',
})

// ---------------------------------------------------------------------------
// KanbanDragSchema
// ---------------------------------------------------------------------------

/**
 * Kanban drag-and-drop configuration
 *
 * Controls whether cards can be dragged between columns and how
 * changes are persisted to the database.
 *
 * @example
 * ```yaml
 * drag:
 *   enabled: true
 *   persistAction:
 *     type: crud
 *     operation: update
 *     table: tasks
 * ```
 */
export const KanbanDragSchema = Schema.Struct({
  /** Whether drag-and-drop is enabled */
  enabled: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Enable drag-and-drop between columns (default: true)',
    })
  ),
  /**
   * Action that persists the group-field change after a card is dropped.
   *
   * Narrowed to `crud`, the only variant the drop handler dispatches on
   * (`persistKanbanDrop` in
   * `src/presentation/islands/kanban/persist-drop.ts`). The full
   * `ActionSchema` is not accepted here: the other eight variants would
   * validate and then silently return `{ ok: true }` — the card staying moved
   * on screen and nothing ever written.
   *
   * Known residual gaps (NOT fixed by this narrowing, since expressing them
   * needs more than a union):
   * - The handler additionally requires `operation: 'update'`; a `crud` action
   *   with `create` / `delete` still validates and does nothing.
   * - The PATCH body is hardcoded to the groupBy field, so a configured crud
   *   payload is ignored.
   * - Within-column reorders never call this action at all; only cross-column
   *   moves persist.
   */
  persistAction: Schema.optional(CrudActionSchema),
  /**
   * Actions run after a drop has been saved, one per column value that needs
   * one. The first hook whose `when.value` is the column the card landed in
   * runs; a drop elsewhere, or a move that fails to save, runs none.
   */
  onDrop: Schema.optional(
    Schema.Array(KanbanDropHookSchema).pipe(
      Schema.annotate({
        description:
          'Actions run after a card has been dropped and its move saved, each for one column value. A move that fails to save runs none.',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
  identifier: 'KanbanDrag',
  title: 'Kanban Drag',
  description: 'Drag-and-drop configuration for kanban cards',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type KanbanGroupBy = Schema.Schema.Type<typeof KanbanGroupBySchema>
export type KanbanSwimlanes = Schema.Schema.Type<typeof KanbanSwimlanesSchema>
export type KanbanCardFooterItem = Schema.Schema.Type<typeof KanbanCardFooterItemSchema>
export type KanbanCard = Schema.Schema.Type<typeof KanbanCardSchema>
export type KanbanDropHook = Schema.Schema.Type<typeof KanbanDropHookSchema>
export type KanbanDrag = Schema.Schema.Type<typeof KanbanDragSchema>
