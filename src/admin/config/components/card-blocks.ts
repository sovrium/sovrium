/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/dl-rows@0.37.0#c272d6a1930e

// The console's facts cards, INSTALLED from the library's `dl-rows` block: a
// shadcn Card with a header (a title and the sentence that says what the facts
// are) over its rows. The copy is the block's card; `Console Block Parity`
// holds it to that subtree. Re-install with
// `sovrium library add block/dl-rows --update`.
//
// The bindings are the title, the sentence (and its testid), the card's testid,
// and the body:
// the block lists static terms, a console card lists rows its page reads.

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

export const factsCardCopy = {
  type: 'card',
  props: { className: 'max-w-3xl p-0' },
  children: [
    {
      type: 'container',
      props: { className: 'border-b border-border p-6' },
      children: [
        {
          type: 'text',
          element: 'h2',
          props: { className: 'text-xl font-semibold text-foreground' },
          content: '',
        },
        {
          type: 'text',
          element: 'p',
          props: { className: 'mt-1 text-sm text-muted-foreground' },
          content: '',
        },
      ],
    },
    { type: 'container', children: [] },
  ],
} as const

/** What a facts card shows. */
export interface FactsCardBinding {
  readonly title: string
  readonly description: string
  readonly testId?: string
  /** A testid on the sentence, for a page whose specs address it. */
  readonly descriptionTestId?: string
  readonly body: PageComponent
}

/** A facts card: the installed copy with its title, sentence, testid and body. */
export const factsCard = ({
  title,
  description,
  testId,
  descriptionTestId,
  body,
}: FactsCardBinding): PageComponent => {
  const [header] = factsCardCopy.children
  const [heading, sentence] = header.children
  return {
    ...factsCardCopy,
    props:
      testId === undefined
        ? factsCardCopy.props
        : { ...factsCardCopy.props, 'data-testid': testId },
    children: [
      {
        ...header,
        children: [
          { ...heading, content: title },
          {
            ...sentence,
            ...(descriptionTestId === undefined
              ? {}
              : { props: { ...sentence.props, 'data-testid': descriptionTestId } }),
            content: description,
          },
        ],
      },
      body,
    ],
  } as PageComponent
}

/**
 * A facts card from a section's own nodes: a heading node, an optional
 * sentence node (a `p`), then the content. The developers pages compose their
 * sections this way; the card takes the heading and the sentence into its
 * header and the rest into its padded body.
 */
export const factsCardFrom = (children: readonly PageComponent[]): PageComponent => {
  const [head, ...rest] = children as readonly Readonly<Record<string, unknown>>[]
  const second = rest[0]
  const hasSentence = second?.type === 'text' && second.element === 'p'
  return factsCard({
    title: String(head?.content ?? ''),
    description: hasSentence ? String(second.content ?? '') : '',
    body: {
      type: 'container',
      element: 'div',
      // `px-6 pb-6`, not `p-6`: the card's gap already parts the body from the
      // header's rule (the block's own body is `px-6`), so a top padding
      // stacks on it as a blank band.
      props: { className: 'flex flex-col gap-3 px-6 pb-6' },
      children: (hasSentence ? rest.slice(1) : rest) as readonly PageComponent[],
    } as PageComponent,
  })
}
