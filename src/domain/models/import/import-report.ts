/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { migratedPagesReportSchema } from '@/domain/models/app/design/adapters/pages/migrate/migrated-pages-report'
import { ImportDomainSchema, ImportExportKindSchema, ImportSourceToolSchema } from './import-source'

/**
 * Contract for the report `sovrium import` prints — as text by default, as
 * JSON with `--json`, and into a file with `--report <file>`.
 *
 * ─── ONE ENVELOPE, ONE SECTION PER DOMAIN ─────────────────────────────────
 *
 * A migration produces up to five parts of an app: tables, data, automations,
 * forms and pages. The envelope — `format`, `version`, `source`, `written`,
 * `unmapped`, `todo` — is shared by all of them, and each part that ran adds
 * its own section. `pages` is produced by the page migration converter and its
 * shape is owned there: it extends this envelope rather than defining a second
 * one, so an operator, or their own AI, reads one report per run.
 *
 * ─── THE REPORT IS THE HAND-OFF ───────────────────────────────────────────
 *
 * The conversion decides nothing its input did not state. Whatever its mapping
 * tables do not cover is written here: as `unmapped` when the data survived a
 * lossy fallback (a field kept as text), and as `todo` when someone has to
 * finish it (a code step, a formula, a branching rule), with the original
 * quoted verbatim so the item can be worked through without reopening the
 * source tool.
 *
 * ─── NEVER A SECRET ───────────────────────────────────────────────────────
 *
 * No token, connection string or credential is ever written into the report:
 * a connection is reported by the NAME of the env variable its token reads.
 * The same report is printed by a dry run and by `--write`; only `written`
 * differs, so a dry run is an exact preview.
 */

/** The report format identifier. */
export const IMPORT_REPORT_FORMAT = 'sovrium.import-report'

const strict = { strictKeys: true, title: 'sovrium:strict-keys' } as const

const count = (description: string) =>
  Schema.Int.annotate({ description }).check(Schema.isGreaterThanOrEqualTo(0))

/** What was read. */
export const importReportSourceSchema = Schema.Struct({
  input: Schema.String.annotate({
    description:
      'The path or source URI given on the command line. A connection string read from the environment appears as `$env.<NAME>`',
    examples: ['./contacts.csv', './snapshots/crm', 'airtable:appX9kQ2vLmN7'],
  }),
  tool: ImportSourceToolSchema,
  exportKind: ImportExportKindSchema,
  forced: Schema.Boolean.annotate({
    description: 'Whether `--from` chose the tool rather than detection',
  }),
  snapshot: Schema.optional(
    Schema.String.annotate({
      description: 'The snapshot folder the conversion read, when it read one',
    })
  ),
}).annotate({ ...strict, identifier: 'ImportReportSource' })

/** A part of the source kept through a lossy fallback. */
export const importUnmappedSchema = Schema.Struct({
  domain: ImportDomainSchema,
  source: Schema.String.annotate({
    description: 'What the source holds, as the source names it',
    examples: ['Deals.Health score (aiText)', 'Contacts / Pipeline (kanban)'],
  }),
  kind: Schema.Literals([
    'field-type',
    'view',
    'trigger',
    'step',
    'expression',
    'question',
    'rule',
    'identity',
    'other',
  ]).annotate({
    description:
      'What kind of thing was kept through a fallback: a field type with no Sovrium equivalent, a view that is not a grid, a question type, a record identity the source does not carry',
  }),
  reason: Schema.String.annotate({ description: 'Why, in a sentence' }),
  fallback: Schema.optional(
    Schema.String.annotate({
      description: 'What it became instead',
      examples: ['long-text', 'row position'],
    })
  ),
}).annotate({ ...strict, identifier: 'ImportUnmapped' })

/** A part of the source someone has to finish. */
export const importTodoSchema = Schema.Struct({
  domain: ImportDomainSchema,
  target: Schema.String.annotate({
    description: 'Where the item landed in the written config, as a dotted path',
    examples: [
      'automations.weekly-digest.actions.enrich-lead',
      'tables.deals.fields.score',
      'forms.event-signup.fields.dietary',
    ],
  }),
  original: Schema.String.annotate({
    description: 'The source construct, verbatim: the code, the formula, the expression, the rule',
  }),
  reason: Schema.String.annotate({ description: 'Why it did not translate, in a sentence' }),
}).annotate({ ...strict, identifier: 'ImportTodo' })

/** Something the source holds that no export or API exposes. */
export const importNeverImportableSchema = Schema.Struct({
  what: Schema.String.annotate({
    description: 'What the source holds',
    examples: ['Airtable automations', 'Zapier Interfaces'],
  }),
  reason: Schema.String.annotate({ description: 'Why no export or API exposes it' }),
}).annotate({ ...strict, identifier: 'ImportNeverImportable' })

