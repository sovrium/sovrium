/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SharedFilterPublisherConfig } from '../hooks/use-shared-filter-publisher'

export interface OptionItem {
  readonly label: string
  readonly value: string
  readonly disabled?: boolean
  readonly icon?: string
  /** The group the option is listed under; consecutive options of one group form it. */
  readonly group?: string
}

export interface SelectIslandProps {
  readonly options?: readonly OptionItem[]
  /**
   * Marks this control as a shared-filter PUBLISHER: every change publishes the
   * current value on channel `bindTo` under key `param`, and every data source
   * whose `bindTo` names that channel merges it into its next read — as a
   * param, or as a condition. `controls` is stamped by the page: the ids of the
   * data components on the channel, for `aria-controls`.
   */
  readonly publishes?: SharedFilterPublisherConfig & { readonly controls?: string }
  readonly placeholder?: string
  /**
   * Whether the reader may hold more than one choice at a time.
   *
   * Read by `PlainSelect` only: it reaches `Select.Root`'s own `multiple`, and
   * the selected set is named in the closed trigger as one comma-separated
   * label — the primitive's own answer, and the one that keeps the trigger a
   * single-line field. On the searchable half it holds a set chosen by typing.
   */
  readonly multiple?: boolean
  readonly searchable?: boolean
  /** On a combobox holding a set: draw each chosen value as a removable chip. */
  readonly chips?: boolean
  /** The form field name; a combobox submits each chosen value under it. */
  readonly name?: string
  /** Draw a clear control once a value is chosen (plain, single select). */
  readonly clearable?: boolean
  /** Placeholder shown inside the combobox search input (only used when `searchable: true`). */
  readonly searchPlaceholder?: string
  /** Accept typed values not in the option list (combobox free-form input). */
  readonly allowCustomValue?: boolean
  readonly defaultValue?: string
  readonly disabled?: boolean
  /** The id of the `field` label that names the trigger, when the select draws no label. */
  readonly labelledBy?: string
  /** The control's name when it draws no `label` and no field label names it. */
  readonly ariaLabel?: string
  readonly label?: string
  /** The select's words in the page language (`select.*`), where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>>
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  /**
   * `design.components.select.parts`, minus `root`.
   *
   * The root part is already inside `className` — the server folded it in
   * before this island existed — so these are the parts that land on elements
   * the island builds itself, which no `className` can reach. Absent unless the
   * operator declared such a part, so the serialised props of an app that
   * declares nothing are unchanged.
   *
   * `PlainSelect` reads `label`, `trigger`, `icon` and `list`: the four parts it
   * renders itself. The option rows are deliberately NOT in that vocabulary —
   * they are drawn by the shared `select-option-renderers`, whose module-level
   * function identity is what keeps the combobox list off the
   * `react-perf/jsx-no-new-function-as-prop` path, and threading per-instance
   * classes through it would give that back. `SearchableSelect` reads none of
   * them: it swaps the trigger for an input inside a group, so `trigger` does
   * not name the same element there and the vocabulary has to be decided for
   * that shape rather than assumed from this one.
   */
  readonly designClasses?: Readonly<Record<string, string>>
  /**
   * The non-overridable accessibility floor for those same parts, keyed the
   * same way — applied AFTER the operator's classes so it wins.
   *
   * It has to cross as its own map rather than ride in `className`: the element
   * it lands on does not exist until this island builds it, so the server has
   * nothing to merge it into. Today it carries the trigger's keyboard focus
   * ring and nothing else; see `PART_FLOOR` in
   * `@/presentation/utils/design/component-floor` for the entry rule.
   */
  readonly designFloor?: Readonly<Record<string, string>>
  /**
   * `design.components.select.replace` — drop Sovrium's recipe rather than
   * layer the operator's classes onto it.
   *
   * The root's copy of this decision was taken server-side and is already
   * reflected in `className`. An inner part is built here, so this is the only
   * place the same decision can be taken for it — and taking it for some of
   * this island's parts and not others would make `replace: true` look like it
   * half-worked. The floor above is unaffected by it, which is the whole reason
   * the floor is a separate layer.
   */
  readonly designReplace?: boolean
}
