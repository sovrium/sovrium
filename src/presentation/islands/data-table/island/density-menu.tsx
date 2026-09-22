/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { useCallback } from 'react'
import {
  computeTableMenuClasses,
  computeTableMenuItemClasses,
} from '@/presentation/design/table-default-classes'
import { DROPDOWN_TRIGGER_CLASS } from './use-dropdown-state'
import type { RowDensity } from '../../hooks/use-table-preferences'

/**
 * Dropdown density picker exposed in the data-table toolbar (PG-03 /
 * [internal ref]).
 *
 * Renders a `<button name=/density/>` trigger and a `role="menu"` with three
 * `role="menuitem"` options (Compact / Normal / Spacious) — matching the spec
 * locator pattern `page.getByRole('menuitem', { name: /compact/i })`.
 *
 * Persistence is the caller's responsibility: `onSelect` fires on click and
 * is wired by the orchestrator to the table-preferences PATCH.
 */
interface DensityMenuProps {
  readonly current: RowDensity
  readonly onSelect: (density: RowDensity) => void
}

const DENSITY_LABELS: ReadonlyArray<{
  readonly key: RowDensity
  readonly label: string
}> = [
  { key: 'compact', label: 'Compact' },
  { key: 'normal', label: 'Normal' },
  { key: 'spacious', label: 'Spacious' },
]

interface DensityMenuItemProps {
  readonly densityKey: RowDensity
  readonly label: string
  readonly current: RowDensity
  readonly onSelect: (density: RowDensity) => void
}

function DensityMenuItem({ densityKey, label, current, onSelect }: DensityMenuItemProps) {
  const handleClick = useCallback(() => onSelect(densityKey), [densityKey, onSelect])
  return (
    <Menu.Item
      // `data-[highlighted]` is Base UI's keyboard/pointer focus, which is a
      // DIFFERENT state from `active` (the density currently in force) — so the
      // well arrives twice, once per state, and never from a third literal.
      className={`${computeTableMenuItemClasses({ active: current === densityKey })} data-[highlighted]:bg-background-subtle cursor-pointer ${
        current === densityKey ? 'font-medium' : ''
      }`}
      onClick={handleClick}
    >
      {label}
    </Menu.Item>
  )
}

export function DensityMenu({ current, onSelect }: DensityMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={DROPDOWN_TRIGGER_CLASS}
        aria-label="Density"
      >
        Density
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup
            aria-label="Row density"
            className={computeTableMenuClasses()}
          >
            {DENSITY_LABELS.map(({ key, label }) => (
              <DensityMenuItem
                key={key}
                densityKey={key}
                label={label}
                current={current}
                onSelect={onSelect}
              />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
