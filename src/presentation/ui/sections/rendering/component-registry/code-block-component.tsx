/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Standalone `code` COMPONENT renderer — extracted from `text-components.tsx`
 * when the block gained CHROME (a filename header, a terminal marker, a printed
 * `output` block) and a working copy button.
 *
 * ## Where the fields live
 *
 * `codeFrame`, `filename`, `terminalLabel`, `copy`, `copyLabel`, `copiedLabel`
 * and `output` are declared at the component TOP LEVEL (siblings of `props`),
 * because `props` is an open record where a typo validates silently — the source
 * of this codebase's inert-property class. This renderer therefore reads
 * `component.*`, never `elementProps.*`. Top-level fields are also NOT reached by
 * `$t:` substitution (that runs over `props` only), so every translatable one is
 * resolved here through `resolveTranslationPattern` (precedent:
 * `auth-form-renderer.tsx`).
 *
 * ## Frame precedence (schema-documented, asserted by -036 / -039 / -045)
 *
 *   1. an explicit `codeFrame` wins — INCLUDING `'none'`, which suppresses
 *      chrome that would otherwise be inferred;
 *   2. else `filename` present ⇒ `'file'`;
 *   3. else `output` present ⇒ `'terminal'` (only a command has output);
 *   4. else the frame DERIVED from the block's language
 *      (`resolveDefaultCodeFrame`) — every block is framed by default, because
 *      uniform chrome is the point and an unframed block has nowhere to put its
 *      copy button. `codeFrame: 'none'` remains the honest opt-out.
 *
 * ## Copy payload
 *
 * `data-copy-target` sits on the COMMAND `<pre>` only. The `[data-code-copy-scope]`
 * is the `<figure>` itself (it has to be: the copy button now lives in the
 * header, above the code), so the delegated handler resolves the payload by
 * walking `[data-copy-target]` → `[data-code-command]` → `pre:not([data-code-output])`
 * rather than by taking the scope's first `<pre>`. A reader pasting into a shell
 * therefore gets the command verbatim — never the command followed by its own
 * printed output, and never its filename header. The
 * click handler itself is the delegated `copyCodeScript` in `PageBodyScripts.tsx`;
 * delegation (rather than a mount-time loop) is what makes the button work in a
 * tab panel that mounts AFTER hydration.
 *
 * ## Highlighting
 *
 * When the async pre-pass (`code-highlight-resolver.ts`) attached a
 * `codeHighlight`, the `<pre>` is React-owned and carries Shiki's class list with
 * the `<code>` subtree injected — keeping the author's `data-testid` on the
 * `<pre>` itself (the design-system contract screenshots
 * `getByTestId('component-code-element')`). Otherwise the renderer emits today's
 * self-contained `data-code-block` placeholder, which the retained post-render
 * splice still handles.
 */

import { resolveDefaultCodeFrame } from '@/domain/utils/code-frame-defaults'
import { resolveTranslationPattern } from '@/domain/utils/translation-resolver'
import {
  readCodeHighlight,
  type CodeHighlight,
} from '@/presentation/rendering/code-highlight-resolver'
import { CodeCopyButton, CodeCopyStatus } from '@/presentation/utils/design/code-copy-controls'
import {
  computeCodeFrameHeaderClasses,
  computeCodeFrameShellClasses,
  computeCodeOutputClasses,
} from '../../renderers/element-renderers/recipes/code-frame-default-classes'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement, ReactNode } from 'react'

/** Chrome drawn around the block. Mirrors `CodeFrameSchema`. */
type CodeFrame = 'none' | 'file' | 'terminal'

/** Default terminal marker when the author does not name one. */
const DEFAULT_TERMINAL_LABEL = 'terminal'
/** Default copy-button label (also its stable accessible name). */
const DEFAULT_COPY_LABEL = 'Copy'
/** Default post-copy confirmation label. */
const DEFAULT_COPIED_LABEL = 'Copied'

/**
 * Resting place for the copy control on an UNFRAMED block (`codeFrame: 'none'`),
 * which has no header to hold it. Positioned via CLASSES (never an inline
 * `style`): the canonical sanitiser drops `style`, and [internal ref]
 * asserts zero `[style]` attributes anywhere inside a frame.
 */
const BARE_COPY_SLOT_CLASSES = 'absolute top-2 right-2 flex items-center'

/** Read a top-level string field, treating an empty string as absent. */
function topLevelString(
  component: Record<string, unknown>,
  key: string,
  lang: string | undefined,
  languages: Languages | undefined
): string | undefined {
  const raw = component[key]
  if (typeof raw !== 'string' || raw.length === 0) return undefined
  return resolveTranslationPattern(raw, lang ?? languages?.default ?? '', languages)
}

