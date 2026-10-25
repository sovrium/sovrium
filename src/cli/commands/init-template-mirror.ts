/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two files only a template's published repository carries:
 * `README.md` and the MIT `LICENSE`.
 *
 * Every release mirrors each template to `github.com/sovrium/<slug>-template`.
 * Those two files are statements about THAT repository — where it comes from,
 * how to use it, under which licence it is offered — so `sovrium init` never
 * writes them into a user's project.
 *
 * The README has one fixed outline: the title and tagline, a "Built with
 * Sovrium" line, then "Use this template", "What's inside" (the manifest's),
 * any extra sections of the manifest, "What to try" when the manifest has one,
 * and three sections rendered from facts alone: "Run locally", "Deploy" and
 * "About this repository".
 */

import type { TemplateFacts } from './init-template-facts'
import type { TemplateManifest } from './init-template-manifest'

/** Where the template sources live in the engine repository. */
const TEMPLATE_SOURCE_ROOT = 'src/templates'
const ENGINE_REPOSITORY = 'https://github.com/sovrium/sovrium'

const section = (heading: string, body: string): string => `## ${heading}\n\n${body}\n`

const fence = (lines: readonly string[]): string => ['```bash', ...lines, '```'].join('\n')

const titleBlock = (manifest: TemplateManifest): string => {
  const tagline = manifest.tagline
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
  return [
    `# ${manifest.title}`,
    '',
    tagline,
    '',
    'Built with [Sovrium](https://sovrium.com) — a configuration-as-code interpreter: one config',
    'file in, a complete self-hosted web application out.',
    '',
  ].join('\n')
}

const useThisTemplate = (slug: string): string =>
  section(
    'Use this template',
    [
      'Click **Use this template** on GitHub to copy this app into your own repository (clean',
      'history, yours to modify), or scaffold it locally:',
      '',
      fence([
        'curl -fsSL https://sovrium.com/install | sh',
        `sovrium init my-${slug} --template ${slug}`,
      ]),
    ].join('\n')
  )

const runLocally = (facts: TemplateFacts): string =>
  section(
    'Run locally',
    [
      fence([
        'curl -fsSL https://sovrium.com/install | sh',
        'cp .env.example .env',
        ...(facts.hasSeed
          ? ['sovrium seed app.yaml        # needs SOVRIUM_SEED_PASSWORD in .env']
          : []),
        'sovrium start app.yaml --watch',
      ]),
      '',
      'Zero-config: embedded SQLite, local file storage, no variable required to boot.',
      '[`.env.example`](./.env.example) lists the optional ones this app reads.',
      ...(facts.hasAuth
        ? [
            'The first administrator comes from `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD` on the',
            'first start, or from `sovrium admin create <email>`.',
          ]
        : []),
      '`--watch` reloads the app each time you save a config file.',
    ].join('\n')
  )

const deploy = (facts: TemplateFacts): string =>
  section(
    'Deploy',
    [
      'Ship it to Sovrium Cloud from this directory: sign in once, then deploy. The CLI finds or',
      'creates the app it deploys to, checks the variables it needs, bundles and uploads it, and',
      'ends only once the app answers at its address.',
      '',
      fence(['sovrium login', 'sovrium deploy']),
      '',
      'Any other host works the same way: run the `sovrium` binary with this config (see the',
      '[deployment guides](https://sovrium.com/en/docs/installation)).',
      ...(facts.hasSeed
        ? [
            '',
            '> **The demo accounts are for trying the app, not for running it.** The seed gives every',
            '> account it creates, the admin included, the one password in `SOVRIUM_SEED_PASSWORD`, and',
            '> their addresses are in `seed/`. Before anyone else can reach the app, choose a long',
            '> password or skip the seed, and change or delete the demo admin.',
          ]
        : []),
    ].join('\n')
  )

const aboutThisRepository = (slug: string): string =>
  section(
    'About this repository',
    [
      'This repository is **auto-published from the',
      `[Sovrium monorepo](${ENGINE_REPOSITORY})** on every release`,
      `(source: [\`${TEMPLATE_SOURCE_ROOT}/${slug}\`](${ENGINE_REPOSITORY}/tree/main/${TEMPLATE_SOURCE_ROOT}/${slug})).`,
      'Issues are welcome here; please send code contributions upstream to the monorepo so the',
      'template stays in sync with the engine. The pinned engine release lives in',
      '`.sovrium-version`.',
      '',
      'License: [MIT](./LICENSE). The Sovrium engine itself is licensed separately',
      `([BSL 1.1](${ENGINE_REPOSITORY}/blob/main/LICENSE.md)).`,
    ].join('\n')
  )

/** The `README.md` of a template's published repository. */
export const renderTemplateReadme = (
  manifest: TemplateManifest,
  facts: TemplateFacts,
  slug: string
): string =>
  [
    titleBlock(manifest),
    useThisTemplate(slug),
    section("What's inside", manifest.whatsInside.replace(/\n$/, '')),
    ...(manifest.readmeSections ?? []).map((extra) =>
      section(extra.heading, extra.body.replace(/\n$/, ''))
    ),
    ...(manifest.whatToTry === undefined
      ? []
      : [section('What to try', manifest.whatToTry.replace(/\n$/, ''))]),
    runLocally(facts),
    deploy(facts),
    aboutThisRepository(slug),
  ]
    .join('\n')
    .replace(/\n+$/, '\n')

/** The MIT licence every published template repository carries. */
export const TEMPLATE_LICENSE_MIT = [
  'MIT License',
  '',
  'Copyright (c) 2025-2026 ESSENTIAL SERVICES',
  '',
  'Permission is hereby granted, free of charge, to any person obtaining a copy',
  'of this software and associated documentation files (the "Software"), to deal',
  'in the Software without restriction, including without limitation the rights',
  'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
  'copies of the Software, and to permit persons to whom the Software is',
  'furnished to do so, subject to the following conditions:',
  '',
  'The above copyright notice and this permission notice shall be included in all',
  'copies or substantial portions of the Software.',
  '',
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
  'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
  'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
  'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
  'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
  'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
  'SOFTWARE.',
  '',
].join('\n')
