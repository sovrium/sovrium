/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTablePanelCaptionClasses,
  computeTableToolbarButtonClasses,
} from '@/presentation/design/table-default-classes'
import { ViewsMenu, type ViewsMenuEntry } from '../views-menu'

/**
 * The saved-views surface: Save view, the Views dropdown, and the
 * Modified-indicator with its companion Save / Save-as-new buttons.
 *
 * `viewEntries` is the merged developer-views + personal-saved-views list the
 * dropdown projects. `activeViewSource` discriminates between the two so the
 * Save button can hide for developer views, which are read-only.
 */
export interface ViewsControlsProps {
  /** Read by the toolbar shell, which owns this region's render gate. */
  readonly enabled: boolean
  readonly viewEntries: ReadonlyArray<ViewsMenuEntry>
  readonly canSaveCurrentView: boolean
  readonly isViewModified: boolean
  readonly activeViewSource: 'developer' | 'personal' | null
  readonly onOpenSaveViewDialog: () => void
  readonly onSelectView: (entry: ViewsMenuEntry) => void
  readonly onDeleteView: (entry: ViewsMenuEntry) => void
  readonly onSaveModifiedView: () => void
}

export function ViewsControls(props: ViewsControlsProps) {
  return (
    <>
      {/* Save view — disabled until at least one filter / sort / group is active. */}
      <button
        type="button"
        aria-label="Save view"
        disabled={!props.canSaveCurrentView}
        onClick={props.onOpenSaveViewDialog}
        className={computeTableToolbarButtonClasses({ disabled: !props.canSaveCurrentView })}
      >
        Save view
      </button>
      <ViewsMenu
        views={props.viewEntries}
        onSelectView={props.onSelectView}
        onSaveCurrentView={props.onOpenSaveViewDialog}
        onDeleteView={props.onDeleteView}
      />
      {/* Modified-indicator: appears when the user has diverged from a
       * loaded saved view. The companion Save button overwrites the
       * loaded view (personal views only); `Save as new` opens the same
       * Save dialog and persists as a fresh row. */}
      {props.isViewModified && (
        <>
          <span
            data-testid="view-modified-indicator"
            className={`text-xs italic ${computeTablePanelCaptionClasses()}`}
          >
            Modified
          </span>
          {props.activeViewSource === 'personal' && (
            <button
              type="button"
              aria-label="Save"
              onClick={props.onSaveModifiedView}
              className={computeTableToolbarButtonClasses()}
            >
              Save
            </button>
          )}
          <button
            type="button"
            aria-label="Save as new"
            onClick={props.onOpenSaveViewDialog}
            className={computeTableToolbarButtonClasses()}
          >
            Save as new
          </button>
        </>
      )}
    </>
  )
}
