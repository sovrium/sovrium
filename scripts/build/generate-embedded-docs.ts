/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codegen: ship the in-binary manual inside the compiled binary.
 *
 * Two generated modules, because they answer two questions and rot on two
 * different triggers:
 *
 * 1. `embedded-docs.generated.ts` — every `*.docs.md` fragment and every
 *    `src/docs/**` article, imported `with { type: 'file' }`. Bun embeds the
 *    bytes and hands back a path: the real one in dev, a `$bunfs/...` one in the
 *    binary, and `Bun.file()` reads either. It rots when a fragment is added,
 *    moved or deleted.
 * 2. `embedded-docs-behaviour.generated.ts` — per article, the user stories it
 *    cites and their ✅ acceptance criteria. It rots when an AC CELL is edited,
 *    which is the whole point: `Generated Assets Drift` then fails until the
 *    payload is regenerated, so the manual's Behaviour block cannot describe a
 *    criterion the product contract no longer states.
 *
 * ## Why the prose is not inlined
 *
 * A `with { type: 'file' }` import costs the file's bytes and nothing else. The
 * alternative — emitting the markdown as string literals — would put the whole
 * corpus into a `.ts` file, and `scripts/build/generate-css-assets.ts` harvests
 * Tailwind candidates out of `src/**` *.ts* including comment prose. Inlined
 * documentation would add several thousand false candidates to the CSS corpus
 * and move `generated-css-assets.ts` on every docs edit. The same reasoning is
 * why this file emits NO prose into its own comments.
 *
 * ## What "✅" means, and what it does not
 *
 * A ✅ row means the spec is AUTHORED and is not `test.fixme()`. `bun run
 * progress` never runs Playwright, so "passing" remains what the CI E2E run
 * asserts ([internal ref] D9). `fixme` rows are omitted from the payload entirely —
 * the manual must not describe behaviour whose spec is a placeholder — and
 * counted in this script's own output so the omission is visible.
 *
 * Regenerate after adding a fragment or editing an acceptance criterion:
 *   bun run build:docs
 * (also run automatically by `build:binary`.)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { SECTIONS } from '@/docs/sections'
import { printFailure } from '@/infrastructure/logging/cli-output'
import { REPO_ROOT, walkSync } from '../lib/drift/walk'
import { parseUserStorySections, type AcceptanceCriterionRow } from '../lib/user-story-criteria'

const ASSETS_DIR = join(REPO_ROOT, 'src', 'infrastructure', 'assets')
const DOCS_OUT = join(ASSETS_DIR, 'embedded-docs.generated.ts')
const BEHAVIOUR_OUT = join(ASSETS_DIR, 'embedded-docs-behaviour.generated.ts')

/** Import paths in the generated files are relative to `src/infrastructure/assets/`. */
const REL_ROOT = '../../..'

/**
 * The user-story roots the Behaviour blocks are drawn from.
 *
 * `business-apps/` is deliberately absent: those stories describe Sovrium's own
 * apps — the website, the partner app — not the platform the binary ships, so
 * they are out of the coverage denominator and out of the manual.
 */
export const STORY_ROOTS: readonly string[] = [
  'docs/user-stories/as-developer',
  'docs/user-stories/as-end-user',
  'docs/user-stories/as-business-admin',
]

// ---------------------------------------------------------------------------
// 1. The fragments
// ---------------------------------------------------------------------------

/**
 * Every documentation file the binary ships, sorted by repo-relative path.
 *
 * Two shapes, by [internal ref]'s placement rule: `*.docs.md` co-located with the code
 * it documents, anywhere under `src/`, and the cross-cutting articles under
 * `src/docs/`. Sorted so the generated module is a function of the tree and not
 * of the order a directory walk happened to return.
 *
 * Exported and root-parameterized so the collection is testable against a
 * synthetic tree without writing the committed manifest.
 */
export const collectDocFiles = (root: string): readonly string[] => {
  const fragments = walkSync({ root: join(root, 'src'), extensions: ['.md'] })
  return fragments
    .map((absolute) => relative(root, absolute).split(sep).join('/'))
    .filter((path) => path.endsWith('.docs.md') || path.startsWith('src/docs/'))
    .toSorted((a, b) => a.localeCompare(b))
}

// ---------------------------------------------------------------------------
// 2. The behaviour payload
// ---------------------------------------------------------------------------

/** One story as the manual renders it: a heading and its ✅ criteria. */
export interface BehaviourStory {
  readonly id: string
  readonly title: string
  readonly criteria: readonly string[]
}

/** One article's Behaviour block, before it is serialized. */
export interface BehaviourArticle {
  readonly slug: string
  readonly stories: readonly BehaviourStory[]
}

/** What one generation run measured, for the console line. */
export interface BehaviourCensus {
  readonly articles: number
  readonly storiesCited: number
  readonly storiesResolved: number
  readonly criteria: number
  readonly fixmeOmitted: number
  /** `stories:` ids naming no `## US-` heading. Reported, never guessed at. */
  readonly unresolved: readonly string[]
}

/**
 * Every `## US-` section under {@link STORY_ROOTS}, keyed by id.
 *
 * A duplicate id is a defect in the corpus rather than in this reader — the
 * coverage analysis errors on it — so the FIRST occurrence wins here and the
 * generator does not arbitrate.
 */
export const readStoryIndex = (
  root: string
): ReadonlyMap<
  string,
  { readonly title: string; readonly criteria: readonly AcceptanceCriterionRow[] }
> =>
  new Map(
    STORY_ROOTS.flatMap((storyRoot) =>
      walkSync({ root: join(root, storyRoot), extensions: ['.md'] }).flatMap((absolute) =>
        parseUserStorySections(readFileSync(absolute, 'utf8')).map(
          (section) => [section.id, { title: section.title, criteria: section.criteria }] as const
        )
      )
    ).toReversed()
  )

