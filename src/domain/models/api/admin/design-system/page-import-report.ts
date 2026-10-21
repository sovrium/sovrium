/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { pageInterchangeNameSchema, pageNodeIdSchema } from './page-design-tree'

/**
 * Contract for the report `sovrium design-system import <path> --pages --json`
 * prints.
 *
 * The page import reads what a design tool made of the bundle's pages — a
 * Claude Design canvas project, a Penpot file, the Sovrium Figma plugin's JSON
 * — rebuilds each page's component tree against the bundle's node map, and
 * either prints what would change (the default, and `--dry-run`) or writes the
 * operator's config (`--write`). The report is the same in both modes.
 *
 * ─── NOTHING IS DROPPED SILENTLY ───────────────────────────────────────────
 *
 * Every drawn node lands in exactly one list: matched to the node it was drawn
 * from, moved, added as a new kit node, or refused with its reason; every page
 * node no longer drawn is removed. A value off the token scale is listed in
 * `offScale` and never rounded to the nearest token. A change to translated
 * copy is listed in `translations`: it is written to the default language's
 * entry for its key, and every other language holding the key is named as
 * needing translation, never written. An island's internals are listed in
 * `ignored`, since only its box is read. A drawing the import could not read
 * at all — a board naming a page the config does not declare, a sketch that
 * names no page — is listed in `skipped`, and the rest are imported.
 *
 * ─── TEMPLATES ARE NEVER IMPORTED ──────────────────────────────────────────
 *
 * `templates.imported` is always `false`: a template's definition, a library
 * block and the content of an expanded reference are never written back from
 * a drawing of one page. Only a placement's own changes are.
 */

/** The page import report format identifier. */
export const PAGE_IMPORT_REPORT_FORMAT = 'sovrium.design-system.page-import-report'

/** The design tools whose page drawings the import reads, as `--from` names them. */
export const pageImportSourceFormatSchema = Schema.Literals([
  'claude-design',
  'figma',
  'penpot',
]).annotate({
  description:
    'The tool the drawings come from: a Claude Design canvas project, the JSON the Sovrium Figma plugin writes, or a Penpot `.penpot` file',
})

/** Why a drawn change was refused. */
export const pageImportRefusalCodeSchema = Schema.Literals([
  'BINDING_EDIT',
  'TEMPLATE_EDIT_OUT_OF_SCOPE',
  'NOT_A_KIT_COMPONENT',
  'PAGE_SETTINGS_EDIT',
  'REQUIRED_VALUE_MISSING',
]).annotate({
  description:
    'Why a change was refused: it edits text a binding fills (`BINDING_EDIT`), it edits inside a template, a library block or an expanded reference (`TEMPLATE_EDIT_OUT_OF_SCOPE`), the drawn layer is not a kit component (`NOT_A_KIT_COMPONENT`), it edits the page path or meta (`PAGE_SETTINGS_EDIT`), or a new node lacks a value its component requires and the drawing does not show (`REQUIRED_VALUE_MISSING`)',
})

/** One node that moved within its page. */
export const pageImportMoveSchema = Schema.Struct({
  node: pageNodeIdSchema,
  to: pageNodeIdSchema,
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportMove',
})

