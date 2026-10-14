/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  computeAiChatComposerButtonClasses,
  computeAiChatComposerClasses,
  computeAiChatTextareaClasses,
} from '@/presentation/design/ai-chat-composition-classes'
import {
  computeInputGroupAddonClasses,
  computeInputGroupClasses,
} from '@/presentation/design/input-group-default-classes'
import { ChatVoiceButton } from './chat-voice-button'
import { AttachControl, PickedFiles } from './composer-attachments'
import { SuggestionStrip } from './suggestion-strip'
import { usePickedFiles } from './use-attachment-upload'
import type { ChatAttachment, ChatLabels, ChatVoiceInput } from './types'
import type { ReactElement, RefObject } from 'react'

const SEND_BUTTON = `${computeAiChatComposerButtonClasses('default')} ms-auto`

/**
 * Message composer for the `ai-chat` island, on shadcn's `input-group`
 * anatomy: a `textarea` control, the picked files as `attachment` chips in a
 * `block-start` addon, and the attach, voice and send controls in a
 * `block-end` addon.
 *
 * Owns the draft and the picked files, submits on Enter (Shift+Enter is a new
 * line) or Send, disables Send when the draft is empty or while the AI is
 * responding — plus, under it, the
 * prompt-suggestion chips.
 */

interface ChatInputRowProps {
  readonly placeholder: string
  readonly isSending: boolean
  readonly allowAttachments: boolean
  /** The chat id picked files are uploaded under; absent keeps them in the browser. */
  readonly uploadChatId: string | undefined
  /** Draft text captured from the SSR skeleton before hydration. */
  readonly initialDraft: string
  /** Starter prompts drawn as chips under this row; absent when none apply. */
  readonly suggestions: ReadonlyArray<string> | undefined
  /** Push-to-talk settings; absent means no microphone button. */
  readonly voiceInput: ChatVoiceInput | undefined
  /** The panel's words: the composer's, a picked file's chip, the suggestions' strip. */
  readonly labels: ChatLabels
  readonly onSend: (text: string, attachments: readonly ChatAttachment[]) => void
  /** Present while a reply streams: Stop takes Send's place. */
  readonly stop: StopControl | undefined
}

/** The control that stops a streaming reply, in the page language. */
interface StopControl {
  readonly label: string
  readonly onStop: () => void
}

/** Enter sends; Shift+Enter, or Enter while an IME is composing, is a new line. */
const submitOnEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
  e.preventDefault()
  e.currentTarget.form?.requestSubmit()
}

/**
 * Give the box the focus back when a reply settles, if the focus fell to the
 * page meanwhile — the box is disabled while a reply arrives, and Stop or a
 * decision on a held call goes away once used. A focus the reader put
 * elsewhere is left where it is.
 */
function useRefocus(isSending: boolean, fieldRef: RefObject<HTMLTextAreaElement | null>): void {
  const wasSending = useRef(isSending)
  useEffect(() => {
    if (wasSending.current && !isSending && document.activeElement === document.body)
      fieldRef.current?.focus()
    wasSending.current = isSending
  }, [isSending, fieldRef])
}

/** What the composer's state hook is handed by the row. */
interface ComposerStateInput {
  readonly isSending: boolean
  readonly initialDraft: string
  readonly onSend: (t: string, a: readonly ChatAttachment[]) => void
  readonly voiceMode: 'draft' | 'send'
  readonly uploadChatId: string | undefined
}

/**
 * Draft state, picked files, the composer's handlers, and the field node.
 *
 * Selecting a suggestion fills the draft AND hands the reader the caret, which
 * is what makes editing the obvious next move rather than a second click away.
 */
function useComposerState({
  isSending,
  initialDraft,
  onSend,
  voiceMode,
  uploadChatId,
}: ComposerStateInput) {
  const [draft, setDraft] = useState(initialDraft)
  const picked = usePickedFiles(uploadChatId)
  const { sendable, clear, isUploading } = picked
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  useRefocus(isSending, fieldRef)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value),
    []
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (draft.trim().length === 0 || isSending || isUploading) return
      onSend(draft, sendable)
      setDraft('')
      clear()
    },
    [draft, sendable, isSending, isUploading, onSend, clear]
  )

  /** Fills the composer and focuses it. It deliberately does NOT send. */
  const handleSelectSuggestion = useCallback((prompt: string) => {
    setDraft(prompt)
    fieldRef.current?.focus()
  }, [])

  /** A dictated transcript: sent at once in `send` mode, otherwise put in the box. */
  const handleTranscript = useCallback(
    (text: string) => {
      if (voiceMode === 'send') {
        onSend(text, [])
        setDraft('')
        return
      }
      setDraft(text)
      fieldRef.current?.focus()
    },
    [voiceMode, onSend]
  )

  return {
    ...picked,
    draft,
    fieldRef,
    handleChange,
    handleSubmit,
    handleSelectSuggestion,
    handleTranscript,
  }
}

