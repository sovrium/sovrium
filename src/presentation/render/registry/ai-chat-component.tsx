/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SSR renderer for the `ai-chat` page component.
 *
 * Emits the `data-island="ai-chat"` placeholder consumed by the island client
 * (`island-client.tsx`), which discovers the marker, parses `data-island-props`,
 * and mounts the interactive {@link "../../../../islands/ai-chat-island"} into
 * it. The placeholder body is an accessible, static chat skeleton (a
 * `role="log"` message area plus a labelled message-input row) preserved by the
 * island client as the Suspense fallback while the island bundle loads.
 *
 * The placeholder `<div>` itself carries the canonical `data-component="ai-chat"`
 * marker and the author-declared `data-*` attributes:
 *  - `data-agent`: the declared `app.agents[]` entry to chat with
 *.
 *  - `data-allowed-tables`: a JSON array narrowing the chat's table scope.
 * Because the island client mounts INTO this `<div>` (it does not replace it),
 * those attributes — and the `data-component` marker — survive hydration, so
 * spec attribute/visibility assertions resolve before AND after the island
 * mounts.
 *
 * Height: the author's `chatHeight` is applied HERE and nowhere else, as an
 * inline style on the placeholder, which `computeAiChatContainerClasses` turns
 * into a hard clip with `overflow-hidden`. The skeleton below — and the island
 * that replaces it — is a flex column inside that clip whose message log takes
 * the slack and scrolls, so the input row and the suggestion strip keep their
 * place in flow. A second sizer anywhere under this box puts the composer
 * outside the panel.
 *
 * Degraded mode: when no AI provider is resolvable — `AI_PROVIDER` empty
 * (configured-but-disabled) OR unset entirely (an inert agent, [internal ref]) — the
 * skeleton renders a "not configured / unavailable" notice instead of the input
 * row, and the island is not requested; there is no working backend to chat with
 *.
 */

import { isAiProviderConfigured } from '@/domain/models/process-env/ai/ai-providers'
import {
  computeAiChatContainerClasses,
  computeAiChatErrorClasses,
  computeAiChatInputClasses,
  computeAiChatInputRowClasses,
  computeAiChatMessageListClasses,
  computeAiChatSuggestionStripClasses,
} from '@/presentation/design/ai-chat-default-classes'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { resolveChildTranslation } from '../i18n/translation-handler'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement } from 'react'

/** Stable height fallback for the chat container when `chatHeight` is unset. */
const DEFAULT_CHAT_HEIGHT_PX = 400

/**
 * The skeleton's two controls, drawn from the SAME recipes the island uses.
 *
 * This file used to carry a hand-written transcription of the island's chat
 * recipe — eight class literals kept in sync by hand, and not — so the panel
 * repainted the instant the island mounted. `presentation/utils/recipes` is the
 * one directory both sides may import; see `ai-chat-default-classes.ts`.
 */
const SEND_BUTTON = computeButtonDefaultClasses({ size: 'sm' })
const ATTACH_BUTTON = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })

/**
 * A prompt chip is the small outlined button — the one variant whose fill is
 * the surface behind it, so three of them under the composer read as offers
 * rather than as three competing send buttons.
 */
const SUGGESTION_CHIP = computeButtonDefaultClasses({ variant: 'outline', size: 'sm' })

/**
 * The strip's own accessible name. Without it a screen-reader user meets a run
 * of unexplained buttons after the composer and has to read all three to learn
 * what they are for.
 */
const SUGGESTIONS_GROUP_LABEL = 'Suggested questions'

/**
 * AI chat is "disabled" whenever no AI provider is resolvable — the
 * configured-but-empty `AI_PROVIDER` case AND the entirely-unset case ([internal ref]:
 * an `ai-chat` panel bound to an inert agent). In both states there is no
 * working chat backend, so the panel shows the degraded notice with no live
 * send control rather than a chat box that silently fails on send.
 */
const isAiDisabled = (): boolean => !isAiProviderConfigured(process.env)

/**
 * The three statuses an `ai-chat` specimen may be DEPICTED in.
 *
 * The same three the island itself passes through — a chat at rest, a reply
 * arriving, a turn that failed — read back off the island's own `status`
 * vocabulary rather than invented here, so a drawing of `error` is a drawing of
 * the banner a reader would actually meet.
 */
type AiChatSpecimenStatus = 'idle' | 'streaming' | 'error'

const SPECIMEN_STATUSES: ReadonlySet<string> = new Set<AiChatSpecimenStatus>([
  'idle',
  'streaming',
  'error',
])