/** The frame drawn plus the header text that goes with it. */
interface ResolvedFrame {
  readonly frame: CodeFrame
  readonly filename: string | undefined
  readonly terminalLabel: string
}

/**
 * Which frame is drawn, first match winning. An explicit `codeFrame` always wins
 * — a snippet may carry a `filename` purely for its accessible name yet render
 * unframed via `codeFrame: 'none'` — and a block that named nothing falls
 * through to the LANGUAGE-derived default, so every block on the page wears the
 * same chrome.
 */
function resolveFrameKind(
  explicit: unknown,
  filename: string | undefined,
  output: string | undefined,
  derived: CodeFrame
): CodeFrame {
  if (explicit === 'none' || explicit === 'file' || explicit === 'terminal') return explicit
  if (filename !== undefined) return 'file'
  if (output !== undefined) return 'terminal'
  return derived
}

/**
 * Resolve the frame drawn AND the header text that goes with it. A `file` frame
 * with no authored `filename` takes the language-derived name rather than
 * rendering an empty header bar, which reads as a rendering bug.
 */
function resolveCodeFrame(input: {
  readonly component: Record<string, unknown>
  readonly filename: string | undefined
  readonly output: string | undefined
  readonly terminalLabel: string | undefined
  readonly language: string | undefined
}): ResolvedFrame {
  const { component, filename, output, terminalLabel, language } = input
  const fallback = resolveDefaultCodeFrame(language)
  const terminal = terminalLabel ?? DEFAULT_TERMINAL_LABEL
  const frame = resolveFrameKind(component['codeFrame'], filename, output, fallback.frame)
  const derivedFilename = fallback.frame === 'file' ? fallback.label : undefined
  return {
    frame,
    filename: frame === 'file' ? (filename ?? derivedFilename) : filename,
    terminalLabel: terminal,
  }
}

/** Inputs shared by both `<pre>` branches. */
interface CodePreInput {
  readonly highlight: CodeHighlight | undefined
  readonly rest: Record<string, unknown>
  readonly dataTestId: string | undefined
  readonly preClass: string
  readonly language: string | undefined
  readonly lineNumbers: boolean | undefined
  readonly content: string | undefined
  readonly renderedChildren: readonly ReactElement[]
}

/**
 * The command `<pre>` — the element a reader copies.
 *
 * Highlighted branch: React owns the `<pre>`, re-emitting Shiki's class list and
 * injecting the `<code>` subtree. Only `id` is passed through (matching what the
 * legacy post-render splice re-injected), so the author's `props.className` stays
 * OFF the highlighted container exactly as it does today — repainting it is a
 * separate, baseline-affecting change.
 *
 * Plain branch: today's placeholder `<pre>`, carrying the base64 source so the
 * retained post-render splice can still highlight it if the pre-pass produced
 * nothing.
 */
function renderCodePre(input: CodePreInput): ReactElement {
  const { highlight, rest, dataTestId, preClass, language, lineNumbers, content } = input
  if (highlight !== undefined) {
    return (
      <pre
        id={rest['id'] as string | undefined}
        className={highlight.preClass}
        data-testid={dataTestId}
        data-code-command="true"
        data-copy-target="true"
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR one-shot; markup is pre-highlighted + canonically sanitised
        dangerouslySetInnerHTML={{ __html: highlight.innerHtml }}
      />
    )
  }
  const payload =
    typeof language === 'string' && language.length > 0 && typeof content === 'string'
      ? Buffer.from(content, 'utf-8').toString('base64')
      : undefined
  return (
    <pre
      {...rest}
      className={preClass}
      data-testid={dataTestId}
      data-line-numbers={lineNumbers ? 'true' : undefined}
      data-code-block={payload}
      data-code-lang={payload !== undefined ? language : undefined}
      data-code-command="true"
      data-copy-target="true"
    >
      <code
        className={language ? `language-${language}` : undefined}
        data-language={language}
      >
        {content ?? input.renderedChildren}
      </code>
    </pre>
  )
}

/**
 * Wrap an UNFRAMED block's `<pre>` and its copy control in the copy SCOPE — the
 * element the delegated script walks up to when resolving what to put on the
 * clipboard. With no header to hold it, the control floats at the top-right of
 * the code surface, which is where it lived before every block gained a frame.
 */
function renderBareScope(codePre: ReactElement, copyControl: ReactNode): ReactElement {
  return (
    <div
      className="relative"
      data-code-copy-scope="true"
    >
      {codePre}
      {copyControl !== undefined && <span className={BARE_COPY_SLOT_CLASSES}>{copyControl}</span>}
    </div>
  )
}

