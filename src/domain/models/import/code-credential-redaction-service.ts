/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Credentials removed from the source code a converted code step keeps.
 *
 * A code step (an n8n Code node, a Make code module, a Retool JS or Python
 * block) becomes a stub that quotes its original code as comments, in a config
 * that is usually committed. People paste secrets into that code, so the quote
 * goes through {@link redactSourceCode} first. Only the inside of a string
 * literal is ever rewritten; the code around it and every comment stay byte for
 * byte as the source wrote them.
 *
 * - **By name.** A string assigned to, or passed after, a name that says it is a
 *   credential ({@link isCredentialName}: `apiKey`, `api_key`, `token`,
 *   `password`, `Authorization`) is replaced whole.
 * - **By shape.** Inside any string: the credential half of `Bearer …` and
 *   `Basic …`, the user part of a URL and a secret query value, and every row of
 *   {@link CODE_TOKEN_SHAPES}, from known key prefixes to long high-entropy
 *   strings. A new shape is a row.
 */

import { SECRET_QUERY_KEYS } from './capability-url-service'
import { isCredentialName, REDACTED } from './credential-redaction-service'

/** The code with its credentials removed, and the count of values it lost. */
export interface RedactedCode {
  readonly code: string
  readonly removed: number
}

/** The language a code step is written in, as the canonical model names it. */
export type CodeLanguage = 'javascript' | 'typescript' | 'python' | 'other'

/** One credential shape found inside a string: the part kept, and the part removed. */
export interface CodeTokenShape {
  readonly name: string
  /** Global; the named group `secret` is removed, the group `keep` before it stays. */
  readonly pattern: RegExp
  /** Whether a match really is a credential; absent, every match is. */
  readonly accepts?: (groups: Readonly<Record<string, string | undefined>>) => boolean
}

/** Not part of a token on either side: a token must stand on its own. */
const EDGE_BEFORE = '(?<![A-Za-z0-9_-])'
const EDGE_AFTER = '(?![A-Za-z0-9_-])'

/** Key prefixes that only a credential carries. */
const KEY_PREFIXES: readonly { readonly name: string; readonly source: string }[] = [
  { name: 'an OpenAI or Anthropic secret key', source: 'sk-[A-Za-z0-9_-]{16,}' },
  { name: 'a Stripe key', source: '(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}' },
  { name: 'a Slack token', source: 'xox[bpas]-[A-Za-z0-9-]{10,}' },
  { name: 'a GitHub token', source: 'gh[pousr]_[A-Za-z0-9]{20,}' },
  { name: 'a GitHub fine-grained token', source: 'github_pat_[A-Za-z0-9_]{20,}' },
  { name: 'an AWS access key id', source: 'AKIA[0-9A-Z]{16}' },
  { name: 'a Google API key', source: 'AIza[0-9A-Za-z_-]{35}' },
]

/** Shannon entropy of a string, in bits per character. */
const entropyOf = (text: string): number => {
  const counts = [...text].reduce<Readonly<Record<string, number>>>(
    (seen, char) => ({ ...seen, [char]: (seen[char] ?? 0) + 1 }),
    {}
  )
  return Object.values(counts).reduce((sum, count) => {
    const share = count / text.length
    return sum - share * Math.log2(share)
  }, 0)
}

/** The class of a letter or digit: upper, lower or digit; anything else is skipped. */
const classOf = (char: string): string =>
  /[A-Z]/.test(char) ? 'U' : /[a-z]/.test(char) ? 'L' : /[0-9]/.test(char) ? 'D' : ''

/**
 * How often two neighbouring letters or digits change class (upper, lower,
 * digit). A random key changes about every other character; an identifier
 * (`getUserProfileByIdV2`) or a path changes only at word boundaries.
 */
const classChangeRate = (text: string): number => {
  const classes = [...text].map(classOf).filter((one) => one !== '')
  if (classes.length < 2) return 0
  const changes = classes.slice(1).filter((one, index) => one !== classes[index]).length
  return changes / (classes.length - 1)
}

