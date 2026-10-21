/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { pageNodeIdSchema } from '@/domain/models/api/admin/design-system/page-design-tree'
import { MIGRATION_PAGE_SOURCES } from './migrated-page-mapping'

/**
 * The `pages` section of the `sovrium import` report: what the page migration
 * converter (`planMigratedPages`) did with the pages of a Webflow site export,
 * a Retool classic ToolScript ZIP or a Notion export.
 *
 * The migration report is ONE envelope shared by every part of a migrated app
 * (`format`, `version`, `source`, `written`, `unmapped`, `todo`), and each part
 * adds a section. This is the pages part's section: the envelope's `pages` key
 * holds it, and the converter returns it as its plan's `report`. Everything a
 * page migration hands the operator is here rather than in the envelope's own
 * arrays, because the converter reads the page export alone and returns this
 * section alone.
 *
 * ─── THE SECTION IS THE HAND-OFF ──────────────────────────────────────────
 *
 * A migrated page arrives structurally whole and wired to nothing. What the
 * operator still has to do is listed here, item by item:
 *
 * - `unbound`: every foreign expression a node carried, verbatim, with the
 *   node it sat on. None is translated into a Sovrium binding.
 * - `unmapped`: every component the source's mapping table does not hold,
 *   with where it sat. Nothing is drawn in its place.
 * - `offScale`: every layout value that is not a step of the app's spacing
 *   scale, with the nearest step. Nothing is rounded into the config.
 * - `literalTokens`: every piece of foreign text that reads like a page token
 *   (`$` then a letter or `_`). It is written escaped, so the page prints the
 *   characters and never resolves them: text from another tool never becomes
 *   a Sovrium binding or translation.
 * - `leftBehind`: what is data rather than page (a Notion inline database),
 *   for the data migration.
 * - `refused`: every page that could not be written as a new page, and why.
 *
 * `structure` holds the counts the migration is held to: node types, depth and
 * totals per page, never pixels. `templates.created` is `false` by contract: a
 * migration creates no template and no library block.
 */

const strict = { strictKeys: true, title: 'sovrium:strict-keys' } as const

const count = (description: string) =>
  Schema.Int.annotate({ description }).check(Schema.isGreaterThanOrEqualTo(0))

const pageName = Schema.String.annotate({
  description: 'The migrated page, by the `name` it is written under',
  examples: ['pricing', 'team-handbook'],
})

/** A page written as a new page entry. */
export const migratedPageCreatedSchema = Schema.Struct({
  name: pageName,
  path: Schema.String.annotate({
    description: 'The URL path the page is written at',
    examples: ['/pricing', '/handbook/onboarding'],
  }),
  file: Schema.String.annotate({
    description: 'The export entry it was read from, as the archive names it',
    examples: ['pricing.html', 'main.rsx'],
  }),
  nodes: count('The kit nodes written, each with a fresh `key`'),
}).annotate({ ...strict, identifier: 'MigratedPageCreated' })

/** A page that was not written, and why. */
export const migratedPageRefusedSchema = Schema.Struct({
  page: pageName,
  reason: Schema.Literals([
    'page-name-collision',
    'page-path-collision',
    'dangling-form-reference',
  ]).annotate({
    description:
      'The config already holds a page of that name, or at that path, or a form node names a form the migration did not emit',
  }),
  detail: Schema.String.annotate({ description: 'The finding, in a sentence' }),
}).annotate({ ...strict, identifier: 'MigratedPageRefused' })

/** A foreign component the source's mapping table does not hold. */
export const migratedPageUnmappedSchema = Schema.Struct({
  page: pageName,
  /** Where the component sat: the path id it would have had in the migrated page. */
  at: pageNodeIdSchema,
  component: Schema.String.annotate({
    description: 'The component as the source names it',
    examples: ['Chart', 'HtmlEmbed', 'bulleted_list_item'],
  }),
  reason: Schema.Literals(['not-in-table', 'required-value-missing']).annotate({
    description:
      'The mapping table has no row for it, or its kit type needs a value the source holds only through a binding',
  }),
  missing: Schema.optional(
    Schema.String.annotate({
      description: 'For `required-value-missing`: the kit key the source could not fill',
      examples: ['items', 'triggerLabel'],
    })
  ),
}).annotate({ ...strict, identifier: 'MigratedPageUnmapped' })

/** A layout value that is not a step of the app's scale. */
export const migratedPageOffScaleSchema = Schema.Struct({
  page: pageName,
  node: pageNodeIdSchema,
  property: Schema.Literals([
    'direction',
    'gap',
    'align',
    'justify',
    'padding',
    'width',
    'columns',
  ]).annotate({ description: 'The layout property the value was for' }),
  value: Schema.String.annotate({
    description: 'The value as the source wrote it',
    examples: ['13px', 'repeat(5, 120px)'],
  }),
  nearestToken: Schema.optional(
    Schema.String.annotate({
      description:
        'The nearest step of the app’s scale, by its dotted path, for the operator to choose',
      examples: ['spacing.3'],
    })
  ),
}).annotate({ ...strict, identifier: 'MigratedPageOffScale' })

