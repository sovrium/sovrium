/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MarkdownIt } from 'markdown-it'

/**
 * Rule 7: text glued after a NESTED balanced `)` stays outside the link.
 *
 * linkify-it 6 reads `a_(b_(c))` as one pair and keeps its last `)` — the
 * upstream fix — but then carries on into whatever is glued to that `)`, so
 * `…(c))[docs](/docs)`, `…(c))and` and `…(c)),https://y.com` each became ONE
 * link swallowing the markdown link, the word or the next URL. linkify-it 5
 * never got there: it ended the link before the last `)` of a nested pair.
 *
 * The rule: after a balanced pair that itself contains a pair, the path goes
 * on only with a URL delimiter — `/ ? # & = ; : % ~ _ + * ! @ . -`. A letter,
 * a digit, `[`, `(`, `,` or a quote glued there stays outside, so
 * `…(c))and` links up to `)` and leaves `and` as text, while `…(c))/d`,
 * `…(c))?q=1`, `…(c))#f` and `…(c))&b=2` stay whole.
 *
 * A SINGLE pair is deliberately left alone: `…/a_(b)and` and
 * `…/a_(b)[docs](/docs)` link whole, exactly as both linkify-it 5 and 6 do.
 *
 * How the guard knows the pair was nested: `(` and `)` are path terminators
 * (rule 3), so a path can only end in `)` by closing a pair. Scanning back
 * from that `)` over non-`(` characters meets another `)` before any `(`
 * exactly when the pair held an inner pair — `(b_(c))`, `(a(b)c)` — and
 * never for `(b)` or `(a)(b)`.
 */
const NESTED_PAIR_GUARD = '(?!(?<=\\)[^(]*\\))[^/?#&=;:%~_+*!@.\\-])'
const PATH_HEAD = '(?:[/?#](?:'
const PATH_TAIL = /\)(\{1,\d+\})\|\\\/\)\?$/

/**
 * Split linkify-it's own path fragment, `(?:[/?#](?:A|B|…){1,max}|\/)?`, into
 * its alternation `A|B|…` and its `{1,max}` quantifier, so rule 7 can put
 * {@link NESTED_PAIR_GUARD} in front of every iteration. It wraps the upstream
 * fragment rather than a copy, and throws if that fragment changes shape, so
 * an upgrade cannot drop rule 7 silently.
 */
const splitPath = (path: string): readonly [alternatives: string, quantifier: string] => {
  const tail = PATH_TAIL.exec(path)
  if (!path.startsWith(PATH_HEAD) || tail === null) {
    throw new Error('linkify-it path fragment changed shape; re-check pinLinkifyBehaviour rule 7')
  }
  return [path.slice(PATH_HEAD.length, tail.index), tail[1] ?? '']
}