/**
 * Is this drawing a SPECIMEN — the real markup with nothing behind it?
 *
 * ─── WHY A MODE EXISTS AT ALL ──────────────────────────────────────────────
 *
 * This panel is a write surface: it hydrates a composer whose submit posts a
 * prompt to the instance's AI provider. [internal ref] A3 permits a specimen form
 * element *"while it carries no action and no submit path"* — so what a preview
 * frame may not have is the TRANSPORT, not the picture. Drawing a look-alike
 * out of an `input` and a `button` would document the composition instead of
 * the component (the failure `[internal ref]` exists to catch), so the
 * renderer draws its own skeleton and withholds the two things that make it
 * live: the island marker, and `type="submit"` on the send control.
 *
 * Reached through `props` for the same reason `props.adminSearch` is on the
 * command palette: it is set by the surface that draws the specimen, never by
 * an app author describing a panel they want to work.
 */
const specimenStatusOf = (
  rawProps: Record<string, unknown> | undefined
): AiChatSpecimenStatus | undefined => {
  if (rawProps?.['specimen'] !== true) return undefined
  const declared = rawProps['specimenStatus']
  return typeof declared === 'string' && SPECIMEN_STATUSES.has(declared)
    ? (declared as AiChatSpecimenStatus)
    : 'idle'
}

/** Author-declared `ai-chat` props resolved from the component schema. */
interface AiChatProps {
  readonly agent: string | undefined
  readonly placeholder: string
  readonly chatHeight: number
  readonly allowAttachments: boolean
  readonly allowedTables: ReadonlyArray<string> | undefined
  /** Prompt chips drawn under the composer, or `undefined` when none apply. */
  readonly suggestions: ReadonlyArray<string> | undefined
  readonly testId: string
  /** JSON `data-island-props` payload for the client island. */
  readonly islandPropsJson: string
}

/**
 * Normalise the author's `suggestions` into the list the strip draws.
 *
 * Declared order is preserved exactly — nothing here sorts, dedupes or
 * truncates, because the author's order is the reading order. What it does drop
 * is a non-string entry and a blank one, and an all-blank list collapses to
 * `undefined` rather than to `[]`: forwarding an empty array would push "is
 * there anything to draw" into the island, where it is re-decided on every
 * render, instead of settling it once in the renderer that already knows.
 *
 * `$t:` IS RESOLVED HERE, and that is not a duplicate of the pipeline's own
 * substitution. `substitutePropsTranslationTokens` does walk arrays of strings,
 * but it runs inside `buildComponentProps` and its output reaches `elementProps`
 * ONLY — this renderer reads `rawProps`, which is `mergedPropsWithVisibility`,
 * i.e. `component.props` straight off the config with no substitution applied.
 * Measured: without this call a `$t:` chip renders the raw token verbatim.
 * Resolution happens on the way into the strip so the island receives the
 * resolved strings too, and a chip's visible text stays the text it inserts.
 */
const resolveSuggestions = (
  declared: unknown,
  currentLang: string | undefined,
  languages: Languages | undefined
): ReadonlyArray<string> | undefined => {
  if (!Array.isArray(declared)) return undefined
  const prompts = declared
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => resolveChildTranslation(entry, currentLang, languages))
    .filter((prompt) => prompt.trim().length > 0)
  return prompts.length > 0 ? prompts : undefined
}

/** Read the author-declared `ai-chat` props off the raw component props. */
const resolveAiChatProps = (
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  currentLang: string | undefined,
  languages: Languages | undefined
): AiChatProps => {
  const props = rawProps ?? {}
  const agent = props.agent as string | undefined
  const placeholder = (props.placeholder as string | undefined) ?? 'Ask a question…'
  const chatHeight = (props.chatHeight as number | undefined) ?? DEFAULT_CHAT_HEIGHT_PX
  const showHistory = props.showHistory as boolean | undefined
  const allowAttachments = props.allowAttachments === true
  const allowedTables = props.allowedTables as ReadonlyArray<string> | undefined
  const suggestions = resolveSuggestions(props.suggestions, currentLang, languages)
  const testId = (elementProps['data-testid'] as string | undefined) ?? 'ai-chat'
  return {
    agent,
    placeholder,
    chatHeight,
    allowAttachments,
    allowedTables,
    suggestions,
    testId,
    islandPropsJson: JSON.stringify({
      ...(agent !== undefined && { agent }),
      placeholder,
      chatHeight,
      ...(showHistory !== undefined && { showHistory }),
      ...(props.allowAttachments !== undefined && { allowAttachments }),
      ...(allowedTables !== undefined && { allowedTables }),
      ...(suggestions !== undefined && { suggestions }),
      'data-testid': testId,
    }),
  }
}

/** Degraded-mode body shown when AI is configured-but-disabled. */
const renderDisabledBody = (): ReactElement => (
  <div
    role="status"
    className="text-foreground-muted flex flex-1 items-center justify-center p-6 text-sm"
  >
    AI chat is not configured and is currently unavailable.
  </div>
)

/**
 * The failed-turn banner, drawn from the island's own recipe.
 *
 * Only a specimen reaches this server-side: a live panel has no failure to
 * report until it has sent something, and the island owns the banner from that
 * point on. `error` is on this type's published states strip precisely because
 * it is the one appearance a reader cannot produce on demand.
 */
