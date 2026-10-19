/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The FRAME of a `code` block — shadcn/ui's Code Block: the `<figure>` with its
 * header, content and footer — lifted out of `code-block-component.tsx`, which
 * owns the `<pre>` branches, together with the frame precedence. The frame and its bar are the two elements an author's
 * `classes` reach by name: `frame` on the `<figure>`, `caption` on the
 * `<figcaption>`.
 */

import { cloneElement } from 'react'
import { resolveDefaultCodeFrame } from '@/domain/models/app/pages/code-frame-defaults'
import { CodeCopyButton, CodeCopyStatus } from '@/presentation/render/elements/code-copy-controls'
import { cn } from '../../design/class-merge'
import {
  computeCodeBlockClasses,
  computeCodeBlockFilenameClasses,
  computeCodeBlockHeaderClasses,
} from '../../design/code-block-default-classes'
import {
  computeCodeBlockActionsClasses,
  computeCodeBlockFooterClasses,
  computeCodeBlockTitleClasses,
} from '../../design/code-block-line-classes'
import type { ReactElement, ReactNode } from 'react'

/** Chrome drawn around the block. Mirrors `CodeFrameSchema`. */
export type CodeFrame = 'none' | 'file' | 'terminal'

/**
 * Header row, on shadcn/ui's Code Block anatomy: the TITLE (the filename, or
 * the terminal marker) and, beside it, the ACTIONS group holding the copy
 * button. The control lives in the header rather than over the code because on
 * a narrow viewport a floating button covers the first line's trailing tokens,
 * which are exactly the ones the reader is trying to read.
 *
 * `>_` marks a shell session with no icon dependency. NO `$` prompt glyph: it
 * would be swept up by the copy button and by a manual selection, and the reader
 * would paste `$ curl …` and get "command not found: $".
 *
 * The text itself is the `code-block-filename` part inside the title, carrying
 * `[data-code-filename]` / `[data-code-terminal]`: those name the header's TEXT,
 * so the button is kept out of them. The status region stays outside the
 * title too, so a "Copied" announcement never becomes part of the title's text.
 */
function renderFrameHeader(
  frame: Exclude<CodeFrame, 'none'>,
  filename: string,
  terminalLabel: string,
  { copyButton, copyStatus, captionPart }: FrameHeaderInput
): ReactElement {
  const isFile = frame === 'file'
  return (
    <figcaption
      data-slot="code-block-header"
      className={cn(computeCodeBlockHeaderClasses(), captionPart)}
    >
      <span
        data-slot="code-block-title"
        className={computeCodeBlockTitleClasses()}
      >
        <span
          data-slot="code-block-filename"
          data-code-filename={isFile ? 'true' : undefined}
          data-code-terminal={isFile ? undefined : 'true'}
          className={computeCodeBlockFilenameClasses()}
        >
          {isFile ? filename : `>_ ${terminalLabel}`}
        </span>
      </span>
      {copyButton !== undefined && (
        <span
          data-slot="code-block-actions"
          className={computeCodeBlockActionsClasses()}
        >
          {copyButton}
        </span>
      )}
      {copyStatus}
    </figcaption>
  )
}

/** The copy control, split in two: the button and its announcement region. */
interface FrameHeaderInput {
  readonly copyButton: ReactNode
  readonly copyStatus: ReactNode
  readonly captionPart?: string | undefined
}

/** shadcn/ui's Code Block size. Mirrors the schema's `size`. */
export type CodeBlockSize = 'default' | 'sm'
/** shadcn/ui's Code Block variant. Mirrors the schema's `variant`. */
export type CodeBlockVariant = 'default' | 'destructive'

/** Inputs for the framed (`file` / `terminal`) composition. */
interface FrameInput {
  readonly frame: Exclude<CodeFrame, 'none'>
  readonly filename: string | undefined
  readonly terminalLabel: string
  readonly output: string | undefined
  readonly codePre: ReactElement
  readonly copyButton: ReactNode
  readonly copyStatus: ReactNode
  readonly size: CodeBlockSize
  readonly variant: CodeBlockVariant
  /** The author's part classes: `frame` on the `<figure>`, `caption` on its bar. */
  readonly parts?: Readonly<Record<string, string>>
}

/**
 * The framed composition: ONE `<figure>` — shadcn/ui's `code-block`, naming its
 * size and variant — holding the header, the command as the scrolling content,
 * and, when the author supplied one, the command's output as the FOOTER, outside
 * the content so it never reads as part of the command. The figure's accessible
 * name is the filename (or the terminal marker), so a screen-reader user hears
 * which file they are in before hearing its contents.
 *
 * The `<figure>` IS the copy scope: the button sits in the header, above the
 * code, so the scope has to enclose both. That puts the output `<pre>` inside
 * the scope — which is why the delegated handler resolves the payload through
 * `[data-copy-target]` rather than through the scope's first `<pre>`.
 */
export function renderFramedBlock(input: FrameInput): ReactElement {
  const { frame, filename, terminalLabel, output, codePre, copyButton, copyStatus, parts } = input
  return (
    <figure
      data-slot="code-block"
      data-size={input.size}
      data-variant={input.variant}
      data-code-frame={frame}
      data-code-copy-scope="true"
      aria-label={frame === 'file' ? filename : terminalLabel}
      className={cn(computeCodeBlockClasses(), parts?.['frame'])}
    >
      {renderFrameHeader(frame, filename ?? '', terminalLabel, {
        copyButton,
        copyStatus,
        captionPart: parts?.['caption'],
      })}
      {cloneElement(codePre, { 'data-slot': 'code-block-content' } as Record<string, unknown>)}
      {output !== undefined && (
        <pre
          data-slot="code-block-footer"
          data-code-output="true"
          className={computeCodeBlockFooterClasses()}
        >
          {output}
        </pre>
      )}
    </figure>
  )
}

/** Default terminal marker when the author does not name one. */
const DEFAULT_TERMINAL_LABEL = 'terminal'

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
export function resolveCodeFrame(input: {
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

/**
 * The copy control in its two halves — the button, and the status region that
 * announces the copy — or neither when the author turned copying off.
 */
export function copyParts(
  enabled: boolean,
  copyLabel: string,
  copiedLabel: string
): { readonly copyButton: ReactNode; readonly copyStatus: ReactNode } {
  if (!enabled) return { copyButton: undefined, copyStatus: undefined }
  return {
    copyButton: (
      <CodeCopyButton
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
      />
    ),
    copyStatus: <CodeCopyStatus />,
  }
}
