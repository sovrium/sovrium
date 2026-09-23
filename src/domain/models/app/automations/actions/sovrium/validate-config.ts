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
 * Sovrium Validate-Config Action (type: sovrium, operator: validateConfig)
 *
 * Decodes a candidate app config against AppSchema through the platform's own
 * decode choke point (`decodeAppConfigObject`, the same one `sovrium validate`
 * runs) and exposes `{ valid, errors }` so a later step can branch on
 * `{{steps.<name>.valid}}` / `{{steps.<name>.errors}}`.
 *
 * Decode-only: no side effects, no boot.
 *
 * WHY THIS LIVES UNDER `sovrium/` AND NOT `data/`. `data/*` is a family of pure
 * in-memory transforms over values a run already holds. Validating a config is
 * not a transform — it is the engine inspecting *itself*, mirroring a CLI
 * command. `sovrium/*` is the namespace for operators dedicated to the engine,
 * and this is its first member. It replaces the removed `data:validate-config`
 * (see `feat(automations)!: remove the data validate-config action`), which
 * additionally carried the prop-resolution defect documented on the handler.
 *
 * NO `url`, `path`, `file` OR `.ts` PROP — BY DESIGN. Each would turn a
 * webhook-reachable action into an SSRF probe, an arbitrary-file read, or
 * arbitrary code execution outside the `code` sandbox. A caller that needs a
 * config from elsewhere fetches it with an `http`/`file` step (which carry
 * their own outbound guards) and passes the value in.
 */
export const SovriumValidateConfigActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('sovrium').pipe(
    Schema.annotate({
      description: "Constant value 'sovrium' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('validateConfig').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'sovrium' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /**
     * The candidate config: either the object itself (what a `code` action
     * holds) or a serialized string. Mirrors the `body` prop of `http/request`,
     * the established repo pattern for an object-or-string prop.
     *
     * A whole-string `{{path}}` is dereferenced; anything else is taken
     * VERBATIM. See the handler for why the usual resolution is wrong here.
     */
    config: Schema.Union([TemplateStringSchema, Schema.Record(Schema.String, Schema.Unknown)]).pipe(
      Schema.annotate({
        description:
          'Candidate config to decode against AppSchema — an object, or a string in the given format',
      })
    ),

    /**
     * How to read the `config` string. Ignored when `config` is an object.
     * `auto` tries JSON first, then YAML — the shape a generated config
     * arrives in is not always known ahead of time.
     */
    format: Schema.optional(
      Schema.Literals(['json', 'yaml', 'auto']).pipe(
        Schema.annotate({
          description: 'Config string format — json (default), yaml, or auto (try JSON then YAML)',
        })
      )
    ),
  }).annotate({
    description: 'The configuration to check, and the format it is written in.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'SovriumValidateConfigAction',
    title: 'Sovrium Validate-Config Action',
    description: 'Decode a candidate app config against AppSchema and expose { valid, errors }',
  })
)

/** @public */
export type SovriumValidateConfigAction = Schema.Schema.Type<
  typeof SovriumValidateConfigActionSchema
>