/** The Behaviour payload for every registered article, canonically sorted. */
export const buildBehaviour = (
  root: string
): { readonly articles: readonly BehaviourArticle[]; readonly census: BehaviourCensus } => {
  const index = readStoryIndex(root)

  const articles = SECTIONS.flatMap((section) => section.articles)
    .map((article) => ({
      slug: article.slug,
      stories: [...article.stories].toSorted().flatMap((id): readonly BehaviourStory[] => {
        const story = index.get(id)
        return story === undefined
          ? []
          : [
              {
                id,
                title: story.title,
                criteria: story.criteria.filter((row) => row.complete).map((row) => row.criterion),
              },
            ]
      }),
    }))
    .toSorted((a, b) => a.slug.localeCompare(b.slug))

  // The census is derived from the SAME data the payload is, rather than
  // tallied while building it. A counter incremented inside the walk is a
  // second implementation of the same arithmetic, and the one that goes wrong
  // is always the one nobody reads — here it would understate the corpus while
  // the payload itself was correct, which reads as a shrinking manual.
  const cited = SECTIONS.flatMap((section) =>
    section.articles.flatMap((article) => [...article.stories])
  )
  const resolved = cited.flatMap((id) => {
    const story = index.get(id)
    return story === undefined ? [] : [story]
  })

  return {
    articles,
    census: {
      articles: articles.length,
      storiesCited: cited.length,
      storiesResolved: resolved.length,
      criteria: resolved.reduce(
        (total, story) => total + story.criteria.filter((row) => row.complete).length,
        0
      ),
      fixmeOmitted: resolved.reduce(
        (total, story) => total + story.criteria.filter((row) => !row.complete).length,
        0
      ),
      unresolved: [...new Set(cited.filter((id) => !index.has(id)))].toSorted(),
    },
  }
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const LICENSE = `/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */
`

const GENERATED_HEADER = (what: string): string =>
  `${LICENSE}
/* eslint-disable */
// @ts-nocheck
// AUTO-GENERATED by scripts/build/generate-embedded-docs.ts — DO NOT EDIT.
// ${what}
`

/** The fragment manifest module, as text. */
export const renderDocsModule = (paths: readonly string[]): string => {
  const imports = paths
    .map((path, index) => `import _d${index} from '${REL_ROOT}/${path}' with { type: 'file' }`)
    .join('\n')
  const entries = paths.map((path, index) => `  ${JSON.stringify(path)}: _d${index},`).join('\n')
  return `${GENERATED_HEADER(
    "Each `with { type: 'file' }` import embeds the file into the compiled binary\n" +
      '// and resolves to its on-disk path in dev/bundled mode.'
  )}
${imports}

export const EMBEDDED_DOCS = {
${entries}
}
`
}

/** The behaviour payload module, as text. */
export const renderBehaviourModule = (articles: readonly BehaviourArticle[]): string => {
  const entries = articles
    .map((article) => {
      const stories = article.stories
        .map(
          (story) =>
            `    {\n      id: ${JSON.stringify(story.id)},\n` +
            `      title: ${JSON.stringify(story.title)},\n` +
            `      criteria: [\n${story.criteria
              .map((criterion) => `        ${JSON.stringify(criterion)},`)
              .join('\n')}\n      ],\n    },`
        )
        .join('\n')
      return `  ${JSON.stringify(article.slug)}: [\n${stories}\n  ],`
    })
    .join('\n')
  return `${GENERATED_HEADER(
    'Per article: the user stories it cites and their authored, non-fixme\n' +
      '// acceptance criteria. Regenerated by `bun run build:docs`.'
  )}
export const EMBEDDED_DOCS_BEHAVIOUR = {
${entries}
}
`
}

if (import.meta.main) {
  const paths = collectDocFiles(REPO_ROOT)
  const { articles, census } = buildBehaviour(REPO_ROOT)

  writeFileSync(DOCS_OUT, renderDocsModule(paths))
  writeFileSync(BEHAVIOUR_OUT, renderBehaviourModule(articles))

  // The two counts are computed BEFORE the template literal, not inside it.
  // `CLI Voice Drift` reads the whole interpolation as operator-facing text, so
  // a `!` negation in there trips T35#1 — the rule is right that an operator
  // should never read an exclamation mark, and wrong only about this one being
  // one. Hoisting is cheaper than an exemption and reads better anyway.
  const crossCutting = paths.filter((path) => path.startsWith('src/docs/')).length
  const coLocated = paths.length - crossCutting
  console.log(
    `embedded-docs.generated.ts — ${paths.length} documentation file(s) ` +
      `(${crossCutting} cross-cutting, ${coLocated} co-located)`
  )
  console.log(
    `embedded-docs-behaviour.generated.ts — ${census.articles} article(s), ` +
      `${census.storiesResolved} of ${census.storiesCited} cited stor(y/ies) resolved, ` +
      `${census.criteria} criteri(on/a), ${census.fixmeOmitted} omitted as not-yet-authored` +
      (census.unresolved.length > 0
        ? `\n  UNRESOLVED stories: ${census.unresolved.join(', ')}`
        : '')
  )
  const unresolvedCount = census.unresolved.length
  if (unresolvedCount > 0) {
    printFailure({
      headline: `${unresolvedCount} cited user stor(y/ies) name no \`## US-\` heading, so the manual's Behaviour block would be silently short.`,
      detail: census.unresolved,
      guidance: `Correct the \`stories:\` entry in its section manifest, or add the story under one of ${STORY_ROOTS.join(', ')}.`,
    })
    process.exit(1)
  }
}
