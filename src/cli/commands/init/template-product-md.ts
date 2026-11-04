/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Render a project's `PRODUCT.md`: the product record a design agent reads
 * before its DESIGN.md.
 *
 * It says only what the configuration (or a template's `template.yaml`) says,
 * and marks everything else as not recorded yet rather than inventing it: who
 * the users are when no template names its audience, the evidence on hand. A
 * template's audience is the Users section, its tagline and intro the purpose,
 * and its glance bullets the capabilities. The heading set and the schema comment
 * on the second line are the format's; Platform is the bare word `web`.
 *
 * `sovrium design-system --format design-md --output <file>` writes it when the
 * folder has none, and never replaces one.
 */

import { renderGlanceBullet } from './template-claude-md'
import type { TemplateManifest } from './template-manifest'

/** What a PRODUCT.md is drawn from. */
export interface ProductMdInput {
  /** The app name, from the config. */
  readonly appName: string
  /** The app description, from the config. */
  readonly description?: string
  /** The template's manifest, when the project was scaffolded from one. */
  readonly manifest?: TemplateManifest
  /** The config file's name, such as `app.yaml`. */
  readonly entryFile: string
  /** Whether a `config/` folder sits beside the config file. */
  readonly hasConfigDir: boolean
  /** `design.voice.pronoun`, when the config declares one. */
  readonly pronoun?: string
  /** Whether the config declares `design.logo`. */
  readonly hasLogo?: boolean
}

/** One section: `## <heading>`, a blank line, the body, a blank line. */
const section = (heading: string, body: string): string => `## ${heading}\n\n${body}\n`

/** What the product is for: the template's tagline and intro, else the config's description. */
const purposeOf = (input: ProductMdInput): string => {
  if (input.manifest !== undefined) {
    return `${input.manifest.tagline.trim()}\n\n${input.manifest.intro.trim()}`
  }
  const description = input.description?.trim() ?? ''
  return description.length > 0
    ? description
    : `Not recorded yet. Write what ${input.appName} does and what success means.`
}

/** Who the product is for: the template's audience, else marked as not recorded. */
const usersOf = (input: ProductMdInput): string => {
  const audience = input.manifest?.audience.trim() ?? ''
  return audience.length > 0
    ? audience
    : `Not recorded yet. Write who uses ${input.appName} and the job they come to do; nothing here is inferred from the configuration.`
}

/** What it does: the template's glance bullets, then the one constraint every app shares. */
const capabilitiesOf = (input: ProductMdInput): string => {
  const shared = `Every page, table and automation of ${input.appName} is declared in its configuration and run by the Sovrium binary; there is no application code to change.`
  const glance = input.manifest?.glance ?? []
  return glance.length > 0 ? `${glance.map(renderGlanceBullet).join('')}\n${shared}` : shared
}

/** The brand commitments the config declares: the name, the pronoun, the logo. */
const brandOf = (input: ProductMdInput): string =>
  [
    `The product is named ${input.appName}.`,
    ...(input.pronoun === undefined ? [] : [`Copy addresses the reader as "${input.pronoun}".`]),
    ...(input.hasLogo === true ? ['Its logo is declared under `design.logo`.'] : []),
  ].join(' ')

/** The PRODUCT.md text. */
export const renderProductMd = (input: ProductMdInput): string =>
  [
    '# Product\n\n<!-- impeccable:product-schema 1 -->\n',
    section('Platform', 'web'),
    section(
      'Stack',
      `Sovrium configuration (${input.entryFile}${input.hasConfigDir ? ' + config/' : ''}), rendered by the Sovrium binary on shadcn/ui base-nova; there is no hand-written front-end.`
    ),
    section('Users', usersOf(input)),
    section('Product Purpose', purposeOf(input)),
    section('Capabilities and Constraints', capabilitiesOf(input)),
    section('Brand Commitments', brandOf(input)),
    section(
      'Evidence on Hand',
      'Not recorded yet. Record real content, data and assets with their paths; do not invent customers, testimonials, figures or claims.'
    ),
  ]
    .join('\n')
    .replace(/\n+$/, '\n')
