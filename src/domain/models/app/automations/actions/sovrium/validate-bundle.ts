/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Sovrium Validate-Bundle Action (type: sovrium, operator: validateBundle)
 *
 * Checks a deployable bundle — the archive `sovrium bundle` writes — that is
 * already stored in this app's storage, before anything applies it:
 *
 * 1. reads the archive at `objectKey`;
 * 2. reads its `manifest.json` against the bundle manifest rule;
 * 3. checks every entry the manifest lists against its size and sha256, and
 *    that the archive holds nothing the manifest does not list;
 * 4. decodes `project/app.json` exactly as `validateConfig` does.
 *
 * The step answers `{ valid, name, manifest, errors }`. A bundle that fails
 * any check is a VERDICT (`valid: false`, `errors` naming what failed), not a
 * failed step, so an intake can record the report and tell the developer; the
 * step fails only when there is no object at `objectKey` to read.
 *
 * NO `url`, `path` OR inline archive prop — BY DESIGN, for the reasons
 * `validateConfig` gives: the archive comes from this app's own storage, where
 * an upload with its own size limit and attribution put it.
 */
export const SovriumValidateBundleActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('sovrium').pipe(
    Schema.annotate({
      description: "Constant value 'sovrium' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('validateBundle').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'sovrium' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    objectKey: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Storage key of the bundle archive in this app’s own storage — the key an upload returned (supports template variables)',
      })
    ),
  }).annotate({
    description: 'Where the bundle archive to check is stored.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'SovriumValidateBundleAction',
    title: 'Sovrium Validate-Bundle Action',
    description:
      'Check a stored bundle archive — its manifest, every entry against its sha256, and the config it carries — and expose { valid, name, manifest, errors }',
  })
)

/** @public */
export type SovriumValidateBundleAction = Schema.Schema.Type<
  typeof SovriumValidateBundleActionSchema
>
