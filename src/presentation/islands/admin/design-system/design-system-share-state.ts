/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * State lifecycle for the `design-system-share` island ([internal ref] A3 Part 2).
 *
 * Split out of the island so the component stays a thin render — the same shape
 * `admin-agent-conversations` uses for the same reason. Every handler is a
 * `useCallback` rather than an inline arrow, so the island's JSX allocates no
 * function per render (eco: `react-perf/jsx-no-new-function-as-prop`).
 *
 * ─── NOTHING HERE MINTS UNTIL `confirm` IS CALLED ───────────────────────────
 *
 * `openDisclosure` only flips a boolean. That is the A3 condition made
 * structural: the disclosure has to be readable BEFORE the link exists, and a
 * controller that fetched on open would publish the design system at the moment
 * the operator asked what publishing would mean.
 */

import { useCallback, useEffect, useState } from 'react'

/** The list endpoint's row: metadata only — never the secret, never its digest. */
export interface ShareRow {
  readonly id: string
  readonly createdAt: string
}

const SHARES_API = '/api/admin/design-system/shares'

/** Every live share for this app, or the current list unchanged on a failure. */
const fetchShares = async (): Promise<ReadonlyArray<ShareRow> | undefined> => {
  const response = await fetch(SHARES_API)
  return response.ok ? ((await response.json()) as ReadonlyArray<ShareRow>) : undefined
}

/**
 * Mint, and return the absolute reader URL.
 *
 * The plaintext is inside `url` and is read exactly here — it is never lifted
 * into state on its own, so there is no field a future render could print twice.
 */
const postMint = async (): Promise<string | undefined> => {
  const response = await fetch(SHARES_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!response.ok) return undefined
  const minted = (await response.json()) as { readonly url: string }
  return `${globalThis.location.origin}${minted.url}`
}

/**
 * Run one mutation with the busy flag raised.
 *
 * Extracted so `confirm` and `revoke` each read as the request they make. The
 * `finally` is the point: a failed mint must not leave every control disabled
 * with no way back, which is the state a bare `setBusy(false)` after the await
 * would produce.
 */
const withBusy = async (
  setBusy: (value: boolean) => void,
  work: () => Promise<void>
): Promise<void> => {
  setBusy(true)
  try {
    await work()
  } finally {
    setBusy(false)
  }
}

/**
 * What the operator is told when the server refuses a revoke.
 *
 * The panel used to report success unconditionally — the response was discarded
 * and the URL cleared either way — so a refused DELETE left the console showing
 * a dead link while the design system stayed publicly readable. For a share
 * control the safe failure mode is "we could not revoke it": an operator who
 * believes a link is gone stops trying to end it.
 */
const REVOKE_FAILED_MESSAGE =
  'Could not revoke the link — it is still live. Try again, or reload the page to see the current shares.'

/** Everything the island renders from, and the things it can do. */
export interface ShareController {
  readonly shares: ReadonlyArray<ShareRow>
  readonly disclosureOpen: boolean
  /** The absolute URL of the share minted in THIS session, shown once. */
  readonly mintedUrl: string | undefined
  readonly busy: boolean
  /** The share awaiting a revoke confirmation, if the operator asked for one. */
  readonly pendingRevokeId: string | undefined
  /** Set when the server REFUSED a revoke; cleared when the next one is asked for. */
  readonly revokeError: string | undefined
  readonly openDisclosure: () => void
  readonly closeDisclosure: () => void
  readonly confirm: () => void
  /** Ask to revoke `id` — opens the confirmation. Destroys nothing on its own. */
  readonly requestRevoke: (id: string) => void
  /** Back out of a pending revoke, leaving the link working. */
  readonly cancelRevoke: () => void
  /** Carry out the pending revoke. */
  readonly confirmRevoke: () => void
}

/** The confirm-then-revoke half of the controller. */
type RevokeFlow = Pick<
  ShareController,
  'pendingRevokeId' | 'revokeError' | 'requestRevoke' | 'cancelRevoke' | 'confirmRevoke'
>

/**
 * Ask, then act, then read the answer.
 *
 * Split from {@link useDesignSystemShares} because it is a three-state flow of
 * its own — nothing pending, one pending, one refused — and the mint half has
 * no business in it. `onRevoked` runs only after the server confirms.
 */
function useShareRevokeFlow(
  setBusy: (value: boolean) => void,
  onRevoked: () => Promise<void>
): RevokeFlow {
  const [pendingRevokeId, setPendingRevokeId] = useState<string | undefined>(undefined)
  const [revokeError, setRevokeError] = useState<string | undefined>(undefined)

  /**
   * Ask to revoke. Opens the confirmation and destroys NOTHING — revoking is
   * irreversible (only the digest is stored, so the link cannot be brought
   * back), and an irreversible action one click away from a list row is the
   * shape that gets fired by accident.
   */
  const requestRevoke = useCallback((id: string): void => {
    setRevokeError(undefined)
    setPendingRevokeId(id)
  }, [])

  const cancelRevoke = useCallback((): void => setPendingRevokeId(undefined), [])

  const confirmRevoke = useCallback((): void => {
    if (pendingRevokeId === undefined) return
    void withBusy(setBusy, async () => {
      const response = await fetch(`${SHARES_API}/${pendingRevokeId}`, { method: 'DELETE' })
      setPendingRevokeId(undefined)
      // The response is READ. Discarding it — and clearing the panel regardless
      // — is what let the console report a dead link over a share the server had
      // refused to delete.
      if (!response.ok) {
        setRevokeError(REVOKE_FAILED_MESSAGE)
        return
      }
      setRevokeError(undefined)
      await onRevoked()
    })
  }, [pendingRevokeId, setBusy, onRevoked])

  return { pendingRevokeId, revokeError, requestRevoke, cancelRevoke, confirmRevoke }
}

export function useDesignSystemShares(): ShareController {
  const [shares, setShares] = useState<ReadonlyArray<ShareRow>>([])
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const [mintedUrl, setMintedUrl] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async (): Promise<void> => {
    const rows = await fetchShares()
    if (rows !== undefined) setShares(rows)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const openDisclosure = useCallback(() => setDisclosureOpen(true), [])
  const closeDisclosure = useCallback(() => setDisclosureOpen(false), [])

  const confirm = useCallback((): void => {
    void withBusy(setBusy, async () => {
      const url = await postMint()
      if (url === undefined) return
      setMintedUrl(url)
      setDisclosureOpen(false)
      await reload()
    })
  }, [reload])

  const onRevoked = useCallback(async (): Promise<void> => {
    // The minted URL is cleared on ANY successful revoke rather than only its
    // own: the operator cannot tell which id the string on screen belongs to
    // (the token is gone), so leaving it up would advertise a link that may
    // already be dead.
    setMintedUrl(undefined)
    await reload()
  }, [reload])

  const { pendingRevokeId, revokeError, requestRevoke, cancelRevoke, confirmRevoke } =
    useShareRevokeFlow(setBusy, onRevoked)

  return {
    shares,
    disclosureOpen,
    mintedUrl,
    busy,
    pendingRevokeId,
    revokeError,
    openDisclosure,
    closeDisclosure,
    confirm,
    requestRevoke,
    cancelRevoke,
    confirmRevoke,
  }
}
