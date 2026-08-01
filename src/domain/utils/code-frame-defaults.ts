/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type CodeFrameKind = 'file' | 'terminal'

export interface DefaultCodeFrame {
  readonly frame: CodeFrameKind
  readonly label: string
}

export interface FenceInfo {
  readonly lang: string
  readonly meta: string
  readonly title?: string
}

const TERMINAL_LABEL = 'terminal'

const FALLBACK_FILENAME = 'code'

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

export const resolveDefaultCodeFrame = (language: string | undefined): DefaultCodeFrame => {
  const lang = (language ?? '').trim().toLowerCase()
  if (TERMINAL_LANGUAGES.has(lang)) return { frame: 'terminal', label: TERMINAL_LABEL }
  return { frame: 'file', label: FILENAME_BY_LANGUAGE.get(lang) ?? FALLBACK_FILENAME }
}

const TITLE_RE = /\b(?:title|filename)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i

const readFenceTitle = (meta: string): string | undefined => {
  const match = TITLE_RE.exec(meta)
  if (match === null) return undefined
  const value = match[1] ?? match[2] ?? match[3] ?? ''
  return value.length > 0 ? value : undefined
}

export const parseFenceInfo = (info: string): FenceInfo => {
  const trimmed = info.trim()
  const firstSpace = trimmed.search(/\s/)
  const lang = (firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)).toLowerCase()
  const meta = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim()
  const title = readFenceTitle(meta)
  return { lang, meta, ...(title === undefined ? {} : { title }) }
}
