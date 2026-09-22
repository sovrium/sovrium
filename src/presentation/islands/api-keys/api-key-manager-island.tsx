/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `/_admin/api-keys` — the operator's own API keys: mint, copy once, revoke.
 *
 * ONE island rather than a config `table` plus a reveal island, for two
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import {
  computeFormFieldErrorClasses,
  computeFormHelpTextClasses,
} from '@/presentation/design/form-layout-classes'
import { READ_ONCE_QUERY_OPTIONS } from '../runtime/query-client'
import { createApiKey, fetchApiKeys, revokeApiKey, type ApiKeySummary } from './api-key-client'
import { ApiKeyCreate } from './api-key-create'
import { ApiKeyList, RevokeGate } from './api-key-list'
import { ApiKeyReveal } from './api-key-reveal'
import type { ReactElement } from 'react'

/** Load state, kept explicit so a failed read says so instead of reading as "no keys". */
type LoadState = 'loading' | 'ready' | 'failed'

/** The query key for the caller's own keys — the one entry both mutations invalidate. */
const API_KEYS_QUERY_KEY = ['api-keys', 'own'] as const

/**
 * Read the caller's own keys, rejecting on a failed read.
 *
 * `fetchApiKeys` reports failure as `undefined` so a caller cannot confuse it
 * with an empty list. A query needs that distinction on the OTHER axis — error
 * versus data — so the sentinel is converted at this boundary rather than
 * inside the transport, which still has the two-state contract its own callers
 * were written against.
 */
async function fetchApiKeysOrThrow(): Promise<readonly ApiKeySummary[]> {
  const next = await fetchApiKeys()
  // eslint-disable-next-line functional/no-throw-statements -- a query reports a failed read by rejecting; the transport's `undefined` sentinel is converted here
  if (next === undefined) throw new Error('Failed to read the caller’s API keys')
  return next
}

/** The keys themselves, and the two operations that change them. */
function useApiKeys(): {
  readonly keys: readonly ApiKeySummary[]
  readonly load: LoadState
  /** Mint a key and refresh the list; resolves the plaintext value, or `undefined`. */
  readonly create: (name: string) => Promise<string | undefined>
  readonly revoke: (keyId: string) => void
} {
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: API_KEYS_QUERY_KEY,
    queryFn: fetchApiKeysOrThrow,
    ...READ_ONCE_QUERY_OPTIONS,
  })

  // `invalidateQueries` is AWAITED, and that is the whole contract: the list has
  // to be on screen behind the reveal panel before the operator can dismiss it
  //. Firing the invalidation and returning would
  // resolve `create` while the refetch is still in flight.
  const refresh = useCallback(
    (): Promise<void> => queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY }),
    [queryClient]
  )

  const createMutation = useMutation({
    mutationFn: createApiKey,
    // A refused mint resolves `undefined` rather than rejecting, and there is
    // nothing new to list — so the refetch is conditional. Invalidating
    // unconditionally would issue a GET the old code never made.
    onSuccess: (created) => (created === undefined ? undefined : refresh()),
  })

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: refresh,
  })

  const create = useCallback(
    async (name: string): Promise<string | undefined> => {
      const created = await createMutation.mutateAsync(name)
      return created?.key
    },
    [createMutation]
  )

  const revoke = useCallback(
    (keyId: string): void => revokeMutation.mutate(keyId),
    [revokeMutation]
  )

  // A revoke that fails is reported the same way a failed read is — the list on
  // screen can no longer be trusted to describe the account's keys.
  const load: LoadState =
    listQuery.isError || revokeMutation.isError
      ? 'failed'
      : listQuery.isPending
        ? 'loading'
        : 'ready'

  return { keys: listQuery.data ?? [], load, create, revoke }
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
      {load === 'loading' && <p className={computeFormHelpTextClasses()}>Loading your keys…</p>}
      {load === 'failed' && (
        <p className={computeFormFieldErrorClasses()}>
          Could not load your API keys. Reload to try again.
        </p>
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
