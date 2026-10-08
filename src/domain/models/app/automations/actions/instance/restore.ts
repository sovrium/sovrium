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
 * Instance Restore Action (type: instance, operator: restore)
 *
 * Replaces a supervised app's data with a `sovrium backup` archive held in this
 * app's storage at `source.objectKey`. In order: copies the archive to
 * `<SOVRIUM_INSTANCES_DIR>/<slug>/restore/restore.tar.gz`, stops the app as
 * `stop` does, starts the one-shot unit `sovrium-restore@<slug>.service` (which
 * runs `sovrium restore` as the app), starts the app's socket again, and
 * deletes the local copy. A failed restore leaves the app stopped and fails the
 * step, so a half-restored app is never served.
 */
export const InstanceRestoreActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('restore').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: InstanceSlugSchema,
    source: Schema.Struct({
      objectKey: TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Storage key of the archive in this app’s storage (supports template variables)',
        })
      ),
    }).annotate({ description: 'Which archive to restore' }),
  }).annotate({
    description: 'The supervised app to restore, and the archive it is restored from.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceRestoreAction',
    title: 'Instance Restore Action',
    description: "Restore a supervised app from a backup archive in this app's storage",
  })
)

/** @public */
export type InstanceRestoreAction = Schema.Schema.Type<typeof InstanceRestoreActionSchema>
