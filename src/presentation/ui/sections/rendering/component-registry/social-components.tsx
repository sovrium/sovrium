/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SSR renderers for the `comments` and `commentCount` page-components.
 *
 * Both renderers emit accessible HTML keyed by `data-component=...`. When
 * the bound `tableName` + `recordId` resolve at SSR time the renderers
 * also emit a `data-island=...` marker so the hydration islands take over
 * once mounted:
 *
 * - `comments` → `comment-thread-island.tsx` (paged list, auth form,
 *   edit / delete, sort dropdown, load-more / numbered pagination)
 * - `commentCount` → `comment-count-island.tsx` (fetches count from the
 *   existing comments-API pagination metadata)
 *
 * The interactive surface (form, edit/delete) is gated by the island; the
 * SSR placeholder always carries the empty-state copy so spec assertions
 * on `[data-component=...]` pass on first paint without JS.
 *
 * Specs: [internal ref] … 035 +
 * [internal ref] … 045
 */

import { GUEST_COMMENT_FORM_RUNTIME } from './guest-comment-runtime'
import {
  buildCommentCountIslandProps,
  buildCommentThreadIslandProps,
  resolveCommentCountFields,
  resolveCommentsFields,
  resolveCountLabel,
  resolveTableCommentsConfig,
} from './social-components-helpers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { ReactElement } from 'react'

/**
 * Stable react-perf-friendly off-screen style for the PG-02 honeypot input.
 * Hoisted to module scope so SSR re-renders don't allocate a fresh object on
 * every paint (the react-perf `jsx-no-new-object-as-prop` rule fires otherwise).
 */
const HONEYPOT_STYLE = {
  position: 'absolute' as const,
  left: '-9999px',
  height: 0,
  width: 0,
}

// eslint-disable-next-line react-refresh/only-export-components -- server-side component-registry module, not a hot-reload candidate; helper components co-locate with the registry by convention
function GuestCommentHoneypot(): ReactElement {
  return (
    <input
      // The honeypot input is always rendered but is invisible to humans
      // (`hidden` attribute + offscreen positioning). Bots that auto-fill
      // every input give themselves away via this field; the create-pipeline
      // silently 200s any submission that fills it.
      type="text"
      name="honeypot"
      data-testid="honeypot-field"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      hidden
      style={HONEYPOT_STYLE}
    />
  )
}

/**
 * Render the guest comment form skeleton (PG-02 guest-comments). Shown in SSR
 * when the table's `comments.guestComments === true`. The form posts to the
 * existing comments API; the comment-thread hydration island layers on top
 * for the authenticated variant.
 *
 * The honeypot input is always emitted (zero-config safety) when guest
 * comments are enabled — matches the F-03 anti-spam floor and the
 * PG-02 locked decision.
 */
// eslint-disable-next-line react-refresh/only-export-components -- server-side component-registry module, not a hot-reload candidate; helper components co-locate with the registry by convention
function GuestCommentFormSkeleton({
  placeholder,
  guestEmailRequired,
  honeypotEnabled,
}: {
  readonly placeholder: string
  readonly guestEmailRequired: boolean
  readonly honeypotEnabled: boolean
}): ReactElement {
  return (
    <form
      data-comments-form="guest"
      data-comments-guest-email-required={String(guestEmailRequired)}
      className="comments-form mt-4 grid gap-3"
      noValidate
    >
      <label className="grid gap-1 text-sm">
        <span>Name</span>
        <input
          type="text"
          name="guestName"
          required
          maxLength={100}
          className="border-input bg-background rounded border px-2 py-1"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>Email</span>
        <input
          type="email"
          name="guestEmail"
          required={guestEmailRequired}
          className="border-input bg-background rounded border px-2 py-1"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>Comment</span>
        <textarea
          name="content"
          required
          maxLength={10_000}
          placeholder={placeholder}
          className="border-input bg-background min-h-[100px] rounded border px-2 py-1"
        />
      </label>
      {honeypotEnabled && <GuestCommentHoneypot />}
      <button
        type="submit"
        className="bg-primary text-primary-foreground rounded px-3 py-1"
      >
        Submit comment
      </button>
    </form>
  )
}

/**
 * SSR comments-section renderer.
 *
 * Emits an accessible section keyed by `data-component="comments"` with the
 * configured empty-state copy. When the bound table has `comments.guestComments:
 * true`, a guest comment form skeleton is rendered inline so the form-visibility
 * specs pass on first paint. When `tableName` + `recordId` are both resolvable
 * the section also emits `data-island="comments"` so the comment-thread
 * island hydrates on top of the SSR fallback.
 */
