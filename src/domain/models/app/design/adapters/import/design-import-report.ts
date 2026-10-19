/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Contract for the report `sovrium design-system import --json` prints.
 *
 * Import is a file-to-file conversion: it reads a token file a design tool
 * exported, maps it onto the app's `design` key, and either prints what would
 * change (the default, and `--dry-run`) or writes it (`--write`). It never
 * runs over HTTP and never in the console. The report is the same in both
 * modes, so a dry run is an exact preview of the write.
 *
 * ─── A CHANGE IS ONE LEAF ──────────────────────────────────────────────────
 *
 * Each change names one leaf of `design` by its dotted path and its value
 * after the import, plus its value before when there was one. A token whose
 * value the app already paints — declared or inherited — is not a change, and
 * neither is the same length spelled another way (`10px` and `0.625rem` at a
 * 16px base). That is what lets an export read straight back report nothing.
 *
 * ─── NOTHING IS DROPPED SILENTLY ───────────────────────────────────────────
 *
 * Every token the import could not place in `design` is listed in `unmapped`
 * with the reason, and the components a source carries are counted and never
 * imported. Import adds and changes; it never removes a key the source does
 * not mention.
 */

/** The report format identifier. */
export const DESIGN_SYSTEM_IMPORT_REPORT_FORMAT = 'sovrium.design-system.import-report'

/** The token formats the import reads, as `--from` names them. */
export const designSystemImportFormatSchema = Schema.Literals([
  'claude-design',
  'figma',
  'tokens-studio',
  'style-dictionary',
  'dtcg',
  'css',
]).annotate({
  description:
    'The source format: a Claude Design `tokens.json`, a Figma Variables DTCG export, Tokens Studio sets, a Style Dictionary token tree, DTCG with a resolver or a dark file, or CSS variables and a Tailwind `@theme` block',
})

/** Why a token was not placed in `design`. */
export const designSystemImportUnmappedKindSchema = Schema.Literals([
  'mode',
  'family',
  'group',
  'token-type',
  'text-style',
  'alias',
  'modifier',
]).annotate({
  description:
    'What kind of thing was left out: a colour `mode` beyond light and dark, a token `family` or `group` that names no `design` key, a `token-type` with no `design` home, a `text-style` outside the type-scale ladder, an `alias` that does not resolve, or a value `modifier` the import does not apply',
})

/** One leaf of `design` the import adds or changes. */
export const designSystemImportChangeSchema = Schema.Struct({
  path: Schema.String.annotate({
    description: 'The dotted path of the leaf, from `design`',
    examples: ['design.colors.primary', 'design.darkColors.primary', 'design.radius.md'],
  }).check(Schema.isPattern(/^design\.[A-Za-z0-9.-]+$/)),
  before: optionalField(
    Schema.String.annotate({
      description: 'The declared value before the import; absent for an addition',
    })
  ),
  after: Schema.String.annotate({
    description: 'The value after the import, as it is written',
    examples: ['#1d4ed8', '0.625rem', '768px'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignSystemImportChange',
})

/** One source token left out of `design`. */
export const designSystemImportUnmappedSchema = Schema.Struct({
  token: Schema.String.annotate({
    description: 'The token, theme, family or style as the source names it',
    examples: ['high-contrast', 'size.control', 'heading'],
  }),
  kind: designSystemImportUnmappedKindSchema,
  reason: Schema.String.annotate({ description: 'Why it was left out, in a sentence' }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignSystemImportUnmapped',
})

/**
 * The report of one `sovrium design-system import` run.
 *
 * @public Authored ahead of the command: `sovrium design-system import --json`
 * prints it when it ships.
 */
export const designSystemImportReportSchema = Schema.Struct({
  format: Schema.Literal(DESIGN_SYSTEM_IMPORT_REPORT_FORMAT).annotate({
    description: 'The report format identifier',
  }),
  version: Schema.Literal(1).annotate({ description: 'The report version' }),
  source: Schema.Struct({
    path: Schema.String.annotate({ description: 'The file or folder that was read' }),
    format: designSystemImportFormatSchema,
    forced: Schema.Boolean.annotate({
      description: 'Whether `--from` chose the format rather than detection',
    }),
  }).annotate({ strictKeys: true, title: 'sovrium:strict-keys' }),
  modes: Schema.Array(Schema.Literals(['light', 'dark'])).annotate({
    description: 'The colour modes the source carried and the import mapped',
  }),
  changes: Schema.Array(designSystemImportChangeSchema).annotate({
    description: 'Every leaf of `design` the import adds or changes, in path order',
  }),
  unmapped: Schema.Array(designSystemImportUnmappedSchema).annotate({
    description: 'Every source token left out of `design`, with the reason',
  }),
  components: Schema.Struct({
    imported: Schema.Literal(false).annotate({
      description: 'Always false: components are never imported',
    }),
    found: Schema.Int.annotate({
      description: 'How many components the source carried',
    }).check(Schema.isGreaterThanOrEqualTo(0)),
  }).annotate({ strictKeys: true, title: 'sovrium:strict-keys' }),
  written: optionalField(
    Schema.Struct({
      config: optionalField(
        Schema.String.annotate({ description: 'The YAML or JSON config the import patched' })
      ),
      sidecar: optionalField(
        Schema.String.annotate({
          description:
            'The `design.json` written beside a TypeScript config, which is never edited',
        })
      ),
      importLine: optionalField(
        Schema.String.annotate({
          description:
            'The import statement to put at the top of a TypeScript config so it reads the sidecar',
          examples: ["import design from './design.json'"],
        })
      ),
      propertyLine: optionalField(
        Schema.String.annotate({
          description:
            'The property that replaces the inline `design` block of a TypeScript config',
          examples: ['design,'],
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
  identifier: 'DesignSystemImportReport',
})

/** @public */
export type DesignSystemImportReport = typeof designSystemImportReportSchema.Type
/** @public */
export type DesignSystemImportFormat = typeof designSystemImportFormatSchema.Type
