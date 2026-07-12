/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { type ReactElement } from 'react'
import {
  ENTITY_TYPE_LABELS,
  type AdminSearchGroup,
  type AdminSearchResult,
} from './admin-command-palette-data'

function ResultOption({
  result,
  badge,
  onSelect,
}: {
  readonly result: AdminSearchResult
  readonly badge: string
  readonly onSelect: (href: string) => void
}): ReactElement {
  return (
    <li
      role="option"
      aria-label={result.title}
      aria-selected="false"
      onClick={() => onSelect(result.href)}
      className="hover:bg-background-subtle flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm"
    >
      <span className="text-foreground truncate font-medium">{result.title}</span>
      <span className="border-border text-foreground-subtle shrink-0 rounded border px-1.5 py-0.5 text-xs">
        {badge}
      </span>
    </li>
  )
}

function ResultGroup({
  group,
  onSelect,
}: {
  readonly group: AdminSearchGroup
  readonly onSelect: (href: string) => void
}): ReactElement {
  const label = ENTITY_TYPE_LABELS[group.type]
  return (
    <div className="flex flex-col gap-1">
      <p className="text-foreground-subtle px-1 text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <ul
        role="listbox"
        aria-label={label}
        className="flex flex-col gap-1"
      >
        {group.results.map((result) => (
          <ResultOption
            key={`${result.type}:${result.entityId}`}
            result={result}
            badge={label}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  )
}

export function GroupedResults({
  groups,
  onSelect,
}: {
  readonly groups: ReadonlyArray<AdminSearchGroup>
  readonly onSelect: (href: string) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <ResultGroup
          key={group.type}
          group={group}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export function PaletteEmptyPrompt(): ReactElement {
  return (
    <p className="text-foreground-subtle px-3 py-6 text-center text-sm">
      Recherchez dans toutes vos données
    </p>
  )
}

export function PaletteLoading(): ReactElement {
  return (
    <p
      role="status"
      className="text-foreground-subtle px-3 py-6 text-center text-sm"
    >
      Recherche en cours…
    </p>
  )
}

export function PaletteNoResults({ query }: { readonly query: string }): ReactElement {
  return (
    <p
      role="status"
      className="text-foreground-subtle px-3 py-6 text-center text-sm"
    >
      {`Aucun résultat pour « ${query} »`}
    </p>
  )
}