/** What `--write` wrote, and what `--apply` seeded. */
export const importWrittenSchema = Schema.Struct({
  config: Schema.optional(
    Schema.String.annotate({ description: 'The YAML or JSON config the import added entries to' })
  ),
  sidecars: Schema.Array(Schema.String).annotate({
    description: 'The sidecar files written beside a TypeScript config, which is never edited',
    examples: [['tables/deals.table.json', 'automations/weekly-digest.automation.json']],
  }),
  importLines: Schema.Array(Schema.String).annotate({
    description: 'The lines to add to a TypeScript config so it reads the sidecars',
  }),
  seedFiles: Schema.Array(Schema.String).annotate({
    description:
      'The seed files written, `seed/import/<table>.yaml` or `seed/import/<table>.jsonl`, in a folder the import adds to `.gitignore`',
  }),
  assets: count('The attachments copied into `seed/import/assets/`'),
  gitignore: Schema.Array(Schema.String).annotate({
    description:
      'The entries the import added to the project `.gitignore` (`seed/import/`, `.sovrium-imports/`); empty when they were already there',
  }),
  unchanged: Schema.Boolean.annotate({
    description: 'True when every file already held exactly these bytes, so nothing was written',
  }),
  applied: Schema.optional(
    Schema.Array(
      Schema.Struct({
        table: Schema.String.annotate({ description: 'The table seeded' }),
        inserted: count('Rows inserted'),
        updated: count('Existing rows whose values changed'),
        unchanged: count('Existing rows left as they were'),
      }).annotate({ ...strict })
    ).annotate({ description: 'What `--apply` seeded, per table; absent without `--apply`' })
  ),
}).annotate({
  ...strict,
  identifier: 'ImportWritten',
  description: 'What `--write` wrote; absent on a dry run',
})

/** The tables section. */
export const importTablesSectionSchema = Schema.Struct({
  created: Schema.Array(
    Schema.Struct({
      name: Schema.String.annotate({ description: 'The Sovrium table name' }),
      source: Schema.String.annotate({ description: 'The table name in the source' }),
      fields: count('The fields it holds, `source_id` included'),
    }).annotate({ ...strict })
  ).annotate({ description: 'The tables the import adds' }),
  fields: Schema.Array(
    Schema.Struct({
      table: Schema.String.annotate({ description: 'The Sovrium table name' }),
      field: Schema.String.annotate({ description: 'The Sovrium field name' }),
      sourceType: Schema.String.annotate({ description: "The source type, in the tool's words" }),
      type: Schema.String.annotate({ description: 'The Sovrium field type it became' }),
      outcome: Schema.Literals(['mapped', 'degraded', 'unmapped']).annotate({
        description: 'Mapped as-is, mapped with a loss, or kept as text',
      }),
      reason: Schema.optional(Schema.String.annotate({ description: 'What was lost, and why' })),
    }).annotate({ ...strict })
  ).annotate({ description: 'Every field, with how its type was mapped' }),
  views: Schema.Array(
    Schema.Struct({
      table: Schema.String.annotate({ description: 'The Sovrium table name' }),
      view: Schema.String.annotate({ description: 'The view name' }),
      kind: Schema.String.annotate({ description: 'The view kind in the source' }),
      outcome: Schema.Literals(['mapped', 'reported']).annotate({
        description: 'A grid becomes a table view; every other kind is reported',
      }),
    }).annotate({ ...strict })
  ).annotate({ description: 'Every view of the source tables' }),
  neverImportable: Schema.Array(importNeverImportableSchema).annotate({
    description: 'What the source base holds that cannot be read',
  }),
}).annotate({ ...strict, identifier: 'ImportTablesSection' })

/** The data section. */
export const importDataSectionSchema = Schema.Struct({
  tables: Schema.Array(
    Schema.Struct({
      table: Schema.String.annotate({ description: 'The Sovrium table name' }),
      records: count('The records in its seed file'),
      file: Schema.String.annotate({
        description: 'The seed file, relative to the config, under `seed/import/`',
      }),
      format: Schema.Literals(['yaml', 'jsonl']).annotate({
        description: 'YAML up to the JSON Lines threshold, JSON Lines above it',
      }),
      identity: Schema.Literals(['source-id', 'row-position']).annotate({
        description:
          "How a record is matched on a re-import: the source's own record id, or, for a file with no id column, its row position",
      }),
    }).annotate({ ...strict })
  ).annotate({ description: 'One seed file per table' }),
  users: count('The collaborators seeded as accounts, with no password and no invitation'),
}).annotate({ ...strict, identifier: 'ImportDataSection' })