/**
 * Pin the autolinking the markdown renderer shipped with under markdown-it 14
 * (linkify-it 5).
 *
 * markdown-it 15 moved to linkify-it 6, which changed what a bare piece of
 * text autolinks to. Every authored page relied on the old reading, so each
 * change is undone here:
 *
 *  1. Schemaless links (`example.com`, `www.example.com`) no longer
 *     autolinked — `fuzzyLink` defaulted to `false`.
 *  2. The `user:pass@` part of a URL was no longer read, so
 *     `http://user:pw@example.com` linked only `http://user` — `urlAuth`.
 *  3. Any Unicode punctuation ended a URL path, so `https://example.com/«x»`
 *     lost its `«x»`. linkify-it 5 ended a path only on whitespace, controls,
 *     the `<` `>` `｜` separators and a closed set of ASCII punctuation.
 *  4. A schemaless host lost its `:port` — the host was built without one,
 *     and the host terminator then refused `:8080`, dropping the whole link.
 *  5. Schemaless emails switched to the RFC 5322 local-part characters and
 *     to ANY trailing label as host: `'foo@bar.com` linked with its quote,
 *     `foo@bar.c` linked, and `連絡はfoo@bar.comまで` got a mangled
 *     `mailto:foo@bar.xn--com-…` href. linkify-it 5 required a known TLD.
 *  6. markdown-it 15 gates each paragraph on the EXACT `test()`, which reads
 *     the paragraph with its markup, so `_foo@bar.com_` or
 *     `_www.example.com_` — whose link only exists once the emphasis is
 *     parsed off — lost their link. markdown-it 14 gated on linkify-it 5's
 *     loose `pretest` (a known scheme, a host-looking fragment, or any `@`).
 *
 * `fuzzyEmail` and `fuzzyIP` kept their values (`true` / `false`); they are
 * named anyway so a future default flip cannot change rendering silently.
 *
 * Mechanics. 1–2 are options. 3–5 swap fragments of linkify-it's `re`
 * builder, the documented regex extension point its options do not reach;
 * 7 wraps its path fragment ({@link splitPath}); `set()` runs after
 * them so the builder's regex cache is rebuilt from the restored fragments.
 * 6 makes `test()` the old pretest. The same `test()` also gates each text
 * node, where linkify-it 5's own `test()` required the
 * same fragments, but a pretest hit may find no link, so `match()` returns
 * `[]` instead of `null` — markdown-it 15 reads `links.length` unguarded, and
 * an empty match re-emits the text node unchanged. `match()` also drops
 * schemaless links from text the host fragment rejects, because linkify-it 5's
 * own `match()` never looked for them there.
 *
 * What is NOT restored, because upstream fixed a defect: IPv6 hosts now
 * autolink, an IPv6 literal keeps its brackets in an href, balanced nested
 * parentheses in a path are read as a pair, and a code span made only of
 * spaces keeps them.
 *
 * One rule is added on top of both versions: 7. text glued after a NESTED
 * balanced `)` stays outside the link — see {@link NESTED_PAIR_GUARD}.
 */
export const pinLinkifyBehaviour = (md: MarkdownIt): void => {
  const { linkify } = md
  const { re } = linkify
  const exactMatch = linkify.match.bind(linkify)

  const hostFragment = new RegExp(
    `localhost|www\\.|\\.\\d{1,3}\\.|\\.(?:${re.get_tld().source})(?:${re.src_ZPCc}|>|$)`,
    'i'
  )

  re.get_path_terminator = () =>
    new RegExp(`${re.src_ZCc}|${re.get_text_separators().source}|[()[\\]{}.,"'?!\\-;]`)
  re.get_fuzzy_url_host_port = () =>
    new RegExp(
      `(?:${re.opts.fuzzyIP === true ? `${re.get_ipv4_addr().source}|` : ''}` +
        `(?:(?:(?:${re.get_domain().source})\\.){1,10}(?:${re.get_tld().source})))` +
        `${re.get_port().source}${re.get_host_terminator().source}`
    )
  re.get_mail_name = () => /[-;:&=+$,.\w][-;:&=+$,".\w]{0,63}/
  re.get_fuzzy_mail_host = () =>
    new RegExp(
      `(?:${re.get_ipv4_addr().source}|` +
        `(?:(?:(?:${re.get_domain().source})\\.){1,10}(?:${re.get_tld().source})))` +
        re.get_host_terminator().source
    )
  const upstreamPath = re.get_path.bind(re)
  re.get_path = () => {
    const [alternatives, quantifier] = splitPath(upstreamPath().source)
    return new RegExp(`(?:[/?#](?:${NESTED_PAIR_GUARD}(?:${alternatives}))${quantifier}|\\/)?`)
  }
  linkify.set({ fuzzyLink: true, fuzzyEmail: true, fuzzyIP: false, urlAuth: true })

  const pretest = new RegExp(`${re.get_schema_search().source}|${hostFragment.source}|@`, 'i')
  linkify.test = (text) => pretest.test(text)
  linkify.match = (text) => {
    const links = exactMatch(text) ?? []
    return hostFragment.test(text) ? links : links.filter((link) => link.schema !== '')
  }
}
