/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui data-table-faceted-filter (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

import { Popover } from '@base-ui/react/popover'
import {
  computeTableToolbarButtonClasses,
  computeTableToolbarCountClasses,
} from '@/presentation/design/table-default-classes'
import {
  computeFloatingPositionerClasses,
  computePopoverContentClasses,
} from '../../overlays/popover-default-classes'
import { useGridString } from '../island/grid-strings'
import { FacetTriggerGlyph } from './facet-glyphs'
import { FacetList } from './facet-list'
import type { ReactElement } from 'react'

/** One option a facet lists: the stored value and the words it shows. */
export interface FacetOption {
  readonly value: string
  readonly label: string
}

/** Everything one facet button needs, resolved by the view. */
export interface FacetControl {
  readonly field: string
  readonly label: string
  readonly options: readonly FacetOption[]
  readonly selected: readonly string[]
  readonly onToggle: (field: string, value: string) => void
  readonly onClear: (field: string) => void
}

/** The checked values on the button: each one up to two, a count past that. */
function SelectedBadges({
  options,
  selected,
}: Pick<FacetControl, 'options' | 'selected'>): ReactElement | undefined {
  const selectedLabel = useGridString('datatable.facet.selected', 'selected')
  if (selected.length === 0) return undefined
  const badges =
    selected.length > 2
      ? [`${String(selected.length)} ${selectedLabel}`]
      : options.filter((option) => selected.includes(option.value)).map((option) => option.label)
  return (
    <>
      <span
        aria-hidden="true"
        data-slot="separator"
        className="bg-border mx-1 h-4 w-px shrink-0"
      />
      <span className="flex gap-1">
        {badges.map((badge) => (
          <span
            key={badge}
            data-slot="badge"
            className={computeTableToolbarCountClasses()}
          >
            {badge}
          </span>
        ))}
      </span>
    </>
  )
}

/**
 * shadcn's `DataTableFacetedFilter`: a dashed toolbar button named after its
 * column, opening a popover checklist of the field's declared options. Checked
 * options keep the rows holding any of them.
 */
export function FacetedFilter(props: FacetControl): ReactElement {
  return (
    <Popover.Root>
      <Popover.Trigger
        data-slot="popover-trigger"
        className={computeTableToolbarButtonClasses({ dashed: true })}
      >
        <FacetTriggerGlyph />
        {props.label}
        <SelectedBadges
          options={props.options}
          selected={props.selected}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          className={computeFloatingPositionerClasses()}
        >
          <Popover.Popup
            data-slot="popover-content"
            aria-label={props.label}
            className={`${computePopoverContentClasses()} w-[200px] p-0`}
          >
            <FacetList {...props} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