/** One new kit node the drawing added. */
export const pageImportAdditionSchema = Schema.Struct({
  node: pageNodeIdSchema,
  type: Schema.String.annotate({ description: 'The kit component type of the new node' }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportAddition',
})

/** One property of a matched node the drawing changed. */
export const pageImportChangeSchema = Schema.Struct({
  node: pageNodeIdSchema,
  property: Schema.String.annotate({
    description: 'The changed property, as a dotted path from the node',
    examples: ['variant', 'size', 'content', 'layout.gap', 'responsive.md.padding'],
  }),
  before: optionalField(
    Schema.String.annotate({ description: 'The value before the import; absent for an addition' })
  ),
  after: optionalField(
    Schema.String.annotate({ description: 'The value after the import; absent for a removal' })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportChange',
})

/** One drawn value that is not on the token scale. */
export const pageImportOffScaleSchema = Schema.Struct({
  node: pageNodeIdSchema,
  property: Schema.String.annotate({ description: 'The property the value was drawn for' }),
  value: Schema.String.annotate({
    description: 'The value as the tool drew it',
    examples: ['13px', '1.1rem'],
  }),
  nearestToken: optionalField(
    Schema.String.annotate({
      description:
        'The closest token on that scale, named so a designer can snap to it; never written',
      examples: ['spacing.3'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportOffScale',
})

/** One drawn change the import refused. */
export const pageImportRefusalSchema = Schema.Struct({
  node: pageNodeIdSchema,
  code: pageImportRefusalCodeSchema,
  reason: Schema.String.annotate({ description: 'Why it was refused, in a sentence' }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportRefusal',
})

/** One change to translated copy: written to the default language, never to another. */
export const pageImportTranslationSchema = Schema.Struct({
  node: pageNodeIdSchema,
  key: Schema.String.annotate({
    description: 'The translation key the text comes from',
    examples: ['$t:dashboard.title'],
  }).check(Schema.isPattern(/^\$t:.+$/)),
  before: Schema.String.annotate({ description: 'The text the export drew' }),
  after: Schema.String.annotate({ description: 'The text the drawing now holds' }),
  written: optionalField(
    Schema.String.annotate({
      description:
        "The language whose entry for the key the import writes: the app's default language. Absent when nothing is written, and `reason` says why",
      examples: ['en'],
    })
  ),
  needsTranslation: optionalField(
    Schema.Array(Schema.String).annotate({
      description:
        'Every other language holding the key, which the import never writes: a translation is written by a person who reads that language',
      examples: [['fr']],
    })
  ),
  reason: optionalField(
    Schema.String.annotate({
      description: 'Why the change was not written, in a sentence; absent when it was',
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportTranslation',
})

/** One drawing the import could not read as a page of the config. */
export const pageImportSkippedSchema = Schema.Struct({
  drawing: Schema.String.annotate({
    description: 'The drawing, as the source names it: a board file, a Figma page, a Penpot page',
    examples: ['dashboard-audit-log/DashboardAuditLog.dc.html'],
  }),
  reason: Schema.String.annotate({
    description: 'Why it was not imported, in a sentence',
    examples: ['The board draws the page audit-log, which this config does not declare.'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportSkipped',
})

/** One drawn detail the import did not read at all. */
export const pageImportIgnoredSchema = Schema.Struct({
  node: pageNodeIdSchema,
  reason: Schema.String.annotate({
    description: 'Why it was not read, in a sentence',
    examples: ["An island's internals are never read; only its box is."],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportIgnored',
})

/** What the import found on one page. */
export const pageImportPageSchema = Schema.Struct({
  name: pageInterchangeNameSchema,
  matched: Schema.Array(pageNodeIdSchema).annotate({
    description: 'Every page node a drawn node was matched to, by key first, then by path',
  }),
  moved: Schema.Array(pageImportMoveSchema).annotate({
    description: 'Every matched node that now sits elsewhere on the page',
  }),
  added: Schema.Array(pageImportAdditionSchema).annotate({
    description: 'Every new kit node the drawing added, unbound',
  }),
  removed: Schema.Array(pageNodeIdSchema).annotate({
    description: 'Every page node the drawing no longer holds',
  }),
  changes: Schema.Array(pageImportChangeSchema).annotate({
    description: 'Every property a matched node changed, in node then property order',
  }),
  offScale: Schema.Array(pageImportOffScaleSchema).annotate({
    description: 'Every drawn value off the token scale, never written',
  }),
  refused: Schema.Array(pageImportRefusalSchema).annotate({
    description: 'Every drawn change the import refused, with its code',
  }),
  translations: Schema.Array(pageImportTranslationSchema).annotate({
    description:
      'Every change to translated copy, each naming the language written and the languages left to translate',
  }),
  ignored: Schema.Array(pageImportIgnoredSchema).annotate({
    description: 'Every drawn detail the import did not read, such as an island internals',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportPage',
})

/** One sidecar written beside a TypeScript config. */
export const pageImportSidecarSchema = Schema.Struct({
  page: pageInterchangeNameSchema,
  path: Schema.String.annotate({
    description: 'The `<name>.page.json` written, relative to the config',
    examples: ['pages/dashboard.page.json'],
  }),
  importLine: optionalField(
    Schema.String.annotate({
      description:
        'The import statement to add to the TypeScript module that owns the page, printed when the sidecar is new',
      examples: ["import dashboard from './dashboard.page.json'"],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportSidecar',
})

/**
 * The report of one `sovrium design-system import --pages` run.
 *
 * @public Authored ahead of the command: `sovrium design-system import --pages
 * --json` prints it when the page import ships.
 */
export const pageImportReportSchema = Schema.Struct({
  format: Schema.Literal(PAGE_IMPORT_REPORT_FORMAT).annotate({
    description: 'The report format identifier',
  }),
  version: Schema.Literal(1).annotate({ description: 'The report version' }),
  source: Schema.Struct({
    path: Schema.String.annotate({ description: 'The file or folder that was read' }),
    format: pageImportSourceFormatSchema,
    forced: Schema.Boolean.annotate({
      description: 'Whether `--from` chose the format rather than detection',
    }),
  }).annotate({ strictKeys: true, title: 'sovrium:strict-keys' }),
  pages: Schema.Array(pageImportPageSchema).annotate({
    description: 'One entry per page the drawings held, in config order',
  }),
  skipped: optionalField(
    Schema.Array(pageImportSkippedSchema).annotate({
      description:
        'Every drawing that was not imported as a page, with its reason; the other drawings are imported',
    })
  ),
  templates: Schema.Struct({
    imported: Schema.Literal(false).annotate({
      description: 'Always false: templates and library blocks are never imported',
    }),
    found: Schema.Int.annotate({
      description: 'How many template and library-block placements the drawings held',
    }).check(Schema.isGreaterThanOrEqualTo(0)),
  }).annotate({ strictKeys: true, title: 'sovrium:strict-keys' }),
  written: optionalField(
    Schema.Struct({
      config: optionalField(
        Schema.String.annotate({ description: 'The YAML or JSON config the import patched' })
      ),
      bytes: Schema.Int.annotate({
        description: 'How many bytes the write changed; zero when nothing changed',
      }).check(Schema.isGreaterThanOrEqualTo(0)),
      sidecars: optionalField(
        Schema.Array(pageImportSidecarSchema).annotate({
          description:
            'The page sidecars written beside a TypeScript config, which is never edited',
        })
      ),
    }).annotate({
      strictKeys: true,
      title: 'sovrium:strict-keys',
      description: 'What `--write` wrote; absent on a dry run',
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'PageImportReport',
})

/** @public */
export type PageImportReport = typeof pageImportReportSchema.Type
