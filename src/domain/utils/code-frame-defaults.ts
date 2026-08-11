/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Default code-block chrome derived from a block's language, plus the fence
 * info-string parser that lets an author override it.
 *
 * ## Why a default at all
 *
 * Every code block on the site wears a header naming what it is. A reader
 * scrolling a page of snippets should not see some blocks wearing a header bar
 * and others floating bare, and a block with no header has nowhere to put the
 * copy button. The overwhelming majority of blocks — 1000+ docs fences — carry
 * no hand-written filename, so the header has to be derived mechanically or the
 * docs read half-migrated.
 *
 * A derived name is also the more useful one: a config snippet with no header
 * tells the reader WHAT to write but never WHERE, and the language tag is
 * exactly the fact that answers it (`yaml` ⇒ `app.yaml`). Shell languages are
 * the exception — a `bash` block is a session to run, not a file to save, so it
 * resolves to a terminal marker rather than to `app.sh`.
 *
 * ## This module is the single source of truth
 *
 * Both surfaces consume it: the config `code` component renderer and the docs
 * markdown fence splice. Deriving the default in only one of them is how the two
 * drifted apart in the first place.
 */

/** Chrome drawn around a block. Mirrors the schema's `CodeFrameSchema`. */
export type CodeFrameKind = 'file' | 'terminal'

/** The chrome a block gets when the author named neither a file nor a frame. */
export interface DefaultCodeFrame {
  /** `'file'` ⇒ the label names a file; `'terminal'` ⇒ it marks a shell session. */
  readonly frame: CodeFrameKind
  /** Header text: a filename, or the terminal marker's label. Never empty. */
  readonly label: string
}

/** A fence info string split into its language tag and its recognised meta. */
export interface FenceInfo {
  /** First whitespace-delimited word, lowercased (`''` for a tagless fence). */
  readonly lang: string
  /** Everything after the language tag, verbatim. */
  readonly meta: string
  /** `title=` / `filename=` from the meta, when the author wrote one. */
  readonly title?: string
}

/**
 * Header text for a block a reader is meant to RUN rather than save. The
 * renderer prefixes its own `>_` marker, so this is the bare noun.
 */
const TERMINAL_LABEL = 'terminal'

/**
 * Fallback filename for a fence whose language carries no conventional entry
 * point — and for a tagless fence, which has no language at all. A blank header
 * bar reads as a rendering bug, so this must never be empty.
 */
const FALLBACK_FILENAME = 'code'

/**
 * Languages that describe a shell SESSION. A header reading `app.sh` would tell
 * the reader to save a file they are meant to paste into a prompt.
 */
const TERMINAL_LANGUAGES: ReadonlySet<string> = new Set([
  'bash',
  'sh',
  'shell',
  'shell-session',
  'shellsession',
  'console',
  'zsh',
  'fish',
  'powershell',
  'ps1',
  'terminal',
])

/**
 * Language tag ⇒ the file a reader is meant to paste the snippet into. The names
 * are Sovrium's own conventional entry points where one exists (`app.yaml`,
 * `app.ts`) so the header doubles as an instruction, and the ecosystem's
 * conventional name otherwise (`Dockerfile`, `.env`).
 */
const FILENAME_BY_LANGUAGE: ReadonlyMap<string, string> = new Map([
  ['yaml', 'app.yaml'],
  ['yml', 'app.yaml'],
  ['json', 'app.json'],
  ['jsonc', 'app.json'],
  ['ts', 'app.ts'],
  ['typescript', 'app.ts'],
  ['tsx', 'app.tsx'],
  ['js', 'app.js'],
  ['javascript', 'app.js'],
  ['mjs', 'app.js'],
  ['cjs', 'app.js'],
  ['jsx', 'app.jsx'],
  ['html', 'index.html'],
  ['css', 'styles.css'],
  ['scss', 'styles.scss'],
  ['md', 'README.md'],
  ['markdown', 'README.md'],
  ['mdx', 'README.mdx'],
  ['sql', 'query.sql'],
  ['py', 'main.py'],
  ['python', 'main.py'],
  ['toml', 'config.toml'],
  ['ini', 'config.ini'],
  ['env', '.env'],
  ['dotenv', '.env'],
  ['docker', 'Dockerfile'],
  ['dockerfile', 'Dockerfile'],
  ['xml', 'data.xml'],
  ['svg', 'icon.svg'],
  ['go', 'main.go'],
  ['rs', 'main.rs'],
  ['rust', 'main.rs'],
  ['java', 'Main.java'],
  ['php', 'index.php'],
  ['rb', 'main.rb'],
  ['ruby', 'main.rb'],
  ['diff', 'changes.diff'],
  ['patch', 'changes.diff'],
  ['http', 'request.http'],
  ['graphql', 'query.graphql'],
])

/**
 * Resolve the chrome a block gets when its author named neither a file nor an
 * explicit frame. Shell languages become a terminal marker; every other
 * language becomes a filename, falling back to a generic one rather than to
 * nothing.
 */
export const resolveDefaultCodeFrame = (language: string | undefined): DefaultCodeFrame => {
  const lang = (language ?? '').trim().toLowerCase()
  if (TERMINAL_LANGUAGES.has(lang)) return { frame: 'terminal', label: TERMINAL_LABEL }
  return { frame: 'file', label: FILENAME_BY_LANGUAGE.get(lang) ?? FALLBACK_FILENAME }
}

/**
 * Pull a `title=` / `filename=` value out of a fence's meta, tolerating single
 * quotes, double quotes, or no quotes at all. Returns `undefined` when the
 * author wrote neither.
 */
const TITLE_RE = /\b(?:title|filename)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i

const readFenceTitle = (meta: string): string | undefined => {
  const match = TITLE_RE.exec(meta)
  if (match === null) return undefined
  const value = match[1] ?? match[2] ?? match[3] ?? ''
  return value.length > 0 ? value : undefined
}

/**
 * Split a markdown fence's info string into its language tag and its meta.
 *
 * markdown-it hands the whole info string through verbatim (` ```yaml
 * title=partial.yaml `), and until this parser existed everything past the first
 * word was discarded at the renderer — so `title=` could never reach the header
 * that needed it. A YAML *fragment* headed `app.yaml` over-claims: pasting it
 * wholesale replaces the reader's config instead of extending it, and `title=`
 * is how an author says so.
 */
export const parseFenceInfo = (info: string): FenceInfo => {
  const trimmed = info.trim()
  const firstSpace = trimmed.search(/\s/)
  const lang = (firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)).toLowerCase()
  const meta = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim()
  const title = readFenceTitle(meta)
  return { lang, meta, ...(title === undefined ? {} : { title }) }
}
