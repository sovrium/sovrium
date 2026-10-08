/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { InstanceSlugSchema } from './instance-slug'

/**
 * Instance Backup Action (type: instance, operator: backup)
 *
 * Takes a `sovrium backup` of a supervised app and stores the archive in this
 * app's storage at `destination.objectKey`.
 *
 * The supervised app runs as its own system user, whose data this process
 * cannot read, so the backup is not run here: the step starts the one-shot
 * unit `sovrium-backup@<slug>.service`, which runs `sovrium backup` as the
 * app and writes `<SOVRIUM_INSTANCES_DIR>/<slug>/backup/backup.tar.gz`; the
 * step then uploads that file and deletes the local copy. The app keeps
 * running throughout.
 */
export const InstanceBackupActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('backup').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: InstanceSlugSchema,
    destination: Schema.Struct({
      objectKey: TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Storage key the archive is written to in this app’s storage (supports template variables)',
        })
      ),
    }).annotate({ description: 'Where the archive is stored' }),
  }).annotate({
    description: 'The supervised app to back up, and where its archive goes.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceBackupAction',
    title: 'Instance Backup Action',
    description: "Back up a supervised app and store the archive in this app's storage",
  })
)

/** @public */
export type InstanceBackupAction = Schema.Schema.Type<typeof InstanceBackupActionSchema>
