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
 * `codeFrame`, `filename`, `terminalLabel`, `copy`, `copyLabel`, `copiedLabel`,
 * `output` and `lineNumbers` are declared at the component TOP LEVEL (siblings
 * of `props`),
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
 * click handler itself is the delegated `copyCodeScript` in `page-body-scripts.tsx`;
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
 *
 * ## Line numbers
 *
 * `lineNumbers: true` adds a gutter of one addressable `[data-line-number]`
 * element per line, INSIDE the `<pre>` and outside the `<code>` — which is what
 * keeps it off the clipboard, since the copy handler reads the `<code>`'s text.
 * On the highlighted path the injected subtree moves into a `[data-code-lines]`
 * wrapper so the gutter can be its sibling; an UNGUTTERED block keeps today's
 * markup exactly, in both branches. See {@link renderLineGutter} for why the
 * numbers are elements rather than a CSS counter.
 */

import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { codeLineNumbers } from '@/domain/models/app/pages/code-line-numbers'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { CodeCopyButton, CodeCopyStatus } from '@/presentation/render/elements/code-copy-controls'
import {
  readCodeHighlight,
  type CodeHighlight,
} from '@/presentation/render/resolve/code-highlight-resolver'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { renderFramedBlock, resolveCodeFrame } from './code-block-frame'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement, ReactNode } from 'react'

/** Default copy-button label (also its stable accessible name). */
const DEFAULT_COPY_LABEL = 'Copy'
/** Default post-copy confirmation label. */
const DEFAULT_COPIED_LABEL = 'Copied'

/**
 * Resting place for the copy control on an UNFRAMED block (`codeFrame: 'none'`),
 * which has no header to hold it. Positioned via CLASSES (never an inline
 * `style`): the canonical sanitiser drops `style`, and a pages content spec
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

/** Inputs shared by both `<pre>` branches. */
interface CodePreInput {
  readonly highlight: CodeHighlight | undefined
  readonly rest: Record<string, unknown>
  readonly dataTestId: string | undefined
  readonly preClass: string
  /** The author's `props.className`, carried onto the highlighted `<pre>` too. */
  readonly authorClassName: string | undefined
  readonly language: string | undefined
  /**
   * The gutter's numbers, or EMPTY when the author asked for none. An array
   * rather than the boolean the schema declares: whether a gutter is drawn and
   * what it contains are one question, and a renderer holding only the boolean
   * would have to re-derive the second — in two branches, from two different
   * shapes of markup.
   */
  readonly gutter: readonly number[]
  readonly content: string | undefined
  readonly renderedChildren: readonly ReactElement[]
}

/**
 * The line-number gutter — one ADDRESSABLE element per line.
 *
 * ## Why each number is an element and not a CSS counter
 *
 * A `::before { content: counter(line) }` gutter is less markup and is the
 * wrong tool. `lineNumbers` shipped half-wired — read off the open `props` bag,
 * turned into a `data-line-numbers` attribute, and never styled by anything —
 * so an author could ask for a gutter, watch it validate, and get nothing while
 * the published docs advertised it in both locales. A counter-generated number
 * is unreachable to everything that could have caught that: it cannot be
 * counted, addressed by its own value, or asserted absent from a clipboard
 * payload. Each number is therefore a real `[data-line-number="N"]` element,
 * addressable exactly as this file's own command and output are by
 * `[data-code-command]` / `[data-code-output]`.
 *
 * ## Why it sits inside `<pre>` but outside `<code>`
 *
 * The delegated copy handler resolves its payload as
 * `pre[data-copy-target] → querySelector('code') → textContent`. A gutter
 * inside the `<code>` would be copied WITH the snippet and pasted into the
 * reader's editor as a leading column of digits — the filename failure of
 * a pages content spec, one element down. Outside it, exclusion is structural:
 * nothing has to remember to strip the numbers, because they were never in the
 * element that gets read.
 *
 * `aria-hidden` because the numbers are chrome. A screen-reader user reaching a
 * numbered snippet should hear the code, not "one two three" ahead of it; the
 * block is already named for them by its filename.
 */
function renderLineGutter(numbers: readonly number[]): ReactElement {
  return (
    <span
      data-line-numbers-gutter="true"
      aria-hidden="true"
    >
      {numbers.map((line) => (
        <span
          key={line}
          data-line-number={String(line)}
        >
          {line}
        </span>
      ))}
    </span>
  )
}

/**
 * The HIGHLIGHTED `<pre>` — React owns it, re-emitting Shiki's class list and
 * injecting the `<code>` subtree.
 *
 * Only `id`, the type stamp and the author's `props.className` are passed
 * through: the `<pre>` is the element that names the block's type, so it is
 * also the one an author's class must land on — the only hook a config has to
 * size or hide a code block without wrapping it in a container.
 */
