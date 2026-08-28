/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `/_admin/api-keys` — the operator's own API keys: mint, copy once, revoke.
 *
 * ONE island rather than a config `data-table` plus a reveal island, for two
 * reasons that are both about correctness rather than taste:
 *
 *  1. **The revoke gate has to render after the table.** See the note in
 *     `api-key-list.tsx` — the shared inline gate replaces the clicked row's
 *     button, which puts it BEFORE any row below it.
 *  2. **The list and the mint share one state.** After the operator
 *     acknowledges a revealed key the list must already show it
 *. Two islands would have to coordinate
 *     that through a refetch event; one island just holds the rows.
 *
 * D12 — this surface is admin-tier only in v1, and that is the `/_admin/*` gate
 * doing its normal job, not a rule this island enforces: an anonymous caller
 * gets 404 before any of this is built. The API path is unaffected — a plain
 * `member` mints and uses keys through `/api/auth/api-key/*` with no console.
 */

import { useCallback, useEffect, useState } from 'react'
import { createApiKey, fetchApiKeys, revokeApiKey, type ApiKeySummary } from './api-key-client'
import { ApiKeyCreate } from './api-key-create'
import { ApiKeyList, RevokeGate } from './api-key-list'
import { ApiKeyReveal } from './api-key-reveal'
import type { ReactElement } from 'react'

/** Load state, kept explicit so a failed read says so instead of reading as "no keys". */
type LoadState = 'loading' | 'ready' | 'failed'

/** The keys themselves, and the two operations that change them. */
function useApiKeys(): {
  readonly keys: readonly ApiKeySummary[]
  readonly load: LoadState
  /** Mint a key and refresh the list; resolves the plaintext value, or `undefined`. */
  readonly create: (name: string) => Promise<string | undefined>
  readonly revoke: (keyId: string) => void
} {
  const [keys, setKeys] = useState<readonly ApiKeySummary[]>([])
  const [load, setLoad] = useState<LoadState>('loading')

  const refresh = useCallback(async (): Promise<void> => {
    const next = await fetchApiKeys()
    if (next === undefined) {
      setLoad('failed')
      return
    }
    setKeys(next)
    setLoad('ready')
  }, [])

  useEffect(() => {
    refresh().catch(() => setLoad('failed'))
  }, [refresh])

  const create = useCallback(
    async (name: string): Promise<string | undefined> => {
      const created = await createApiKey(name)
      if (created === undefined) return undefined
      // Refresh BEFORE the caller reveals the secret, so the key is already
      // listed behind the panel by the time the operator dismisses it.
      await refresh()
      return created.key
    },
    [refresh]
  )

  const revoke = useCallback(
    (keyId: string): void => {
      revokeApiKey(keyId)
        .then(refresh)
        .catch(() => setLoad('failed'))
    },
    [refresh]
  )

  return { keys, load, create, revoke }
}

export default function ApiKeyManagerIsland(): ReactElement {
  const { keys, load, create, revoke } = useApiKeys()
  const [revealed, setRevealed] = useState('')
  const [pendingRevoke, setPendingRevoke] = useState<ApiKeySummary | undefined>(undefined)

  const mint = useCallback(
    async (name: string): Promise<boolean> => {
      const secret = await create(name)
      if (secret === undefined) return false
      setRevealed(secret)
      return true
    },
    [create]
  )

  const confirmRevoke = useCallback((): void => {
    const target = pendingRevoke
    if (!target) return
    setPendingRevoke(undefined)
    revoke(target.id)
  }, [pendingRevoke, revoke])

  // Dropping the value from state is what removes it from the DOM. It is never
  // parked in an attribute or a data-* payload, so "gone" means gone.
  const dismissReveal = useCallback((): void => setRevealed(''), [])
  const cancelRevoke = useCallback((): void => setPendingRevoke(undefined), [])

  return (
    <div className="flex flex-col gap-4">
      <ApiKeyCreate onCreate={mint} />
      {revealed !== '' && (
        <ApiKeyReveal
          value={revealed}
          onDismiss={dismissReveal}
        />
      )}
      {load === 'loading' && <p className="text-foreground-subtle text-sm">Loading your keys…</p>}
      {load === 'failed' && (
        <p className="text-error-fg text-sm">Could not load your API keys. Reload to try again.</p>
      )}
      {load === 'ready' && (
        <ApiKeyList
          keys={keys}
          onRequestRevoke={setPendingRevoke}
        />
      )}
      {pendingRevoke !== undefined && (
        <RevokeGate
          apiKey={pendingRevoke}
          onConfirm={confirmRevoke}
          onCancel={cancelRevoke}
        />
      )}
    </div>
  )
}
