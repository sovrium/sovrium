/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The line numbers a `code` block's gutter draws, when its author asked for one
 * with the top-level `lineNumbers` field.
 *
 * ─── WHY THE NUMBERS ARE COMPUTED AND NOT COUNTED BY CSS ───────────────────
 *
 * The obvious gutter is a CSS counter: give each rendered line a `::before`
 * with `content: counter(line)` and let the browser do the arithmetic. It is
 * less markup and it is the wrong tool here, for a reason that is the whole
 * point of this feature existing at all.
 *
 * `lineNumbers` shipped HALF-WIRED: the renderer read the key off the open
 * `props` bag and emitted `data-line-numbers="true"`, and nothing in the
 * product ever styled that attribute. An author could ask for a gutter, watch
 * the config validate and typecheck and render an attribute, and get nothing —
 * for as long as the published docs advertised the option in both locales. A
 * counter-generated number is unreachable to everything that could have caught
 * that: it cannot be counted, it cannot be addressed by its own value, and it
 * cannot be asserted absent from a clipboard payload. A gutter that silently
 * stopped rendering would be indistinguishable from one that never existed,
 * which is exactly the failure already paid for once.
 *
 * So each number is a real element carrying `data-line-number`, addressable the
 * way a bar is by `data-bar-key` and the way the block's own command and output
 * are by `data-code-command` / `data-code-output`. [internal ref] pins
 * it.
 *
 * ─── THE TRAILING NEWLINE IS NOT A LINE ────────────────────────────────────
 *
 * `'a\nb\n'` is TWO lines, not three. A `<pre>` does not render a final empty
 * line box, and Shiki emits no `.line` span for one either, so counting the raw
 * `split('\n')` would hang a number in the gutter beside nothing — the gutter
 * and the code would disagree from the last line down, which is the one defect
 * a numbered snippet cannot tolerate. Exactly ONE trailing newline is dropped:
 * a deliberate blank last line, written `'a\n\n'`, keeps its number.
 */

/**
 * The gutter numbers for a block's content — `[1, 2, 3]` for three lines.
 *
 * Empty when there is no literal string content to number. A children-based
 * `code` block has no string to split, and a gutter
 * guessed at from rendered children would number the wrong things; drawing none
 * is the honest answer and the renderer omits the column entirely.
 */
export const codeLineNumbers = (content: string | undefined): readonly number[] => {
  if (typeof content !== 'string' || content.length === 0) return []
  const lines = content.replace(/\n$/, '').split('\n')
  return lines.map((_line, index) => index + 1)
}
