/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

const HONEYPOT_STYLE = {
  position: 'absolute' as const,
  left: '-9999px',
  height: 0,
  width: 0,
}

function GuestCommentHoneypot(): ReactElement {
  return (
    <input
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
  return renderCommentsSection({
    f,
    cfg,
    elementProps,
    islandProps,
    sessionName: session?.name,
    sessionEmail: session?.email,
  })
}

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
