/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The dos and don'ts of each catalogued component type, lifted from the
 * component manual the binary ships (the `*.docs.md` fragments beside the
 * component schemas).
 *
 * ─── LIFTED, NEVER WRITTEN ─────────────────────────────────────────────────
 *
 * Nothing here is composed. Every line is one sentence of the published
 * manual, copied whole, so the kit's component READMEs can never say
 * something the manual does not. A sentence is taken only when its own form
 * says what it is:
 *
 * - `usage` — the first sentence that opens with "Reach for it/`<type>`" or
 *   "Use it/`<type>` when": the manual's own statement of when to choose it;
 * - `do` — a sentence opening with a guidance verb ("Use", "Prefer",
 *   "Reach for", "Give", "Keep", "Pair", "Choose");
 * - `dont` — a sentence opening with "Never", "Do not", "Don't" or "Avoid",
 *   or one saying what the configuration REFUSES, which is the misuse the
 *   engine itself rejects. A migration note ("is no longer", "renamed", an
 *   alias) is history, not guidance, and is left out.
 *
 * A type the manual says none of this about gets empty guidance: an empty
 * list is honest, a generic sentence is not.
 *
 * ─── WHICH PART OF THE MANUAL IS A TYPE'S ──────────────────────────────────
 *
 * A fragment documents one type when it is named after the directory of that
 * type (`data/kanban/kanban.docs.md`), and a group of types otherwise, one
 * section each under a heading that names only types (`## \`tabs\``,
 * `## \`toggle\` and \`toggle-group\``). Code fences, tables, lists, quotes and
 * directives are not prose and are skipped.
 */

/** One manual fragment, by its repository-relative path. */
export interface ComponentDocFragment {
  readonly path: string
  readonly text: string
}

/** What the manual says about one type. */
export interface KitTypeGuidance {
  readonly usage?: string
  readonly do: readonly string[]
  readonly dont: readonly string[]
}

/** The guidance of a type the manual says nothing about. */
export const NO_KIT_GUIDANCE: KitTypeGuidance = { do: [], dont: [] }

/** A sentence longer than this is an explanation, not a rule a card can carry. */
const MAX_SENTENCE_LENGTH = 320

const USAGE_OPENING = /^(?:Reach for (?:it|`[a-z0-9-]+`)|Use (?:it|`[a-z0-9-]+`) when)\b/
const DO_OPENING = /^(?:Use|Prefer|Reach for|Give|Keep|Pair|Choose)\b/
const DONT_OPENING = /^(?:Never|Do not|Don't|Avoid)\b/
const REFUSAL = /\b(?:is|are) refused\b/
const MIGRATION_NOTE = /no longer|is now|\balias\b|renamed|used to|retired/i

/** A heading naming only types, and the level it opens. */
interface TypeHeading {
  readonly line: number
  readonly level: number
  readonly types: readonly string[]
}

const headingOf = (
  text: string,
  line: number,
  catalogued: ReadonlySet<string>
): TypeHeading | undefined => {
  const match = /^(#{2,3}) (.+)$/.exec(text)
  if (match === null) return undefined
  const title = match[2] ?? ''
  const named = [...title.matchAll(/`([a-z0-9-]+)`/g)].map((found) => found[1] ?? '')
  const onlyTypes = title.replaceAll(/`[a-z0-9-]+`|,|\band\b|\s/g, '') === ''
  const types = named.filter((type) => catalogued.has(type))
  return onlyTypes && types.length > 0 && types.length === named.length
    ? { line, level: (match[1] ?? '').length, types }
    : undefined
}

/** The lines of one section: from its heading to the next heading at its level or above. */
const sectionBody = (lines: readonly string[], heading: TypeHeading): string => {
  const closing = new RegExp(`^#{1,${heading.level}} `)
  const end = lines.findIndex((text, index) => index > heading.line && closing.test(text))
  return lines.slice(heading.line + 1, end < 0 ? undefined : end).join('\n')
}

/** The type a fragment is wholly about, when it is named after its directory. */
const wholeFragmentType = (path: string, catalogued: ReadonlySet<string>): string | undefined => {
  const segments = path.split('/')
  const directory = segments.at(-2)
  return directory !== undefined &&
    catalogued.has(directory) &&
    segments.at(-1) === `${directory}.docs.md`
    ? directory
    : undefined
}

/** Every (type, section) pair one fragment contributes. */
const sectionsOf = (
  fragment: ComponentDocFragment,
  catalogued: ReadonlySet<string>
): ReadonlyArray<readonly [string, string]> => {
  const lines = fragment.text.split('\n')
  const headed = lines
    .map((text, line) => headingOf(text, line, catalogued))
    .filter((heading): heading is TypeHeading => heading !== undefined)
    .flatMap((heading) => {
      const body = sectionBody(lines, heading)
      return heading.types.map((type) => [type, body] as const)
    })
  const whole = wholeFragmentType(fragment.path, catalogued)
  return whole === undefined ? headed : [...headed, [whole, fragment.text] as const]
}

const NOT_PROSE = /^(?:<!--|\||#|- |\* |> |\d+\. )/

/** The prose paragraphs of a section, each on one line; fenced code is skipped. */
const proseParagraphs = (body: string): readonly string[] =>
  body
    .replaceAll(/^```[\s\S]*?^```/gm, '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0 && !NOT_PROSE.test(paragraph))
    .map((paragraph) => paragraph.replaceAll(/\s*\n\s*/g, ' '))

/** A paragraph cut into sentences: a terminator, then a space, then a capital or markup. */
const sentencesOf = (paragraph: string): readonly string[] =>
  paragraph.split(/(?<=[.!?])\s+(?=[A-Z`*_"])/)

const isDont = (sentence: string): boolean =>
  (DONT_OPENING.test(sentence) || REFUSAL.test(sentence)) && !MIGRATION_NOTE.test(sentence)

/** The guidance one type's sections give, in manual order, each sentence once. */
const guidanceOfSections = (sections: readonly string[]): KitTypeGuidance => {
  const sentences = [
    ...new Set(
      sections
        .flatMap(proseParagraphs)
        .flatMap(sentencesOf)
        .filter((sentence) => sentence.length <= MAX_SENTENCE_LENGTH)
    ),
  ]
  const usage = sentences.find((sentence) => USAGE_OPENING.test(sentence))
  return {
    ...(usage === undefined ? {} : { usage }),
    do: sentences.filter((sentence) => sentence !== usage && DO_OPENING.test(sentence)),
    dont: sentences.filter(isDont),
  }
}

/**
 * The guidance of every catalogued type the manual speaks about, by type.
 *
 * @param fragments - the component manual's fragments.
 * @param catalogued - the catalogued type names; any other name is ignored.
 */
export const kitGuidanceFromManual = (
  fragments: readonly ComponentDocFragment[],
  catalogued: ReadonlySet<string>
): ReadonlyMap<string, KitTypeGuidance> => {
  const pairs = fragments.flatMap((fragment) => sectionsOf(fragment, catalogued))
  const types = [...new Set(pairs.map(([type]) => type))]
  return new Map(
    types.map((type) => [
      type,
      guidanceOfSections(pairs.filter(([owner]) => owner === type).map(([, body]) => body)),
    ])
  )
}
