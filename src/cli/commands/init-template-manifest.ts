/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `template.yaml` — the one file of hand-written prose a template directory
 * keeps beside its config.
 *
 * `sovrium init --template <slug>` and the release's mirror publisher both
 * render a template's wrapper files (`CLAUDE.md`, `.env.example`, and on the
 * mirror `README.md` and `LICENSE`) from this manifest, the facts of the
 * template's own config and the engine's constants. Neither exit copies the
 * manifest itself into what it produces.
 *
 * Fields, in the order a template writes them: `title`, `tagline`, `intro`,
 * `glance[]` (markdown bullets), `glanceClose` (the sentence closing "This app
 * at a glance"), optional `sections[]` (`CLAUDE.md` sections between the glance
 * and "Working on this app with an AI assistant"), `assistant`, `whatsInside`,
 * optional `readmeSections[]` (README sections after "What's inside"),
 * optional `whatToTry`, and `env[]`: the variables the template reads that the
 * generated `.env.example` does not already describe, or describes
 * differently. Index data (`name`, `description`, `category`, `topics`) stays
 * in `catalog.json`.
 */

import { Data, Result, Schema } from 'effect'

const TemplateSectionSchema = Schema.Struct({
  heading: Schema.String,
  body: Schema.String,
})

/**
 * One line of text. A section title and an example value are printed on a
 * single commented line of `.env.example`; a newline inside either would end
 * the comment and write an active `NAME=value` line into the user's file.
 */
const SingleLineString = Schema.String.check(Schema.isPattern(/^[^\r\n]*$/))

const TemplateEnvEntrySchema = Schema.Struct({
  name: Schema.String.check(Schema.isPattern(/^[A-Z][A-Z0-9_]*$/)),
  section: SingleLineString,
  description: Schema.String,
  example: Schema.optionalKey(SingleLineString),
})

export const TemplateManifestSchema = Schema.Struct({
  title: Schema.String,
  tagline: Schema.String,
  intro: Schema.String,
  glance: Schema.Array(Schema.String),
  glanceClose: Schema.String,
  sections: Schema.optionalKey(Schema.Array(TemplateSectionSchema)),
  assistant: Schema.String,
  whatsInside: Schema.String,
  readmeSections: Schema.optionalKey(Schema.Array(TemplateSectionSchema)),
  whatToTry: Schema.optionalKey(Schema.String),
  env: Schema.Array(TemplateEnvEntrySchema),
})

export type TemplateManifest = typeof TemplateManifestSchema.Type
export type TemplateSection = typeof TemplateSectionSchema.Type
export type TemplateEnvEntry = typeof TemplateEnvEntrySchema.Type

/** The file name of the manifest inside `src/templates/<slug>/`. */
export const TEMPLATE_MANIFEST_FILE = 'template.yaml'

/** A `template.yaml` that is not YAML, or not the manifest shape. */
export class TemplateManifestError extends Data.TaggedError('TemplateManifestError')<{
  readonly message: string
}> {}

const decodeManifest = Schema.decodeUnknownResult(TemplateManifestSchema)

const parseYaml = (text: string): Result.Result<unknown, TemplateManifestError> => {
  try {
    return Result.succeed(Bun.YAML.parse(text) as unknown)
  } catch (error) {
    return Result.fail(
      new TemplateManifestError({
        message: `template.yaml is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
      })
    )
  }
}

/** Parse and decode a `template.yaml`, failing with a {@link TemplateManifestError}. */
export const decodeTemplateManifest = (
  text: string
): Result.Result<TemplateManifest, TemplateManifestError> =>
  Result.flatMap(parseYaml(text), (parsed) =>
    Result.mapError(
      decodeManifest(parsed),
      (issue) =>
        new TemplateManifestError({
          message: `template.yaml does not match the manifest shape: ${String(issue)}`,
        })
    )
  )
