/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The report sections of a source that brings its own access rules, user
 * accounts and file buckets (Supabase): what became of its row-level
 * security, its users and its buckets. Kept beside `import-report.ts`, which
 * composes them into the one report.
 *
 * Never a secret here either: a policy is quoted, an account is counted, a
 * bucket is named, and no credential of the source appears.
 */

import { Schema } from 'effect'

const strict = { strictKeys: true, title: 'sovrium:strict-keys' } as const

const count = (description: string) =>
  Schema.Int.annotate({ description }).check(Schema.isGreaterThanOrEqualTo(0))

/** One operation of a table as the access rules translation left it. */
const importPermissionOperationSchema = Schema.Struct({
  operation: Schema.Literals(['read', 'create', 'update', 'delete']).annotate({
    description: 'The Sovrium operation',
  }),
  outcome: Schema.Literals(['translated', 'closed']).annotate({
    description:
      'Translated from the policies that cover it, or closed to `admin` because none covers it, one could not be translated, or the table had no row-level security',
  }),
  grant: Schema.optional(
    Schema.Literals(['all', 'authenticated']).annotate({
      description: 'Who the translated operation is open to',
    })
  ),
  ownerField: Schema.optional(
    Schema.String.annotate({
      description:
        'The field a translated row rule compares with the signed-in person, when the policy limited the operation to the row owner',
    })
  ),
}).annotate({ ...strict })

/** The access rules section: a source's row-level security, translated or closed. */
export const importPermissionsSectionSchema = Schema.Struct({
  tables: Schema.Array(
    Schema.Struct({
      table: Schema.String.annotate({ description: 'The Sovrium table name' }),
      source: Schema.String.annotate({ description: 'The table name in the source' }),
      rowSecurity: Schema.Literals(['enabled', 'disabled']).annotate({
        description:
          'Whether the source enforced row-level security. A disabled table is written closed to `admin`',
      }),
      operations: Schema.Array(importPermissionOperationSchema).annotate({
        description: 'Each of the four operations, as written',
      }),
      policies: Schema.Array(
        Schema.Struct({
          policy: Schema.String.annotate({ description: 'The policy name in the source' }),
          command: Schema.String.annotate({ description: 'The command it governs' }),
          roles: Schema.Array(Schema.String).annotate({ description: 'The roles it applies to' }),
          expression: Schema.optional(
            Schema.String.annotate({
              description: 'Its expression, verbatim as the source stored it',
            })
          ),
          outcome: Schema.Literals(['mapped', 'unmapped']).annotate({
            description:
              'Translated by the closed translation table, or not, in which case what it governs is closed',
          }),
          reason: Schema.optional(
            Schema.String.annotate({ description: 'Why it was not translated, and what to do' })
          ),
        }).annotate({ ...strict })
      ).annotate({ description: 'Every policy of the table, with its outcome' }),
    }).annotate({ ...strict })
  ).annotate({ description: 'One entry per imported table that carried row-level security' }),
}).annotate({ ...strict, identifier: 'ImportPermissionsSection' })

/** The accounts section: a source's own users. */
export const importAuthSectionSchema = Schema.Struct({
  accounts: count('The accounts seeded with no password and no invitation, set by a reset'),
  invitations: count('The accounts seeded as pending invitations'),
  skipped: Schema.Array(
    Schema.Struct({
      reason: Schema.Literals(['anonymous', 'no-email', 'deleted']).annotate({
        description: 'Why the source account was not imported',
      }),
      count: count('How many'),
    }).annotate({ ...strict })
  ).annotate({ description: 'The source accounts left out, by reason' }),
  passwords: Schema.Literal('not-imported').annotate({
    description:
      'Always `not-imported`: a password hash from the source cannot be verified by Sovrium, so none is carried over',
  }),
  message: Schema.String.annotate({
    description: 'What the people behind these accounts have to do to sign in, in one sentence',
  }),
}).annotate({ ...strict, identifier: 'ImportAuthSection' })

/** The buckets section: a source's file buckets and their files. */
export const importBucketsSectionSchema = Schema.Struct({
  created: Schema.Array(
    Schema.Struct({
      name: Schema.String.annotate({ description: 'The Sovrium bucket name' }),
      source: Schema.String.annotate({ description: 'The bucket name in the source' }),
      public: Schema.Boolean.annotate({ description: 'Whether the bucket serves files to anyone' }),
      files: count('The files written under `seed/import/buckets/<bucket>/`'),
      skipped: count('The files listed but not downloaded'),
    }).annotate({ ...strict })
  ).annotate({ description: 'The buckets the import adds' }),
  storagePolicies: Schema.Array(Schema.String).annotate({
    description:
      'The names of the source storage policies, which are not translated: each bucket keeps Sovrium’s defaults for its visibility',
  }),
}).annotate({ ...strict, identifier: 'ImportBucketsSection' })
