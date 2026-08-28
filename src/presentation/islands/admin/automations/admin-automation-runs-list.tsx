/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automation + status filter comboboxes for the CONVERTED automation-runs
 * directory.
 *
 * The run-history LIST is now a config `data-table` bound by `dataSource.system`
 * to `GET /api/admin/automations/runs`; the two domain-specific server-side
 * filters ("Filter by automation" / "Filter by status") live OUTSIDE the
 * data-table toolbar and are rendered by `shared-filter-select-island` (the
 * config shared-filter publisher), which reuses these two presentational
 * comboboxes. The dashboard is a read-only
 * DATA console (config code-only, [internal ref]): runs are OBSERVED here, not
 * triggered.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop -- conventional React event-handler pattern (select onChange); these are presentational sub-components re-rendered on filter changes, not in a hot path. */

import { type ReactElement } from 'react'

/**
 * The automation filter combobox ("Filter by automation", [internal ref]).
 * Defaults to "All" (all runs across every automation, value `''`); selecting
 * a name forwards it as the `?automationName=` query the runs endpoint filters
 * on. Replaces the old left-rail automation picker — selection is a filter.
 */
export function AutomationFilter({
  value,
  onChange,
  names,
}: {
  readonly value: string
  readonly onChange: (automation: string) => void
  readonly names: ReadonlyArray<string>
}): ReactElement {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-foreground-subtle">Automation</span>
      <select
        aria-label="Filter by automation"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background text-foreground rounded-md border px-2 py-1 text-sm"
      >
        <option value="">All</option>
        {names.map((name) => (
          <option
            key={name}
            value={name}
          >
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * The status filter combobox ("Filter by status"). The "Success" option carries
 * the value `success` (the operator-facing vocabulary); the filters island maps
 * it to the engine's terminal success status (`completed`) when building the
 * `?status=` query the runs endpoint filters on.
 */
export function StatusFilter({
  value,
  onChange,
}: {
  readonly value: string
  readonly onChange: (status: string) => void
}): ReactElement {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-foreground-subtle">Status</span>
      <select
        aria-label="Filter by status"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background text-foreground rounded-md border px-2 py-1 text-sm"
      >
        <option value="">All</option>
        <option value="success">Success</option>
        <option value="failed">Failed</option>
        <option value="completed-with-errors">Partial</option>
      </select>
    </label>
  )
}