/** A long hex run with letters and digits mixed like a random key. */
const isRandomHex = (secret: string): boolean =>
  /[0-9]/.test(secret) &&
  /[a-f]/i.test(secret) &&
  entropyOf(secret) >= 3 &&
  classChangeRate(secret) >= 0.25

/**
 * The share of vowels among the letters. Random letters hold about one in five;
 * words, and so identifiers and paths built from words, hold one in three or more.
 */
const vowelShare = (text: string): number => {
  const letters = text.replace(/[^A-Za-z]/g, '')
  return letters === '' ? 0 : letters.replace(/[^aeiouAEIOU]/g, '').length / letters.length
}

/** A long base64 run mixing upper, lower and digits the way a random key does, not words. */
const isRandomBase64 = (secret: string): boolean =>
  /[A-Z]/.test(secret) &&
  /[a-z]/.test(secret) &&
  /[0-9]/.test(secret) &&
  entropyOf(secret) >= 3.5 &&
  classChangeRate(secret) >= 0.4 &&
  vowelShare(secret) <= 0.32

/** A value written by the code at run time (`${token}`, `{{ $json.key }}`, `%s`), not a literal. */
const isInterpolated = (secret: string): boolean => /^[$%{]/.test(secret)

/** Every shape of credential removed from inside a string, in the order they are tried. */
export const CODE_TOKEN_SHAPES: readonly CodeTokenShape[] = [
  {
    name: 'the user part of a URL',
    pattern: /(?<keep>\b[a-z][a-z0-9+.-]*:\/\/)(?<secret>[^\s/?#@'"`]+)(?=@)/gi,
  },
  {
    name: 'a secret query value in a URL',
    pattern: /(?<keep>[?&;](?<key>[A-Za-z0-9_.-]+)=)(?<secret>[^&#\s'"`]+)/g,
    accepts: ({ key = '', secret = '' }) =>
      (SECRET_QUERY_KEYS.has(key.toLowerCase()) || isCredentialName(key)) &&
      !isInterpolated(secret),
  },
  {
    name: 'a Bearer, Basic or Token credential',
    pattern: /(?<keep>\b(?:bearer|basic|token)\s+)(?<secret>[A-Za-z0-9\-._~+/]{8,}=*)/gi,
    accepts: ({ secret = '' }) => /[0-9]/.test(secret),
  },
  {
    name: 'a key with a known prefix',
    pattern: new RegExp(
      `${EDGE_BEFORE}(?<secret>${KEY_PREFIXES.map((row) => `(?:${row.source})`).join('|')})${EDGE_AFTER}`,
      'g'
    ),
  },
  {
    name: 'a JSON Web Token',
    pattern: new RegExp(
      `${EDGE_BEFORE}(?<secret>eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,})${EDGE_AFTER}`,
      'g'
    ),
  },
  {
    name: 'a long random hex string',
    pattern: /(?<![A-Za-z0-9+/_-])(?<secret>[0-9a-fA-F]{32,})(?![A-Za-z0-9+/_=-])/g,
    accepts: ({ secret = '' }) => isRandomHex(secret),
  },
  {
    name: 'a long random base64 string',
    pattern: /(?<![A-Za-z0-9+/_-])(?<secret>[A-Za-z0-9+/_-]{32,}={0,2})(?![A-Za-z0-9+/_=-])/g,
    accepts: ({ secret = '' }) => isRandomBase64(secret),
  },
]

type Groups = Readonly<Record<string, string | undefined>>

const acceptsMatch = (shape: CodeTokenShape, groups: Groups | undefined): boolean =>
  shape.accepts === undefined || shape.accepts(groups ?? {})

/** One shape removed from a text, and how many times. */
const removeShape = (held: RedactedCode, shape: CodeTokenShape): RedactedCode => {
  const hits = [...held.code.matchAll(shape.pattern)].filter((hit) =>
    acceptsMatch(shape, hit.groups)
  ).length
  if (hits === 0) return held
  const code = held.code.replace(shape.pattern, (match: string, ...rest: readonly unknown[]) => {
    const groups = rest.at(-1) as Groups | undefined
    return acceptsMatch(shape, groups) ? `${groups?.['keep'] ?? ''}${REDACTED}` : match
  })
  return { code, removed: held.removed + hits }
}

/** The inside of one string literal, every credential shape removed. */
export const redactStringContent = (content: string): RedactedCode =>
  CODE_TOKEN_SHAPES.reduce(removeShape, { code: content, removed: 0 })

/** A comment or a string literal, by language: a Python `#`, a JS `//` or `/* … *\/`. */
const LEXERS: Readonly<Record<CodeLanguage, RegExp>> = {
  python:
    /(?<comment>#[^\n]*)|(?<string>"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/g,
  javascript:
    /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<string>"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)/g,
  typescript:
    /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<string>"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)/g,
  other:
    /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|(?<string>"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)/g,
}

/**
 * The name a string literal is assigned to: `apiKey = `, `api_key: str = `,
 * `"Authorization": `, `headers['X-API-Key'] = `, `token := `, and a Python
 * prefixed string after one (`token = f"…"`). A comparison (`token === `) is
 * not an assignment.
 */
const ASSIGNED_TO =
  /(?:(?<ident>[A-Za-z_$][\w$]*)|(?<q>["'`])(?<quoted>[^"'`\n]{1,80})\k<q>)\s*\]?\s*(?::\s*[\w$.|[\]]{1,40}\s*)?(?::=|(?<![=!<>])=|:)\s*(?:[bfruBFRU]{1,2})?$/

/** The name a string literal is passed after: `setHeader('Authorization', …)`. */
const PASSED_AFTER = /(?<q>["'`])(?<quoted>[^"'`\n]{1,80})\k<q>\s*,\s*(?:[bfruBFRU]{1,2})?$/

/** How far back the name of a literal is looked for. */
const LOOKBACK = 160

/** The name that says what a string literal at `start` holds, if any. */
const nameBefore = (source: string, start: number): string | undefined => {
  const before = source.slice(Math.max(0, start - LOOKBACK), start)
  const assigned = ASSIGNED_TO.exec(before)?.groups
  const passed = PASSED_AFTER.exec(before)?.groups
  return assigned?.['ident'] ?? assigned?.['quoted'] ?? passed?.['quoted']
}

/** The quote that opens and closes a literal: `"""`, `'''`, or one character. */
const delimiterLength = (literal: string): number =>
  literal.startsWith('"""') || literal.startsWith("'''") ? 3 : 1

/** One string literal, its credentials removed. */
const redactLiteral = (source: string, literal: string, start: number): RedactedCode => {
  const quote = delimiterLength(literal)
  const open = literal.slice(0, quote)
  const content = literal.slice(quote, literal.length - quote)
  const name = nameBefore(source, start)
  const byName =
    name !== undefined &&
    isCredentialName(name) &&
    content.trim() !== '' &&
    content !== REDACTED &&
    !content.includes('${') &&
    !content.includes('{{')
  if (byName) return { code: `${open}${REDACTED}${open}`, removed: 1 }
  const inside = redactStringContent(content)
  return { code: `${open}${inside.code}${open}`, removed: inside.removed }
}

/**
 * The source of a code step with every credential its string literals hold
 * replaced by {@link REDACTED}, and the count of them. Code, comments and
 * every other string stay byte for byte as written.
 */
export const redactSourceCode = (source: string, language: CodeLanguage): RedactedCode => {
  const pieces = [...source.matchAll(LEXERS[language])].reduce<{
    readonly parts: readonly string[]
    readonly at: number
    readonly removed: number
  }>(
    (held, token) => {
      const literal = token.groups?.['string']
      const start = token.index
      const end = start + token[0].length
      const between = source.slice(held.at, start)
      if (literal === undefined) {
        return { parts: [...held.parts, between, token[0]], at: end, removed: held.removed }
      }
      const redacted = redactLiteral(source, literal, start)
      return {
        parts: [...held.parts, between, redacted.code],
        at: end,
        removed: held.removed + redacted.removed,
      }
    },
    { parts: [], at: 0, removed: 0 }
  )
  return { code: [...pieces.parts, source.slice(pieces.at)].join(''), removed: pieces.removed }
}