const renderSpecimenErrorBanner = (): ReactElement => (
  <div
    data-testid="chat-error"
    role="alert"
    className={`${computeAiChatErrorClasses()} flex items-center gap-2`}
  >
    <span>The assistant is unavailable. Please try again.</span>
  </div>
)

/**
 * The prompt chips, drawn UNDER the composer and OUTSIDE it.
 *
 * Under rather than over so the composer sits in the same place whether or not
 * a chat declares suggestions. Outside the `<form>` rather than inside it
 * because a `button` inside a form is a submit control, and a chip must fill
 * the input and stop there — a chip that sent would fire a model call from a
 * misclick, on a prompt the reader never confirmed.
 *
 * The skeleton draws it so the chips are present before hydration and the panel
 * does not shift when the island mounts; the island draws it again because a
 * chip needs a click handler, and both read the same recipe so neither repaints
 * the other.
 */
const renderSuggestionStrip = (suggestions: ReadonlyArray<string>): ReactElement => (
  <div
    data-ai-chat-suggestions
    role="group"
    aria-label={SUGGESTIONS_GROUP_LABEL}
    className={computeAiChatSuggestionStripClasses()}
  >
    {suggestions.map((prompt, index) => (
      <button
        // The prompt alone is not a key: two identical prompts are a config
        // mistake, not a crash, and the index keeps them distinct.
        key={`${index}:${prompt}`}
        type="button"
        data-testid="chat-suggestion"
        className={SUGGESTION_CHIP}
      >
        {prompt}
      </button>
    ))}
  </div>
)

/** Static chat skeleton — the island client upgrades this on hydration. */
const renderSkeletonBody = (
  { placeholder, allowAttachments, suggestions }: AiChatProps,
  specimen: AiChatSpecimenStatus | undefined
): ReactElement => (
  <>
    {/* Scrollable message log — empty until the island replays history */}
    <div
      data-ai-chat-messages
      data-testid="chat-messages"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      className={`chat-messages ${computeAiChatMessageListClasses()}`}
    />

    {specimen === 'error' && renderSpecimenErrorBanner()}

    {/* Message input row — the island upgrades this to a live form */}
    <form
      data-ai-chat-form
      className={computeAiChatInputRowClasses()}
    >
      <label
        htmlFor="ai-chat-input"
        className="sr-only"
      >
        Message
      </label>
      {allowAttachments && (
        <button
          type="button"
          data-testid="chat-attach"
          aria-label="Attach file"
          className={ATTACH_BUTTON}
        >
          Attach
        </button>
      )}
      <input
        id="ai-chat-input"
        data-ai-chat-input
        data-testid="chat-input"
        type="text"
        name="message"
        placeholder={placeholder}
        className={computeAiChatInputClasses()}
      />
      {/*
        `type="button"` on a specimen, and it is the whole of what makes the
        drawing inert. The row already carries no `action` and no `method`, so a
        submit control is the only remaining way this markup could put something
        on the wire — and [internal ref] A3 clause 1 permits a specimen form element
        only while it has none. A live panel keeps its submit; the island is
        what gives that submit somewhere to go.
      */}
      <button
        type={specimen === undefined ? 'submit' : 'button'}
        data-ai-chat-send
        data-testid="chat-send"
        disabled
        className={SEND_BUTTON}
      >
        Send
      </button>
    </form>

    {suggestions !== undefined && renderSuggestionStrip(suggestions)}
  </>
)

export const aiChatComponent: ComponentRenderer = ({
  elementProps,
  rawProps,
  currentLang,
  languages,
}) => {
  const resolved = resolveAiChatProps(rawProps, elementProps, currentLang, languages)
  const { agent, chatHeight, allowedTables, testId, islandPropsJson } = resolved
  const specimen = specimenStatusOf(rawProps)
  // A specimen draws the panel whether or not THIS deployment has an AI
  // provider: the console documents the component, not the environment it was
  // booted in, and a catalogue that went blank on a machine with no provider
  // would be documenting the machine.
  const disabled = specimen === undefined && isAiDisabled()
  const live = specimen === undefined && !disabled

  return (
    <div
      data-island={live ? 'ai-chat' : undefined}
      data-island-props={live ? islandPropsJson : undefined}
      data-component="ai-chat"
      data-component-type="ai-chat"
      data-testid={testId}
      data-agent={agent}
      data-allowed-tables={allowedTables !== undefined ? JSON.stringify(allowedTables) : undefined}
      className={`ai-chat-container ${computeAiChatContainerClasses()}`}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-call height merge in a stateless SSR renderer; memoization happens in the outer ComponentRenderer
      style={{ height: `${chatHeight}px` }}
    >
      {disabled ? renderDisabledBody() : renderSkeletonBody(resolved, specimen)}
    </div>
  )
}
