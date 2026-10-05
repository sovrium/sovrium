/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useContext, useLayoutEffect, useRef, useState } from 'react'
import {
  encodeMentionPicks,
  mentionMarkup,
  type MentionPick,
} from '@/domain/models/app/tables/comment-mention-markup-service'
import { CommentMentionSource } from './comment-mention-source'
import type { ChangeEvent, KeyboardEvent, RefObject, SyntheticEvent } from 'react'

/** A person the picker offers. */
interface MentionCandidate {
  readonly id: string
  readonly name: string
}

/** The `@` being typed: where it sits, and what follows it up to the caret. */
interface MentionQuery {
  readonly anchor: number
  readonly term: string
}

/** The id of option `index` in the listbox `listboxId`, for `aria-activedescendant`. */
export function mentionOptionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`
}

/** Longer than any name worth searching for; past it the `@` is just text. */
const MAX_TERM_LENGTH = 50

/**
 * The mention being typed at `caret`, if any: an `@` at the start of the text
 * or after whitespace, followed by no whitespace up to the caret. A picked name
 * contains a space, so the query closes itself the moment one is inserted.
 */
function findMentionQuery(text: string, caret: number): MentionQuery | undefined {
  const before = text.slice(0, caret)
  const anchor = before.lastIndexOf('@')
  if (anchor === -1) return undefined
  if (anchor > 0 && !/\s/.test(before.charAt(anchor - 1))) return undefined
  const term = before.slice(anchor + 1)
  if (/\s/.test(term) || term.startsWith('[') || term.length > MAX_TERM_LENGTH) return undefined
  return { anchor, term }
}

async function fetchMentionable(
  source: { readonly tableName: string; readonly recordId: string },
  term: string,
  signal: AbortSignal
): Promise<readonly MentionCandidate[]> {
  const params = new URLSearchParams(term === '' ? {} : { q: term })
  const response = await fetch(
    `/api/tables/${source.tableName}/records/${source.recordId}/comments/mentionable?${params.toString()}`,
    { credentials: 'include', signal }
  )
  if (!response.ok) {
    // eslint-disable-next-line functional/no-throw-statements -- TanStack Query reports a thrown fetch as the failed state the picker shows
    throw new Error(`mentionable ${response.status}`)
  }
  const body = (await response.json()) as { readonly users?: readonly MentionCandidate[] }
  return (body.users ?? []).map((user) => ({ id: String(user.id), name: user.name }))
}

/**
 * The four keys an open picker answers, while focus stays in the textarea:
 * Escape closes it and keeps the text; the arrows move the active person; Enter
 * or Tab picks them — and neither submits nor leaves the field while it is open.
 */
function handlePickerKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  picker: {
    readonly count: number
    readonly active: number
    readonly dismiss: () => void
    readonly move: (index: number) => void
    readonly pickActive: () => void
  }
): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    picker.dismiss()
    return
  }
  if (picker.count === 0) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    picker.move((picker.active + step + picker.count) % picker.count)
    return
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    picker.pickActive()
  }
}

/**
 * The candidates whose name contains `term`. Narrowed here as well as on the
 * server, so a list still showing the previous term's answer never offers
 * someone the new term excludes.
 */
function narrowToTerm(
  data: readonly MentionCandidate[] | undefined,
  term: string
): readonly MentionCandidate[] {
  const needle = term.toLowerCase()
  return (data ?? []).filter((candidate) => candidate.name.toLowerCase().includes(needle))
}

function searchStatus(search: {
  readonly isError: boolean
  readonly isFetching: boolean
}): 'ready' | 'loading' | 'failed' {
  if (search.isError) return 'failed'
  return search.isFetching ? 'loading' : 'ready'
}

export interface MentionComposer {
  readonly value: string
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>
  readonly onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  readonly onSelect: (event: SyntheticEvent<HTMLTextAreaElement>) => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  /** Whether the picker is open. */
  readonly open: boolean
  readonly candidates: readonly MentionCandidate[]
  readonly activeIndex: number
  readonly status: 'ready' | 'loading' | 'failed'
  readonly pick: (candidate: MentionCandidate) => void
  /** The text to send: every picked name swapped for its `@[<user id>]`. */
  readonly encode: () => string
  readonly reset: () => void
}

/**
 * The state of one comment textarea that can mention people: its text, the
 * names picked into it, and the `@` picker over the record's readers.
 *
 * Only a PICK becomes a mention. A name typed by hand after the picker was
 * dismissed is left as plain text, because no pick records it.
 */
// eslint-disable-next-line max-lines-per-function -- one textarea's mention state machine: text, caret, picks, dismissal, candidates and the four picker keys
export function useMentionComposer(
  initial: { readonly text: string; readonly picks: readonly MentionPick[] } = {
    text: '',
    picks: [],
  }
): MentionComposer {
  const source = useContext(CommentMentionSource)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [value, setValue] = useState(initial.text)
  const [picks, setPicks] = useState<readonly MentionPick[]>(initial.picks)
  const [caret, setCaret] = useState(initial.text.length)
  const [dismissedAnchor, setDismissedAnchor] = useState<number | undefined>()
  const [activeIndex, setActiveIndex] = useState(0)
  const [pendingCaret, setPendingCaret] = useState<number | undefined>()

  const query = findMentionQuery(value, caret)
  const open = source !== undefined && query !== undefined && query.anchor !== dismissedAnchor
  const term = query?.term ?? ''

  const search = useQuery({
    queryKey: ['comment-mentionable', source?.tableName, source?.recordId, term],
    queryFn: ({ signal }) =>
      source === undefined ? Promise.resolve([]) : fetchMentionable(source, term, signal),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  })
  const candidates = narrowToTerm(search.data, term)
  const active = Math.min(activeIndex, Math.max(candidates.length - 1, 0))
  const status = searchStatus(search)

  // Put the caret back after the name a pick inserted, once React has written it.
  useLayoutEffect(() => {
    if (pendingCaret === undefined) return
    textareaRef.current?.setSelectionRange(pendingCaret, pendingCaret)
    setPendingCaret(undefined)
  }, [pendingCaret])

  // A dismissal holds only while the writer is still typing after THAT `@`.
  // Once the query it closed is gone — a space, a deletion, a cleared box — an
  // `@` typed later at the same offset is a new mention and opens the picker.
  const moveCaret = (next: number, text: string = value): void => {
    setCaret(next)
    setActiveIndex(0)
    if (findMentionQuery(text, next)?.anchor !== dismissedAnchor) setDismissedAnchor(undefined)
  }

  const pick = (candidate: MentionCandidate): void => {
    if (query === undefined) return
    const label = `@${candidate.name}`
    const next = `${value.slice(0, query.anchor)}${label} ${value.slice(caret)}`
    const nextCaret = query.anchor + label.length + 1
    setValue(next)
    setPicks([...picks, { label, markup: mentionMarkup(candidate.id) }])
    moveCaret(nextCaret, next)
    setPendingCaret(nextCaret)
    textareaRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!open || query === undefined) return
    handlePickerKey(event, {
      count: candidates.length,
      active,
      dismiss: () => setDismissedAnchor(query.anchor),
      move: setActiveIndex,
      pickActive: () => {
        const chosen = candidates[active]
        if (chosen !== undefined) pick(chosen)
      },
    })
  }

  return {
    value,
    textareaRef,
    onChange: (event) => {
      setValue(event.target.value)
      moveCaret(event.target.selectionStart, event.target.value)
    },
    onSelect: (event) => {
      const next = event.currentTarget.selectionStart
      if (next !== caret) moveCaret(next)
    },
    onKeyDown,
    open,
    candidates,
    activeIndex: active,
    status,
    pick,
    encode: () => encodeMentionPicks(value, picks),
    reset: () => {
      setValue('')
      setPicks([])
      setDismissedAnchor(undefined)
      moveCaret(0, '')
    },
  }
}