/**
 * Render the SSR comments `<section>` from the resolved fields + config.
 * Extracted from `commentsComponent` to keep that renderer under the
 * function-size limit.
 */
function renderCommentsSection(input: {
  readonly f: ReturnType<typeof resolveCommentsFields>
  readonly cfg: ReturnType<typeof resolveTableCommentsConfig>
  readonly elementProps: Record<string, unknown>
  readonly islandProps: string | undefined
  readonly sessionName: string | undefined
  readonly sessionEmail: string | undefined
}): ReactElement {
  const { f, cfg, elementProps, islandProps, sessionName, sessionEmail } = input
  const showGuestForm = cfg.guestComments && cfg.commentPermissionAllowsAll
  const testId =
    typeof elementProps['data-testid'] === 'string' ? elementProps['data-testid'] : undefined
  return (
    <section
      id={f.id}
      data-component="comments"
      data-component-type="comments"
      data-comments-limit={String(f.limit)}
      data-comments-sort={f.sort}
      data-comments-pagination-style={f.paginationStyle}
      data-comments-table={f.table}
      data-comments-record-id={f.recordId}
      data-comments-guest={String(cfg.guestComments)}
      data-comments-threading={String(cfg.threading)}
      data-comments-session-name={sessionName}
      data-comments-session-email={sessionEmail}
      data-island={islandProps ? 'comments' : undefined}
      data-island-props={islandProps}
      data-testid={testId}
      aria-label="Comments"
      className="comments my-6"
    >
      <p
        data-comments-empty-state=""
        className="text-muted-foreground text-sm"
      >
        {f.emptyText}
      </p>
      {showGuestForm && (
        <>
          <GuestCommentFormSkeleton
            placeholder={f.placeholder}
            guestEmailRequired={cfg.guestEmailRequired}
            honeypotEnabled={showGuestForm}
          />
          <script
            // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time SSR runtime emission
            dangerouslySetInnerHTML={{ __html: GUEST_COMMENT_FORM_RUNTIME }}
          />
        </>
      )}
    </section>
  )
}

export const commentsComponent: ComponentRenderer = ({
  component,
  rawProps,
  elementProps,
  tables,
  session,
}) => {
  const f = resolveCommentsFields(component, rawProps, elementProps)
  const cfg = resolveTableCommentsConfig(f.table, tables)
  const islandProps =
    f.table && f.recordId
      ? JSON.stringify(
          buildCommentThreadIslandProps({
            fields: f,
            elementProps,
            session,
            threading: cfg.threading,
          })
        )
      : undefined
  // PG-02 [internal ref]: when the SSR resolver carries an
  // authenticated session, surface the name + email through data-* attrs
  // so the inline guest-form runtime can prefill the visible inputs. The
  // attrs themselves never render user data into the document body — the
  // runtime reads them once and writes the values into the form inputs.
  return renderCommentsSection({
    f,
    cfg,
    elementProps,
    islandProps,
    sessionName: session?.name,
    sessionEmail: session?.email,
  })
}

/**
 * SSR comment-count renderer.
 *
 * Emits a small inline counter keyed by `data-component="comment-count"`.
 * The label is computed from `format` (with `{count}` substituted) when a
 * non-default format is provided, falling back to `emptyText` when both
 * format and count are at their zero defaults. When `tableName` + `recordId`
 * are both resolvable the span also carries `data-island="comment-count"`
 * so the hydration island swaps the SSR placeholder for the live count.
 */
export const commentCountComponent: ComponentRenderer = ({ component, rawProps, elementProps }) => {
  const f = resolveCommentCountFields(component, rawProps, elementProps)
  const label = resolveCountLabel(0, f.format, f.emptyText, f.emptyTextWasCustomized)
  const islandProps = buildCommentCountIslandProps({ fields: f, elementProps })
  const span: ReactElement = (
    <span
      id={f.id}
      data-component="comment-count"
      data-component-type="comment-count"
      data-comment-count-format={f.format}
      data-comment-count-table={f.table}
      data-comment-count-record-id={f.recordId}
      data-island={islandProps ? 'comment-count' : undefined}
      data-island-props={islandProps}
      data-testid={
        typeof elementProps['data-testid'] === 'string' ? elementProps['data-testid'] : undefined
      }
      aria-label="Comment count"
      className="comment-count text-muted-foreground text-sm"
    >
      {label}
    </span>
  )
  return span
}