/** A foreign binding a node carried, kept verbatim and never translated. */
export const migratedPageUnboundSchema = Schema.Struct({
  page: pageName,
  /** The migrated node the binding sat on. */
  node: pageNodeIdSchema,
  component: Schema.String.annotate({ description: 'The component as the source names it' }),
  expression: Schema.String.annotate({
    description: 'The binding exactly as the export holds it',
    examples: ['{{ getCustomers.data }}', 'Collection list: Blog Posts'],
  }),
}).annotate({ ...strict, identifier: 'MigratedPageUnbound' })

/** A form node and the extracted form it names. */
export const migratedPageFormSchema = Schema.Struct({
  page: pageName,
  node: pageNodeIdSchema,
  form: Schema.String.annotate({
    description:
      'The extracted form’s name: the node’s `formRef`, and the `forms[]` entry it joins',
    examples: ['contact', 'newsletter-signup'],
  }),
  sourceId: Schema.String.annotate({ description: 'The form’s identity in the export' }),
}).annotate({ ...strict, identifier: 'MigratedPageForm' })

/** Something on a page that is data, not page, kept for the data migration. */
/** A token-like run of foreign text, written escaped so it prints as itself. */
export const migratedPageLiteralTokenSchema = Schema.Struct({
  page: pageName,
  /** The migrated node whose text held it. */
  node: pageNodeIdSchema,
  token: Schema.String.annotate({
    description:
      'The token-like text exactly as the source wrote it, from its `$` to its last name character',
    examples: ['$app.name', '$currentUser.email', '$t:greeting'],
  }),
}).annotate({ ...strict, identifier: 'MigratedPageLiteralToken' })

export const migratedPageLeftBehindSchema = Schema.Struct({
  page: pageName,
  what: Schema.String.annotate({
    description: 'What the page held, as the source names it',
    examples: ['Inline database: Reading list'],
  }),
  file: Schema.optional(
    Schema.String.annotate({
      description: 'The export entry that holds its data, when there is one',
    })
  ),
}).annotate({ ...strict, identifier: 'MigratedPageLeftBehind' })

/** The structural counts a migrated page is held to. */
export const migratedPageStructureSchema = Schema.Struct({
  page: pageName,
  nodes: count('Every kit node of the page'),
  depth: count('The deepest nesting, the page’s top-level nodes counting 1'),
  types: Schema.Record(Schema.String, count('Nodes of this kit type')).annotate({
    description: 'Nodes per kit type',
  }),
}).annotate({ ...strict, identifier: 'MigratedPageStructure' })

/**
 * The `pages` section of the migration report.
 *
 * @public Returned by the page migration converter; the migration report's envelope narrows its `pages` key to it.
 */
export const migratedPagesReportSchema = Schema.Struct({
  status: Schema.Literal('converted').annotate({
    description: 'The page converter ran; a report written before it shipped says `pending`',
  }),
  source: Schema.Literals(MIGRATION_PAGE_SOURCES).annotate({
    description: 'The page source read',
  }),
  facts: Schema.String.annotate({
    description: 'The pinned format facts the export was read against',
    examples: ['webflow/2.2.2', 'retool/classic-2026-10-19', 'notion/2026-10-19'],
  }),
  created: Schema.Array(migratedPageCreatedSchema).annotate({
    description: 'The pages written as new entries, in export order',
  }),
  refused: Schema.Array(migratedPageRefusedSchema).annotate({
    description: 'The pages not written; under `--write` any refusal stops the whole write',
  }),
  unbound: Schema.Array(migratedPageUnboundSchema).annotate({
    description: 'Every foreign binding, verbatim, with its node',
  }),
  unmapped: Schema.Array(migratedPageUnmappedSchema).annotate({
    description: 'Every component the mapping table does not hold',
  }),
  offScale: Schema.Array(migratedPageOffScaleSchema).annotate({
    description: 'Every layout value off the spacing scale, never rounded',
  }),
  forms: Schema.Array(migratedPageFormSchema).annotate({
    description: 'Every form node and the extracted form it names',
  }),
  literalTokens: Schema.Array(migratedPageLiteralTokenSchema).annotate({
    description:
      'Every token-like run of foreign text, escaped so the page prints it and never resolves it',
  }),
  leftBehind: Schema.Array(migratedPageLeftBehindSchema).annotate({
    description: 'What the pages held that is data, kept for the data migration',
  }),
  structure: Schema.Array(migratedPageStructureSchema).annotate({
    description: 'The structural counts of each created page',
  }),
  templates: Schema.Struct({
    created: Schema.Literal(false).annotate({
      description: 'Always false: a migration creates no template and no library block',
    }),
  }).annotate({ ...strict }),
  tokens: Schema.optional(
    Schema.Struct({
      stylesheet: Schema.String.annotate({
        description: 'The export entry whose CSS custom properties hold the site’s tokens',
        examples: ['css/harbour-studio.webflow.css'],
      }),
      command: Schema.String.annotate({
        description: 'The command that converts them into the `design` key',
        examples: [
          'sovrium design-system import <folder>/css/harbour-studio.webflow.css --from css',
        ],
      }),
    }).annotate({
      ...strict,
      description:
        'Webflow only: where the site’s variables are, for the CSS token import; a migration never writes `design` itself',
    })
  ),
}).annotate({ ...strict, identifier: 'MigratedPagesReport' })

/** @public */
export type MigratedPagesReport = typeof migratedPagesReportSchema.Type