/**
 * Header row: the filename caption, or the terminal marker — and, on the right,
 * the copy control. The control lives HERE rather than over the code because on
 * a narrow viewport a floating button covers the first line's trailing tokens,
 * which are exactly the ones the reader is trying to read.
 *
 * `>_` marks a shell session with no icon dependency. NO `$` prompt glyph: it
 * would be swept up by the copy button and by a manual selection, and the reader
 * would paste `$ curl …` and get "command not found: $".
 */
function renderFrameHeader(
  frame: Exclude<CodeFrame, 'none'>,
  filename: string,
  terminalLabel: string,
  copyControl: ReactNode
): ReactElement {
  const isFile = frame === 'file'
  return (
    <figcaption
      data-code-filename={isFile ? 'true' : undefined}
      data-code-terminal={isFile ? undefined : 'true'}
      className={computeCodeFrameHeaderClasses()}
    >
      <span>{isFile ? filename : `>_ ${terminalLabel}`}</span>
      {copyControl}
    </figcaption>
  )
}

/** Inputs for the framed (`file` / `terminal`) composition. */
interface FrameInput {
  readonly frame: Exclude<CodeFrame, 'none'>
  readonly filename: string | undefined
  readonly terminalLabel: string
  readonly output: string | undefined
  readonly codePre: ReactElement
  readonly copyControl: ReactNode
}

/**
 * The framed composition: ONE `<figure>` holding the header, the command, and —
 * when the author supplied one — the command's output as a SECOND `<pre>`. The
 * figure's accessible name is the filename (or the terminal marker), so a
 * screen-reader user hears which file they are in before hearing its contents
 *.
 *
 * The `<figure>` IS the copy scope: the button sits in the header, above the
 * code, so the scope has to enclose both. That puts the output `<pre>` inside
 * the scope for the first time — which is why the delegated handler resolves the
 * payload through `[data-copy-target]` rather than through the scope's first
 * `<pre>`.
 */
function renderFramedBlock(input: FrameInput): ReactElement {
  const { frame, filename, terminalLabel, output, codePre, copyControl } = input
  return (
    <figure
      data-code-frame={frame}
      data-code-copy-scope="true"
      aria-label={frame === 'file' ? filename : terminalLabel}
      className={computeCodeFrameShellClasses()}
    >
      {renderFrameHeader(frame, filename ?? '', terminalLabel, copyControl)}
      {codePre}
      {output !== undefined && (
        <pre
          data-code-output="true"
          className={computeCodeOutputClasses()}
        >
          {output}
        </pre>
      )}
    </figure>
  )
}

/**
 * `code` component renderer. Emits either a bare (unframed) block — byte-for-byte
 * today's structure, so the committed design-system baselines are untouched — or
 * a `<figure>` frame with a filename / terminal header and an optional output
 * block.
 */
export const codeBlockComponent: ComponentRenderer = ({
  elementProps,
  content,
  renderedChildren,
  component,
  currentLang,
  languages,
}) => {
  const c = (component ?? {}) as Record<string, unknown>
  const language = elementProps['language'] as string | undefined
  const lineNumbers = elementProps['lineNumbers'] as boolean | undefined
  const { frame, filename, terminalLabel } = resolveCodeFrame({
    component: c,
    filename: topLevelString(c, 'filename', currentLang, languages),
    output: topLevelString(c, 'output', currentLang, languages),
    terminalLabel: topLevelString(c, 'terminalLabel', currentLang, languages),
    language,
  })
  const output = topLevelString(c, 'output', currentLang, languages)
  const copyLabel = topLevelString(c, 'copyLabel', currentLang, languages) ?? DEFAULT_COPY_LABEL
  const copiedLabel =
    topLevelString(c, 'copiedLabel', currentLang, languages) ?? DEFAULT_COPIED_LABEL

  const {
    'data-testid': dataTestId,
    language: _language,
    'data-language': _dataLanguage,
    lineNumbers: _lineNumbers,
    'data-line-numbers': _dataLineNumbers,
    className,
    ...rest
  } = elementProps as Record<string, unknown>
  const authorClassName = className as string | undefined

  const codePre = renderCodePre({
    highlight: readCodeHighlight(component),
    rest,
    dataTestId: dataTestId as string | undefined,
    preClass: authorClassName ? `${authorClassName} font-mono` : 'font-mono',
    language,
    lineNumbers,
    content,
    renderedChildren,
  })
  const copyControl =
    c['copy'] === false ? undefined : (
      <>
        <CodeCopyButton
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
        <CodeCopyStatus />
      </>
    )
  if (frame === 'none') return renderBareScope(codePre, copyControl)
  return renderFramedBlock({ frame, filename, terminalLabel, output, codePre, copyControl })
}
