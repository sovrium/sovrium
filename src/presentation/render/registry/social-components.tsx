/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SSR renderers for the `comments` page-component, in both of its displays.
 *
 * Both renderers emit accessible HTML keyed by `data-component=...`. When
 * the bound `tableName` + `recordId` resolve at SSR time the renderers
 * also emit a `data-island=...` marker so the hydration islands take over
 * once mounted:
 *
 * - `comments` → `comment-thread-island.tsx` (paged list, auth form,
 *   edit / delete, sort dropdown, load-more / numbered pagination)
 * - `display: 'count'` → `comment-count-island.tsx` (fetches count from the
 *   existing comments-API pagination metadata)
 *
 * The interactive surface (form, edit/delete) is gated by the island; the
 * SSR placeholder always carries the empty-state copy so spec assertions
 * on `[data-component=...]` pass on first paint without JS.
 *
 * Specs: [internal ref] … 035 +
 * [internal ref] … 045
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeCommentComposerFieldClasses,
  computeCommentEmptyClasses,
  computeCommentFormClasses,
  computeCommentThreadClasses,
} from '@/presentation/design/comments-default-classes'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { GUEST_COMMENT_FORM_RUNTIME } from './guest-comment-runtime'
import {
  buildCommentCountIslandProps,
  buildCommentThreadIslandProps,
  pickString,
  resolveCommentCountFields,
  resolveCommentsFields,
  resolveCountLabel,
  resolveTableCommentsConfig,
} from './social-components-helpers'
import type { ComponentRenderer } from './component-dispatch-config'
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
 * A field row in the guest comment form: label ABOVE its control, the shape
 * every other form in the system uses.
 *
 * The three fields here had a hand-rolled chrome of their own — a `rounded`
 * border on `bg-background` at `px-2 py-1` — which is not the field the rest of
 * the product draws: it was 8px shorter, one radius step off, and bordered in
 * `border-input`, a name the token layer registers but no other control spends.
 * They call the field recipe now, so a tenant's own `design.colors` reaches the
 * one form that renders on a PUBLIC page exactly as it reaches every form
 * behind a login.
 *
 * The comment textarea is the one exception, and deliberately: it is the SAME
 * control the hydrated island draws, so it takes
 * `computeCommentComposerFieldClasses()` rather than the generic field recipe.
 * It used to carry `computeInputDefaultClasses() + min-h-[100px]` here while
 * the island drew `min-h-[80px]` from an unrelated literal — a 20px jump the
 * moment the page finished loading, from two strings nothing compared.
 */
const COMMENT_FIELD_ROW = 'grid gap-1'

const COMMENT_FIELD_LABEL = 'text-sm font-medium'

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
      className={`comments-form ${computeCommentFormClasses()}`}
      noValidate
    >
      <label className={COMMENT_FIELD_ROW}>
        <span className={COMMENT_FIELD_LABEL}>Name</span>
        <input
          type="text"
          name="guestName"
          required
          maxLength={100}
          className={computeInputDefaultClasses()}
        />
      </label>
      <label className={COMMENT_FIELD_ROW}>
        <span className={COMMENT_FIELD_LABEL}>Email</span>
        <input
          type="email"
          name="guestEmail"
          required={guestEmailRequired}
          className={computeInputDefaultClasses()}
        />
      </label>
      <label className={COMMENT_FIELD_ROW}>
        <span className={COMMENT_FIELD_LABEL}>Comment</span>
        <textarea
          name="content"
          required
          maxLength={10_000}
          placeholder={placeholder}
          className={computeCommentComposerFieldClasses()}
        />
      </label>
      {honeypotEnabled && <GuestCommentHoneypot />}
      <button
        type="submit"
        className={`${computeButtonDefaultClasses()} justify-self-start`}
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
      // Settled, and truthfully so: nothing is in flight before the island
      // hydrates. The island keeps it in step afterwards, because a thread
      // that fetches its next page on scroll has no button left to announce
      // the wait. Emitted here rather than left absent so an assistive
      // technology reads a settled region from first paint rather than an
      // unknown one.
      aria-busy="false"
      className={`comments ${computeCommentThreadClasses()}`}
    >
      <p
        data-comments-empty-state=""
        className={computeCommentEmptyClasses()}
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

/**
 * SSR renderer for `comments`, in both of its displays.
 *
 * `display: 'count'` draws the inline total that used to be its own
 * `commentCount` component type; anything else draws the full thread. The
 * dispatch is here rather than in `COMPONENT_REGISTRY` because the registry is
 * keyed by `type` and the two surfaces are now ONE type — which is the point of
 * the merge, and the reason the count branch keeps its own island, its own
 * `data-component="comment-count"` marker and its own resolver.
 */
export const commentsComponent: ComponentRenderer = (context) => {
  const { component, rawProps, elementProps, tables, session } = context
  const display = pickString(
    (component ?? {}) as Record<string, unknown>,
    (rawProps ?? {}) as Record<string, unknown>,
    'display',
    'thread'
  )
  if (display === 'count') return commentCountComponent(context)
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
      className="comment-count text-foreground-muted text-xs"
    >
      {label}
    </span>
  )
  return span
}
