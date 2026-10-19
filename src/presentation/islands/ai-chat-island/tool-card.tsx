/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Fragment } from 'react'
import {
  computeCodeBlockClasses,
  computeCodeBlockHeaderClasses,
} from '@/presentation/design/code-block-default-classes'
import {
  CODE_BLOCK_LINE_CONTENT_CLASSES,
  CODE_BLOCK_WRAP_CLASSES,
  computeCodeBlockCodeClasses,
  computeCodeBlockFooterClasses,
  computeCodeBlockLineClasses,
  computeCodeBlockTitleClasses,
} from '@/presentation/design/code-block-line-classes'
import type { ChatLabels, ChatToolLine } from './types'
import type { ReactElement } from 'react'

/**
 * What an open tool line shows (shadcn's AI Elements Tool, on our Code Block):
 * what the call was given and what it returned, each a small Code Block titled
 * Input and Output, the output drawn destructive when the call failed and a cut
 * preview saying so in its footer. A call held for the reader has not run, so
 * it shows its input alone.
 *
 * The previews are the server's (`chat-tool-preview.ts`): the reader's own view
 * of the call, cut at 2,000 characters. They are JSON or plain text, drawn as
 * text — React escapes them — with no highlighter in the browser. Loaded
 * lazily, the first time a reader opens a tool line, so the chat itself ships
 * none of this.
 */

/** The words of a card, in the page language. */
export type ToolCardLabels = Pick<ChatLabels, 'input' | 'output' | 'truncated'>

/** A preview's text as the Code Block's code: one line part per line of it. */
const PreviewCode = ({ text }: { readonly text: string }): ReactElement => (
  <code
    data-slot="code-block-code"
    className={computeCodeBlockCodeClasses(true)}
  >
    {text.split('\n').map((line, index) => (
      // A preview is fixed once drawn, so a line's place is its identity.
      <Fragment key={index}>
        {index > 0 && '\n'}
        <span
          data-slot="code-block-line"
          data-variant="default"
          className={computeCodeBlockLineClasses('default', false)}
        >
          <span
            data-slot="code-block-line-content"
            className={CODE_BLOCK_LINE_CONTENT_CLASSES}
          >
            {line}
          </span>
        </span>
      </Fragment>
    ))}
  </code>
)

/** One preview drawn as a small Code Block. */
const PreviewBlock = ({
  title,
  text,
  cut,
  destructive,
}: {
  readonly title: string
  readonly text: string
  /** The footer of a cut preview, or nothing for a whole one. */
  readonly cut: string | undefined
  readonly destructive: boolean
}): ReactElement => (
  <figure
    data-slot="code-block"
    data-size="sm"
    data-variant={destructive ? 'destructive' : 'default'}
    data-code-frame="file"
    data-wrap="true"
    className={computeCodeBlockClasses()}
  >
    <figcaption
      data-slot="code-block-header"
      className={computeCodeBlockHeaderClasses()}
    >
      <span
        data-slot="code-block-title"
        className={computeCodeBlockTitleClasses()}
      >
        {title}
      </span>
    </figcaption>
    <pre
      data-slot="code-block-content"
      className={`shiki ${CODE_BLOCK_WRAP_CLASSES}`}
    >
      <PreviewCode text={text} />
    </pre>
    {cut !== undefined && (
      <pre
        data-slot="code-block-footer"
        className={computeCodeBlockFooterClasses()}
      >
        {cut}
      </pre>
    )}
  </figure>
)

/** A tool line's card: its Input, then its Output once it ran. */
export default function ToolCard({
  tool,
  labels,
}: {
  readonly tool: ChatToolLine
  readonly labels: ToolCardLabels
}): ReactElement {
  const ran = tool.state !== 'pending-approval' && tool.state !== 'running'
  return (
    <div className="flex flex-col gap-2 whitespace-normal">
      {tool.input !== undefined && (
        <PreviewBlock
          title={labels.input}
          text={tool.input}
          cut={tool.inputTruncated === true ? labels.truncated : undefined}
          destructive={false}
        />
      )}
      {ran && tool.output !== undefined && (
        <PreviewBlock
          title={labels.output}
          text={tool.output}
          cut={tool.outputTruncated === true ? labels.truncated : undefined}
          destructive={tool.state === 'failed'}
        />
      )}
    </div>
  )
}
