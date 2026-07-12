/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { type ReactElement } from 'react'

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
      <span className="text-foreground-subtle">Automatisation</span>
      <select
        aria-label="Filtrer par automatisation"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background text-foreground rounded-md border px-2 py-1 text-sm"
      >
        <option value="">Toutes</option>
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

export function StatusFilter({
  value,
  onChange,
}: {
  readonly value: string
  readonly onChange: (status: string) => void
}): ReactElement {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-foreground-subtle">État</span>
      <select
        aria-label="Filtrer par état"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background text-foreground rounded-md border px-2 py-1 text-sm"
      >
        <option value="">Tous</option>
        <option value="success">Succès</option>
        <option value="failed">Échec</option>
        <option value="completed-with-errors">Partiel</option>
      </select>
    </label>
  )
}
