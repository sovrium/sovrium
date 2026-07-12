/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { navigateAdminSpa } from '../spa-nav/admin-spa-nav'
import { fetchAdminSearch, type AdminSearchGroup } from './admin-command-palette-data'
import {
  GroupedResults,
  PaletteEmptyPrompt,
  PaletteLoading,
  PaletteNoResults,
} from './admin-command-palette-results'

const DEBOUNCE_MS = 200

function useOpenIntent(open: () => void): void {
  useEffect(() => {
    const flagWindow = window as unknown as { __sovriumOpenCommandPalette?: boolean }
    if (flagWindow.__sovriumOpenCommandPalette) {
      flagWindow.__sovriumOpenCommandPalette = false
      open()
    }
    const handler = (): void => open()
    document.addEventListener('sovrium:open-command-palette', handler)
    return () => document.removeEventListener('sovrium:open-command-palette', handler)
  }, [open])
}

interface SearchState {
  readonly groups: ReadonlyArray<AdminSearchGroup>
  readonly loading: boolean
  readonly resolvedQuery: string
}

function useAdminSearch(query: string): SearchState {
  const [state, setState] = useState<SearchState>({ groups: [], loading: false, resolvedQuery: '' })
  const requestId = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length === 0) {
      setState({ groups: [], loading: false, resolvedQuery: '' })
      return undefined
    }
    setState((prev) => ({ ...prev, loading: true }))
    const id = requestId.current + 1
    requestId.current = id
    const timer = setTimeout(() => {
      void fetchAdminSearch(trimmed).then((response) => {
        if (requestId.current !== id) return
        setState({ groups: response?.groups ?? [], loading: false, resolvedQuery: trimmed })
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  return state
}

function PaletteSearchbox({
  query,
  setQuery,
}: {
  readonly query: string
  readonly setQuery: (value: string) => void
}): ReactElement {
  return (
    <input
      autoFocus
      type="search"
      role="searchbox"
      aria-label="Rechercher dans toutes vos données"
      placeholder="Rechercher dans toutes vos données"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      className="border-border bg-background-raised text-foreground rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
    />
  )
}

function PaletteBody({
  query,
  search,
  onSelect,
}: {
  readonly query: string
  readonly search: SearchState
  readonly onSelect: (href: string) => void
}): ReactElement {
  if (query.trim().length === 0) return <PaletteEmptyPrompt />
  if (search.loading || search.resolvedQuery !== query.trim()) return <PaletteLoading />
  if (search.groups.length === 0) return <PaletteNoResults query={query.trim()} />
  return (
    <GroupedResults
      groups={search.groups}
      onSelect={onSelect}
    />
  )
}

function PaletteDialog({
  query,
  setQuery,
  search,
  onSelect,
}: {
  readonly query: string
  readonly setQuery: (value: string) => void
  readonly search: SearchState
  readonly onSelect: (href: string) => void
}): ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rechercher — Recherche de commandes — Command palette"
      className="border-border bg-background mx-auto mt-[12vh] flex w-full max-w-xl flex-col gap-2 rounded-lg border p-4 shadow-xl"
    >
      <PaletteSearchbox
        query={query}
        setQuery={setQuery}
      />
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        <PaletteBody
          query={query}
          search={search}
          onSelect={onSelect}
        />
      </div>
      <p className="text-foreground-subtle px-1 text-xs">Échap pour fermer</p>
    </div>
  )
}

function useCloseOnEscape(isOpen: boolean, close: () => void): void {
  useEffect(() => {
    if (!isOpen) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, close])
}

function PaletteOverlay({
  onDismiss,
  children,
}: {
  readonly onDismiss: () => void
  readonly children: ReactElement
}): ReactElement {
  return createPortal(
    <div
      data-overlay
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
      className="bg-scrim/50 fixed inset-0 z-50 overflow-y-auto p-4"
    >
      {children}
    </div>,
    document.body
  )
}

export default function AdminCommandPaletteIsland(): ReactElement | undefined {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  useOpenIntent(open)
  useCloseOnEscape(isOpen, close)

  const search = useAdminSearch(query)

  const onSelect = useCallback(
    (href: string): void => {
      close()
      navigateAdminSpa(href)
    },
    [close]
  )

  if (!isOpen) return undefined
  return (
    <PaletteOverlay onDismiss={close}>
      <PaletteDialog
        query={query}
        setQuery={setQuery}
        search={search}
        onSelect={onSelect}
      />
    </PaletteOverlay>
  )
}
