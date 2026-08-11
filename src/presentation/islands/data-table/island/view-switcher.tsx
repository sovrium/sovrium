/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ActiveViewType } from './use-ui-state'
import type {
  DataTableViewLabels,
  DataTableViewType,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'

/**
 * English defaults for every switcher control.
 *
 * `satisfies Record<DataTableViewType, string>` is a REAL totality guard here,
 * unlike a `Partial<Record<…>>`: adding a fifth literal to
 * `DataTableViewTypeSchema` without adding its default is a compile error, so a
 * new view type can never ship with a blank accessible name.
 */
const DEFAULT_VIEW_LABELS = {
  grid: 'Grid',
  kanban: 'Kanban',
  calendar: 'Calendar',
  gallery: 'Gallery',
} satisfies Record<DataTableViewType, string>

/** Accessible name of the switcher group when the config translates nothing. */
const DEFAULT_GROUP_LABEL = 'View'

/**
 * Resolve one control's label. Every `viewLabels` key is INDEPENDENTLY
 * optional, so a half-translated app (the common real state) keeps the English
 * default on the keys it did not translate.
 */
const labelFor = (view: DataTableViewType, viewLabels: DataTableViewLabels | undefined): string =>
  viewLabels?.[view] ?? DEFAULT_VIEW_LABELS[view]

interface ViewSwitcherProps {
  /** Ordered view types the switcher offers — the config's `views`, tab order. */
  readonly views: readonly DataTableViewType[]
  readonly viewLabels?: DataTableViewLabels
  readonly activeView: ActiveViewType
  /** Stable handler; reads its target from the button's `data-view-type`. */
  readonly onSelectViewType: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/**
 * The toolbar's view-type switcher.
 *
 * The labels are an ACCESSIBILITY contract, not decoration: each is both the
 * button's visible text and its `aria-label`, so a French app that sets
 * `viewLabels` stops announcing "Grid" and "Kanban" mid-sentence to a screen
 * reader. Both are set from the same string, so they can never disagree — a
 * config cannot translate the visible text while leaving the announced name in
 * English.
 */
export function ViewSwitcher({
  views,
  viewLabels,
  activeView,
  onSelectViewType,
}: ViewSwitcherProps) {
  const groupLabel = viewLabels?.group ?? DEFAULT_GROUP_LABEL
  return (
    <div
      data-testid="view-switcher"
      role="group"
      aria-label={groupLabel}
      className="inline-flex items-center gap-1"
    >
      {views.map((view) => {
        const label = labelFor(view, viewLabels)
        return (
          <button
            key={view}
            type="button"
            // The handler reads this back off `event.currentTarget`, which is
            // what lets every button share ONE stable callback reference (an
            // inline `() => select(view)` is what react-perf forbids).
            data-view-type={view}
            aria-label={label}
            aria-pressed={activeView === view}
            onClick={onSelectViewType}
            className={`rounded border px-2 py-1 text-xs ${
              activeView === view
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-background-subtle'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
