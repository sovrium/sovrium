/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Comment mention markup: `@[<user id>]` in a comment body.
 *
 * The body is the one canonical carrier of a mention. The composer shows a
 * picked person as `@<name>` and swaps each picked name for its markup when the
 * comment is posted; the server derives the comment's mentions from the markup;
 * a thread renders each token back as a name. These are the pure halves of that
 * round trip, shared by the server (which parses) and the comment island (which
 * renders and re-encodes), so the two cannot disagree about what a token is.
 */

/** One mention token. Ids are opaque account ids: letters, digits, `_` and `-`. */
const MENTION_TOKEN = /@\[([\w-]{1,128})\]/g

/** A run of a comment body: plain text, or one mention token. */
export type MentionSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'mention'; readonly id: string }

/** The markup that mentions `id`. */
export function mentionMarkup(id: string): string {
  return `@[${id}]`
}

/**
 * The body cut into text runs and mention tokens, in order. `split` on a
 * pattern with one capturing group alternates text and captured id, so every
 * odd part is an id and the empty text runs between adjacent tokens drop out.
 */
export function splitMentionMarkup(content: string): readonly MentionSegment[] {
  return content.split(MENTION_TOKEN).flatMap((part, index): readonly MentionSegment[] => {
    if (index % 2 === 1) return [{ kind: 'mention', id: part }]
    return part === '' ? [] : [{ kind: 'text', text: part }]
  })
}

/** Every distinct id the body mentions, in first-mention order. */
export function extractMentionIds(content: string): readonly string[] {
  return [...new Set([...content.matchAll(MENTION_TOKEN)].map((match) => match[1] ?? ''))]
}

/**
 * A name the composer shows in place of a token, and the token it stands for.
 * `label` is what the writer reads (`@Carol Dupont`); `markup` is what is sent.
 */
export interface MentionPick {
  readonly label: string
  readonly markup: string
}

/**
 * The text the writer sees, with each PICKED name swapped for its markup.
 *
 * Only picks are encoded: a name the writer typed by hand, without picking it,
 * stays plain text. Each pick consumes the first occurrence of its label still
 * in plain text — a label starts with `@` and a name, and markup with `@[`, so
 * a label cannot match inside markup already written — so picking the same
 * person twice encodes two occurrences and leaves a third, typed one, alone. A
 * pick whose name the writer has since deleted matches nothing and is dropped.
 */
export function encodeMentionPicks(text: string, picks: readonly MentionPick[]): string {
  return picks.reduce((encoded, pick) => {
    const at = pick.label === '' ? -1 : encoded.indexOf(pick.label)
    return at === -1
      ? encoded
      : `${encoded.slice(0, at)}${pick.markup}${encoded.slice(at + pick.label.length)}`
  }, text)
}

/**
 * The body as the writer should see it in an edit box, and the picks that turn
 * it back into the same markup on save.
 *
 * `labelFor` names each token: a resolved person's `@<name>`, or the neutral
 * placeholder for a token that does not resolve. Either way the token itself
 * survives the round trip through its pick.
 */
export function decodeMentionMarkup(
  content: string,
  labelFor: (id: string) => string
): { readonly text: string; readonly picks: readonly MentionPick[] } {
  const segments = splitMentionMarkup(content)
  const text = segments
    .map((segment) => (segment.kind === 'text' ? segment.text : labelFor(segment.id)))
    .join('')
  const picks = segments.flatMap((segment) =>
    segment.kind === 'mention'
      ? [{ label: labelFor(segment.id), markup: mentionMarkup(segment.id) }]
      : []
  )
  return { text, picks }
}
