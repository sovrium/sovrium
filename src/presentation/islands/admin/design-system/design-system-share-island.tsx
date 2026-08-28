/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `design-system-share` island — the mint / revoke affordance on
 * `/_admin/design-system` ([internal ref] amendment A3 Part 2).
 *
 * ─── THE DISCLOSURE IS A CONDITION OF THE AUTHORISATION ─────────────────────
 *
 * A2 could argue "there is nothing here to redact" because a stranger can
 * reconstruct the design system from a stylesheet and a screenshot. That is
 * true of the TOKENS and false of the PROSE: `principles`, `voice`,
 * `colorRoles` and `components` reach no anonymous visitor of the running app
 * today, and per-component `dont` entries are notes an operator wrote for their
 * own team. A3 decides to publish them — but as a publication, with the
 * operator's informed act as the thing that legitimises it.
 *
 * So the dialog below is not a courtesy confirmation. It names all four
 * categories, says the exposure is wider than the visual tokens, says who can
 * read it, and it appears BEFORE anything is minted. "Before" is the
 * load-bearing word: a disclosure shown in a post-mint confirmation informs the
 * operator of a decision already taken. Nothing here calls `POST` until the
 * confirm button is pressed.
 *
 * ─── NO FORM, NO INPUT, NO REFUSED VERB ─────────────────────────────────────
 *
 * `[internal ref]` fixes the console at zero `<form>`s, zero
 * textboxes, and zero buttons matching `/save|set|apply|edit|update|reset|
 * publish/i` — and A3 Part 1 exists to stop that bound moving under
 * implementation pressure. Three consequences are baked into the markup here:
 *
 *  - The dialog is a `<div>` with two buttons, NOT a `<form>`. Wrapping it for
 *    the submit semantics is the ordinary way to build this and would break the
 *    bound.
 *  - The minted URL is a `<p>`, never `<input readonly value={url}>`. That
 *    input is the conventional copy-to-clipboard pattern and is a `textbox`; it
 *    would fail `003` on a page that acquired nothing resembling an editor. The
 *    copy affordance is a button over static text.
 *  - "Create share link" and "Revoke" are outside the refused set, and
 *    accurate: A3 says minting a token is CREATING A RECORD, which D1
 *    authorises by name. "Publish" is the word D1 refuses for `draft → publish`
 *    of configuration — spending it here would collide two verbs the ADR spends
 *    a paragraph separating.
 */

import { useCallback, type ReactElement } from 'react'
import { useDesignSystemShares, type ShareRow } from './design-system-share-state'

const BUTTON =
  'border-border text-foreground hover:bg-surface-subtle rounded-md border px-3 py-1.5 text-sm'
const PRIMARY_BUTTON =
  'bg-primary text-primary-foreground hover:opacity-90 rounded-md px-3 py-1.5 text-sm font-medium'

/** Format a mint timestamp for the list, falling back to the raw value. */
const formatMinted = (value: string): string => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

/**
 * The A3 disclosure.
 *
 * Every clause is asserted by `[internal ref]`, and each assertion is
 * there because the sentence without it would satisfy the letter of the
 * condition and defeat its purpose — naming the four categories while implying
 * they are "just the theme" being the specific failure the "more than" clause
 * blocks.
 */