/** The `block-end` addon: attach, voice, and send — or stop, while a reply streams. */
function ComposerControls({
  isSending,
  allowAttachments,
  state,
  voiceInput,
  stop,
  labels,
}: Omit<ComposerFormProps, 'placeholder'>): ReactElement {
  const canSend = state.draft.trim().length > 0 && !isSending && !state.isUploading
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align="block-end"
      className={computeInputGroupAddonClasses({ align: 'block-end' })}
    >
      {allowAttachments && (
        <AttachControl
          labels={labels.composer}
          onPick={state.handlePick}
        />
      )}
      {voiceInput !== undefined && (
        <ChatVoiceButton
          labels={labels.composer}
          voiceInput={voiceInput}
          disabled={isSending}
          onTranscript={state.handleTranscript}
        />
      )}
      {stop === undefined ? (
        <button
          // Keyed apart, so Stop is a control that goes away rather than one
          // that turns into a disabled Send under the reader's focus.
          key="send"
          type="submit"
          data-slot="input-group-button"
          data-ai-chat-send
          data-testid="chat-send"
          disabled={!canSend}
          className={SEND_BUTTON}
        >
          {labels.composer.send}
        </button>
      ) : (
        <button
          key="stop"
          type="button"
          data-slot="input-group-button"
          data-testid="chat-stop"
          onClick={stop.onStop}
          className={SEND_BUTTON}
        >
          {stop.label}
        </button>
      )}
    </div>
  )
}

interface ComposerFormProps {
  readonly placeholder: string
  readonly isSending: boolean
  readonly allowAttachments: boolean
  readonly state: ReturnType<typeof useComposerState>
  readonly voiceInput: ChatVoiceInput | undefined
  readonly labels: ChatLabels
  readonly stop: StopControl | undefined
}

/** The composer proper: label, input group, picked files, controls. */
function ComposerForm({
  placeholder,
  isSending,
  allowAttachments,
  state,
  voiceInput,
  labels,
  stop,
}: ComposerFormProps): ReactElement {
  return (
    <form
      data-ai-chat-form
      onSubmit={state.handleSubmit}
      className={computeAiChatComposerClasses()}
    >
      <label
        htmlFor="ai-chat-input"
        className="sr-only"
      >
        {labels.composer.message}
      </label>
      <div
        data-slot="input-group"
        role="group"
        className={computeInputGroupClasses()}
      >
        <PickedFiles
          files={state.files}
          labels={labels}
          onRemove={state.handleRemove}
        />
        <textarea
          id="ai-chat-input"
          ref={state.fieldRef}
          rows={1}
          data-slot="input-group-control"
          data-ai-chat-input
          data-testid="chat-input"
          name="message"
          value={state.draft}
          onChange={state.handleChange}
          onKeyDown={submitOnEnter}
          disabled={isSending}
          placeholder={placeholder}
          className={computeAiChatTextareaClasses()}
        />
        <ComposerControls
          isSending={isSending}
          allowAttachments={allowAttachments}
          state={state}
          voiceInput={voiceInput}
          stop={stop}
          labels={labels}
        />
      </div>
    </form>
  )
}

export function ChatInputRow({
  placeholder,
  isSending,
  allowAttachments,
  uploadChatId,
  initialDraft,
  suggestions,
  voiceInput,
  labels,
  onSend,
  stop,
}: ChatInputRowProps): ReactElement {
  const voiceMode = voiceInput?.mode ?? 'draft'
  const state = useComposerState({
    isSending,
    initialDraft,
    onSend,
    voiceMode,
    uploadChatId,
  })

  // A FRAGMENT, not a wrapper: the chip strip must be a SIBLING of the form
  // rather than a descendant of it, because a `button` inside a form is a
  // submit control — and a chip fills, it does not send.
  return (
    <>
      <ComposerForm
        placeholder={placeholder}
        isSending={isSending}
        allowAttachments={allowAttachments}
        state={state}
        voiceInput={voiceInput}
        labels={labels}
        stop={stop}
      />
      <SuggestionStrip
        label={labels.suggestions}
        suggestions={suggestions}
        onSelect={state.handleSelectSuggestion}
      />
    </>
  )
}