/** The automations section. */
export const importAutomationsSectionSchema = Schema.Struct({
  created: Schema.Array(
    Schema.Struct({
      name: Schema.String.annotate({ description: 'The Sovrium automation name' }),
      source: Schema.String.annotate({ description: 'The flow name in the source' }),
      enabled: Schema.Literal(false).annotate({
        description:
          'Always false: every imported automation is written disabled, TODO or not, and runs only once the operator switches it on',
      }),
      sourceActive: Schema.Boolean.annotate({
        description: 'Whether the flow was switched on in the source tool',
      }),
      todos: count('The TODO items it holds; 0 means it is ready to be reviewed and switched on'),
    }).annotate({ ...strict })
  ).annotate({ description: 'The automations the import adds' }),
  connections: Schema.Array(
    Schema.Struct({
      name: Schema.String.annotate({ description: 'The `connections[]` entry name' }),
      library: Schema.optional(
        Schema.String.annotate({
          description:
            'The library connection it was installed from, exactly as `sovrium library add` installs it',
          examples: ['slack', 'hubspot'],
        })
      ),
      origin: Schema.optional(
        Schema.Literals(['library', 'catalogue', 'skeleton']).annotate({
          description:
            "Where its definition comes from: the connection library, the import's catalogue of observed apps the library does not hold yet, or a skeleton for an app neither knows",
        })
      ),
      reused: Schema.optional(
        Schema.Boolean.annotate({
          description: 'True when the config already held the connection, which the import reuses',
        })
      ),
      operations: Schema.optional(
        Schema.Array(Schema.String).annotate({
          description: 'The operations the imported steps call on it',
          examples: [['send-email']],
        })
      ),
      env: Schema.optional(
        Schema.Array(Schema.String).annotate({
          description: 'The env variable NAMES it reads, sorted',
          examples: [['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']],
        })
      ),
      oauthApp: Schema.optional(
        Schema.String.annotate({
          description:
            'For an OAuth connection, where the operator registers the OAuth application and its redirect URI before connecting the account',
          examples: ['https://www.dropbox.com/developers/apps'],
        })
      ),
      sourceCredential: Schema.optional(
        Schema.String.annotate({
          description:
            'The source credential it stands for, as the export labels it; never a secret',
          examples: ['n8n:gmailOAuth2:7'],
        })
      ),
    }).annotate({ ...strict })
  ).annotate({ description: 'The connections to authorise' }),
  env: Schema.Array(Schema.String).annotate({
    description: 'The env variable NAMES to set before the automations can run, sorted',
    examples: [['SLACK_BOT_TOKEN']],
  }),
  neverImportable: Schema.Array(importNeverImportableSchema).annotate({
    description: 'The automations the source holds that cannot be read',
  }),
}).annotate({ ...strict, identifier: 'ImportAutomationsSection' })

/** The forms section. */
export const importFormsSectionSchema = Schema.Struct({
  created: Schema.Array(
    Schema.Struct({
      name: Schema.String.annotate({ description: 'The Sovrium form name' }),
      source: Schema.String.annotate({ description: 'The form title in the source' }),
      table: Schema.String.annotate({
        description:
          'The table it writes to: a generated `<form>_responses` table, or the imported table an Airtable form view wrote to',
      }),
      fields: count('The form fields'),
      steps: count('The steps; 0 for a single-page form'),
      responses: count('The responses seeded into its table'),
      definitionInferred: Schema.Boolean.annotate({
        description:
          'True when the tool exposes no form definition and the fields were inferred from the responses',
      }),
    }).annotate({ ...strict })
  ).annotate({ description: 'The forms the import adds' }),
}).annotate({ ...strict, identifier: 'ImportFormsSection' })

/**
 * The envelope every migration report shares, as Struct fields, so the page
 * migration report extends it with its own `pages` section rather than
 * re-declaring it.
 */
export const importReportEnvelopeFields = {
  format: Schema.Literal(IMPORT_REPORT_FORMAT).annotate({
    description: 'The report format identifier',
  }),
  version: Schema.Literal(1).annotate({ description: 'The report version' }),
  source: importReportSourceSchema,
  written: Schema.optional(importWrittenSchema),
  unmapped: Schema.Array(importUnmappedSchema).annotate({
    description: 'Every part of the source kept through a lossy fallback',
  }),
  todo: Schema.Array(importTodoSchema).annotate({
    description: 'Every part of the source someone has to finish, the original quoted',
  }),
} as const

/** The domain sections this programme writes; each is present only when its domain ran. */
export const importReportDomainFields = {
  tables: Schema.optional(importTablesSectionSchema),
  data: Schema.optional(importDataSectionSchema),
  automations: Schema.optional(importAutomationsSectionSchema),
  forms: Schema.optional(importFormsSectionSchema),
} as const

/** The pages section of a run whose source has no page parser in this binary. */
export const importPendingPagesSchema = Schema.Struct({
  status: Schema.Literal('pending').annotate({
    description: 'This binary holds no parser for the source, so its pages were not converted',
  }),
  message: Schema.String.annotate({ description: 'What is pending, in a sentence' }),
}).annotate({ ...strict, identifier: 'ImportPendingPages' })

/**
 * The report of one `sovrium import` run.
 *
 * `pages` is the page migration converter's section (`status: 'converted'`),
 * or the pending notice for a source with no parser; `status` tells
 * the two apart.
 *
 * @public Printed by `sovrium import --json`.
 */
export const importReportSchema = Schema.Struct({
  ...importReportEnvelopeFields,
  ...importReportDomainFields,
  pages: Schema.optional(
    Schema.Union([importPendingPagesSchema, migratedPagesReportSchema]).annotate({
      description:
        'The pages section: what the page migration converter did, or a pending notice when none ran',
    })
  ),
}).annotate({ ...strict, identifier: 'ImportReport' })

/** @public */
export type ImportReport = typeof importReportSchema.Type
