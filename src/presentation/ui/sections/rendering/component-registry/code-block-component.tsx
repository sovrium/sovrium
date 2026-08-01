/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

type CodeFrame = 'none' | 'file' | 'terminal'

const DEFAULT_TERMINAL_LABEL = 'terminal'
const DEFAULT_COPY_LABEL = 'Copy'
const DEFAULT_COPIED_LABEL = 'Copied'

const BARE_COPY_SLOT_CLASSES = 'absolute top-2 right-2 flex items-center'

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

interface ResolvedFrame {
  readonly frame: CodeFrame
  readonly filename: string | undefined
  readonly terminalLabel: string
}

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

interface FrameInput {
  readonly frame: Exclude<CodeFrame, 'none'>
  readonly filename: string | undefined
  readonly terminalLabel: string
  readonly output: string | undefined
  readonly codePre: ReactElement
  readonly copyControl: ReactNode
}

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
