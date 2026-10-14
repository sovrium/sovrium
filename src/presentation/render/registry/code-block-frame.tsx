/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The FRAME of a `code` block — the `<figure>` with its file or terminal bar —
 * lifted out of `code-block-component.tsx`, which owns the `<pre>` branches,
 * together with the frame precedence. The frame and its bar are the two elements an author's
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
  computeCodeBlockOutputClasses,
} from '../../design/code-block-default-classes'
import type { ReactElement, ReactNode } from 'react'

/** Chrome drawn around the block. Mirrors `CodeFrameSchema`. */
export type CodeFrame = 'none' | 'file' | 'terminal'

/**
 * Header row: the filename caption, or the terminal marker — and, on the right,
 * the copy control. The control lives HERE rather than over the code because on
 * a narrow viewport a floating button covers the first line's trailing tokens,
 * which are exactly the ones the reader is trying to read.
 *
 * `>_` marks a shell session with no icon dependency. NO `$` prompt glyph: it
 * would be swept up by the copy button and by a manual selection, and the reader
 * would paste `$ curl …` and get "command not found: $".
 *
 * The copy BUTTON sits inside the `code-block-filename` part, at its trailing
 * edge: `[data-code-filename]` / `[data-code-terminal]` is the element the
 * suite reads as "the header that holds the copy button". The status region
 * stays outside it, in the bar, so a "Copied" announcement never becomes part
 * of the filename's text.
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
        data-slot="code-block-filename"
        data-code-filename={isFile ? 'true' : undefined}
        data-code-terminal={isFile ? undefined : 'true'}
        className={computeCodeBlockFilenameClasses()}
      >
        <span className="truncate">{isFile ? filename : `>_ ${terminalLabel}`}</span>
        {copyButton}
      </span>
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

/** Inputs for the framed (`file` / `terminal`) composition. */
interface FrameInput {
  readonly frame: Exclude<CodeFrame, 'none'>
  readonly filename: string | undefined
  readonly terminalLabel: string
  readonly output: string | undefined
  readonly codePre: ReactElement
  readonly copyButton: ReactNode
  readonly copyStatus: ReactNode
  /** The author's part classes: `frame` on the `<figure>`, `caption` on its bar. */
  readonly parts?: Readonly<Record<string, string>>
}

/**
 * The framed composition: ONE `<figure>` holding the header, the command, and —
 * when the author supplied one — the command's output as a SECOND `<pre>`. The
 * figure's accessible name is the filename (or the terminal marker), so a
 * screen-reader user hears which file they are in before hearing its contents.
 *
 * The `<figure>` IS the copy scope: the button sits in the header, above the
 * code, so the scope has to enclose both. That puts the output `<pre>` inside
 * the scope for the first time — which is why the delegated handler resolves the
 * payload through `[data-copy-target]` rather than through the scope's first
 * `<pre>`.
 */
export function renderFramedBlock(input: FrameInput): ReactElement {
  const { frame, filename, terminalLabel, output, codePre, copyButton, copyStatus, parts } = input
  return (
    <figure
      data-slot="code-block"
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
          data-code-output="true"
          className={computeCodeBlockOutputClasses()}
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