function renderHighlightedPre(input: CodePreInput, highlight: CodeHighlight): ReactElement {
  const { rest, dataTestId, gutter } = input
  const className = resolveClasses(highlight.preClass, input.authorClassName)
  const componentType = rest['data-component-type'] as string | undefined
  // UNGUTTERED: the injected subtree is the `<pre>`'s only content — byte-for-
  // byte the markup every existing block already ships, so adding a gutter
  // option repaints nothing that did not ask for one.
  if (gutter.length === 0) {
    return (
      <pre
        id={rest['id'] as string | undefined}
        className={className}
        data-testid={dataTestId}
        data-component-type={componentType}
        data-code-command="true"
        data-copy-target="true"
        // eslint-disable-next-line sovrium/require-sanitized-html -- syntax-highlighter output, which HTML-escapes the code text
        dangerouslySetInnerHTML={{ __html: highlight.innerHtml }}
      />
    )
  }
  // GUTTERED: `dangerouslySetInnerHTML` and children are mutually exclusive on
  // one element, so the highlighted subtree moves down into a wrapper and the
  // gutter becomes its sibling. The delegated copy handler resolves its payload
  // with `querySelector('code')`, which still finds the `<code>` one level
  // deeper — so the numbers stay off the clipboard by CONSTRUCTION rather than
  // by a rule someone has to remember.
  return (
    <pre
      id={rest['id'] as string | undefined}
      className={className}
      data-testid={dataTestId}
      data-component-type={componentType}
      data-line-numbers="true"
      data-code-command="true"
      data-copy-target="true"
    >
      {renderLineGutter(gutter)}
      <span
        data-code-lines="true"
        // eslint-disable-next-line sovrium/require-sanitized-html -- syntax-highlighter output, which HTML-escapes the code text
        dangerouslySetInnerHTML={{ __html: highlight.innerHtml }}
      />
    </pre>
  )
}

/**
 * The PLAIN `<pre>` — today's placeholder, carrying the base64 source so the
 * retained post-render splice can still highlight it if the pre-pass produced
 * nothing.
 */
function renderPlainPre(input: CodePreInput): ReactElement {
  const { rest, dataTestId, preClass, language, gutter, content } = input
  const payload =
    typeof language === 'string' && language.length > 0 && typeof content === 'string'
      ? Buffer.from(content, 'utf-8').toString('base64')
      : undefined
  const codeEl = (
    <code
      className={language ? `language-${language}` : undefined}
      data-language={language}
    >
      {content ?? input.renderedChildren}
    </code>
  )
  return (
    <pre
      {...rest}
      className={preClass}
      data-testid={dataTestId}
      data-line-numbers={gutter.length > 0 ? 'true' : undefined}
      data-code-block={payload}
      data-code-lang={payload !== undefined ? language : undefined}
      data-code-command="true"
      data-copy-target="true"
    >
      {gutter.length === 0 ? (
        codeEl
      ) : (
        <>
          {renderLineGutter(gutter)}
          <span data-code-lines="true">{codeEl}</span>
        </>
      )}
    </pre>
  )
}

/** The command `<pre>` — the element a reader copies — in whichever branch applies. */
function renderCodePre(input: CodePreInput): ReactElement {
  const { highlight } = input
  return highlight === undefined ? renderPlainPre(input) : renderHighlightedPre(input, highlight)
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
  designStyles,
}) => {
  const c = (component ?? {}) as Record<string, unknown>
  const language = elementProps['language'] as string | undefined
  // `component.lineNumbers`, NEVER `elementProps.lineNumbers`. The field is
  // declared at the component TOP LEVEL (`code-element.ts`) precisely because
  // the open `props` bag validates any key — which is how this option spent its
  // whole life being read, rendered as an attribute, and styled by nothing.
  // Reading it off `props` here would re-break it in silence the moment the
  // schema moved, so the spec asserts the attribute rather than the gutter
  // alone.
  const gutter = c['lineNumbers'] === true ? codeLineNumbers(content) : []
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
  } = omitInternalMarkers(elementProps) as Record<string, unknown>
  const authorClassName = className as string | undefined

  const codePre = renderCodePre({
    highlight: readCodeHighlight(component),
    rest,
    dataTestId: dataTestId as string | undefined,
    // `font-mono` is a FLOOR, not a default: a code block that lost its
    // monospace face would misrepresent the code it renders, so it is applied
    // as the third `resolveClasses` layer and beats an author `font-sans`.
    // (The concatenation this replaces put `font-mono` last for the same
    // reason, but relied on CSS source order to make it stick.)
    preClass: resolveClasses('', undefined, authorClassName, 'font-mono'),
    authorClassName,
    language,
    gutter,
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
  const parts = designStyles?.parts
  return renderFramedBlock({ frame, filename, terminalLabel, output, codePre, copyControl, parts })
}