function ShareDisclosure({
  onConfirm,
  onCancel,
  busy,
}: {
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly busy: boolean
}): ReactElement {
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label="Create a share link"
      data-testid="design-system-share-disclosure"
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <p className="text-foreground text-sm font-medium">
        Anyone with the link can read this design system. No account, no sign-in.
      </p>
      <p className="text-foreground-subtle text-sm leading-relaxed">
        It publishes more than the visual tokens: your design principles, your voice and tone
        guidance, your colour roles and their usage rules, and the per-component notes you wrote —
        including the ones describing what not to do.
      </p>
      <p className="text-foreground-subtle text-sm leading-relaxed">
        The link is unlisted and search engines are told to ignore it, but it is public to whoever
        holds it. You can revoke it at any time.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="design-system-share-confirm"
          className={PRIMARY_BUTTON}
          disabled={busy}
          onClick={onConfirm}
        >
          Create the link
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * The minted link.
 *
 * Shown once, because it exists once: only the digest is stored, so nothing —
 * not this console, not the API — can produce it again. The copy is explicit
 * about that, since an operator who assumes they can come back for it later
 * will not save it now.
 */
function MintedLink({ url }: { readonly url: string }): ReactElement {
  const copy = useCallback(() => void navigator.clipboard?.writeText(url), [url])
  return (
    <div className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-foreground text-sm font-medium">
        Copy this now — it is shown once and cannot be shown again.
      </p>
      <p
        data-testid="design-system-share-url"
        className="text-foreground bg-surface-subtle rounded px-2 py-1 font-mono text-sm break-all"
      >
        {url}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={BUTTON}
          onClick={copy}
        >
          Copy link
        </button>
      </div>
    </div>
  )
}

/**
 * The revoke confirmation.
 *
 * It names the consequence rather than asking "are you sure?": a bare
 * are-you-sure satisfies the letter of a confirm gate while telling the operator
 * nothing they did not already know, and the two facts that matter here are that
 * readers lose access at once and that the link cannot be brought back — only
 * the digest is stored, so nothing can reproduce it.
 */
function RevokeConfirmation({
  onConfirm,
  onCancel,
  busy,
}: {
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly busy: boolean
}): ReactElement {
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label="Revoke this share link"
      data-testid="design-system-share-revoke-confirm"
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <p className="text-foreground text-sm font-medium">
        Anyone holding this link will lose access the moment you revoke it.
      </p>
      <p className="text-foreground-subtle text-sm leading-relaxed">
        This cannot be undone — the link cannot be restored, and creating another one gives you a
        different link you would have to share again.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="design-system-share-revoke-confirm-button"
          className={PRIMARY_BUTTON}
          disabled={busy}
          onClick={onConfirm}
        >
          Revoke the link
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={onCancel}
        >
          Keep the link
        </button>
      </div>
    </div>
  )
}

/** One live share: when it was minted, and the way to end it. */
function ShareListItem({
  share,
  onRevoke,
  busy,
}: {
  readonly share: ShareRow
  readonly onRevoke: (id: string) => void
  readonly busy: boolean
}): ReactElement {
  const revoke = useCallback(() => onRevoke(share.id), [onRevoke, share.id])
  return (
    <li className="border-border flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0">
      <span className="text-foreground-subtle text-sm">Minted {formatMinted(share.createdAt)}</span>
      <button
        type="button"
        data-testid="design-system-share-revoke"
        className={BUTTON}
        disabled={busy}
        onClick={revoke}
      >
        Revoke
      </button>
    </li>
  )
}

/** The live shares, or nothing at all while the design system is unpublished. */
function ShareList({
  shares,
  onRevoke,
  busy,
}: {
  readonly shares: ReadonlyArray<ShareRow>
  readonly onRevoke: (id: string) => void
  readonly busy: boolean
}): ReactElement | undefined {
  if (shares.length === 0) return undefined
  return (
    <ul className="border-border max-w-2xl list-none rounded-lg border px-3">
      {shares.map((share) => (
        <ShareListItem
          key={share.id}
          share={share}
          busy={busy}
          onRevoke={onRevoke}
        />
      ))}
    </ul>
  )
}

/** The share affordance: mint behind a disclosure, list what is live, revoke it. */
export default function DesignSystemShareIsland(): ReactElement {
  const controller = useDesignSystemShares()
  return (
    <section
      aria-label="Share link"
      className="flex flex-col gap-3"
    >
      <h2 className="text-foreground text-base font-semibold tracking-tight">Share link</h2>
      <p className="text-foreground-subtle max-w-2xl text-sm leading-relaxed">
        Hand this design system to a designer, an agency or a client stakeholder through one
        unlisted link — no account on your instance, and you can end it whenever you like.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="design-system-share-mint"
          className={PRIMARY_BUTTON}
          disabled={controller.busy}
          onClick={controller.openDisclosure}
        >
          Create share link
        </button>
      </div>
      {controller.disclosureOpen ? (
        <ShareDisclosure
          busy={controller.busy}
          onConfirm={controller.confirm}
          onCancel={controller.closeDisclosure}
        />
      ) : undefined}
      {controller.mintedUrl === undefined ? undefined : <MintedLink url={controller.mintedUrl} />}
      <ShareList
        shares={controller.shares}
        busy={controller.busy}
        onRevoke={controller.requestRevoke}
      />
      {controller.pendingRevokeId === undefined ? undefined : (
        <RevokeConfirmation
          busy={controller.busy}
          onConfirm={controller.confirmRevoke}
          onCancel={controller.cancelRevoke}
        />
      )}
      {controller.revokeError === undefined ? undefined : (
        <p
          role="alert"
          data-testid="design-system-share-revoke-error"
          className="border-error-border bg-error-subtle text-error-fg max-w-2xl rounded-md border px-3 py-2 text-sm"
        >
          {controller.revokeError}
        </p>
      )}
    </section>
  )
}
