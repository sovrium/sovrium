/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense, useRef, useState } from 'react'
import {
  computeReplySheetClasses,
  computeReplySheetHeaderClasses,
  computeReplySummaryAvatarClasses,
  computeReplySummaryAvatarsClasses,
  computeReplySummaryClasses,
  computeReplySummaryTimeClasses,
} from '@/presentation/design/reply-summary-classes'
import { computeSheetTitleClasses } from '@/presentation/design/sheet-default-classes'
import type { CommentThreadIslandProps } from './comment-thread-types'
import type { ReactElement } from 'react'

/** The thread, fetched only once a sheet is opened. */
const CommentThread = lazy(() => import('./comment-thread-island'))

interface ReplySheetIslandProps {
  readonly label: string
  readonly repliers: readonly { readonly name: string; readonly initials: string }[]
  readonly lastAt: string
  readonly lastAtText: string
  readonly title: string
  readonly closeLabel: string
  readonly thread: CommentThreadIslandProps
}

/** The summary button: the last repliers' initials, the count, the last reply's time. */
function SummaryContent({
  label,
  repliers,
  lastAt,
  lastAtText,
}: Pick<ReplySheetIslandProps, 'label' | 'repliers' | 'lastAt' | 'lastAtText'>): ReactElement {
  return (
    <>
      <span className={computeReplySummaryAvatarsClasses()}>
        {repliers.map((replier) => (
          <span
            key={replier.name}
            title={replier.name}
            className={computeReplySummaryAvatarClasses()}
          >
            {replier.initials}
          </span>
        ))}
      </span>
      <span>{label}</span>
      <time
        dateTime={lastAt}
        className={computeReplySummaryTimeClasses()}
      >
        {lastAtText}
      </time>
    </>
  )
}

/**
 * The reply summary under a conversation turn, made live: pressing it opens
 * the record's comment thread in a sheet beside the conversation — the
 * platform's modal `<dialog>`, so focus, Escape and the dimmer are the
 * browser's — without leaving the page. The thread is the one a `comments`
 * component draws, read and written through the comments API, and is loaded
 * only once a sheet is opened, so a conversation of many turns reads none.
 */
export default function ReplySheetIsland(props: ReplySheetIslandProps): ReactElement {
  const sheet = useRef<HTMLDialogElement>(null)
  const [opened, setOpened] = useState(false)
  const open = (): void => {
    setOpened(true)
    sheet.current?.showModal()
  }
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className={computeReplySummaryClasses()}
        onClick={open}
      >
        <SummaryContent {...props} />
      </button>
      <dialog
        ref={sheet}
        aria-label={props.title}
        className={computeReplySheetClasses()}
        onClick={(event) => {
          if (event.target === sheet.current) sheet.current.close()
        }}
      >
        <div className={computeReplySheetHeaderClasses()}>
          <h2 className={computeSheetTitleClasses()}>{props.title}</h2>
          <button
            type="button"
            aria-label={props.closeLabel}
            className="text-muted-foreground hover:bg-muted rounded-md px-2 text-lg leading-none"
            onClick={() => sheet.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="px-4 pb-4">
          {opened && (
            <Suspense fallback={null}>
              <CommentThread {...props.thread} />
            </Suspense>
          )}
        </div>
      </dialog>
    </>
  )
}
