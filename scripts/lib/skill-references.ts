/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The catalogue references the Agent Skills carry, GENERATED from the schema
 * the binary ships ([internal ref] A2).
 *
 * A lightweight list on its own so `Generated Assets Drift` can name each file
 * without importing the generator, which loads the whole app schema to render
 * them. `scripts/build/generate-skill-references.ts` asserts it writes exactly
 * these files and no others.
 *
 * Synopses are not addresses. The Usage column of `cli-verbs.generated.md`
 * prints each verb's SYNOPSIS (`sovrium docs [address] [options]`,
 * `sovrium docs <subcommand> <argument>`), and `Skills Reference Drift`
 * resolves every other
 * `sovrium docs …` span through the renderer. It skips a line carrying a
 * `<placeholder>` or a ` [bracketed]` argument — judged on the raw line, since
 * the shared tokenizer reads `>` as a redirect — the precedent being
 * `isPlaceholderCommand` in `Docs CLI Command Drift`.
 */
export const SKILL_REFERENCE_FILES: readonly string[] = [
  'src/skills/sovrium-app/references/cli-verbs.generated.md',
  'src/skills/sovrium-data-model/references/field-types.generated.md',
  'src/skills/sovrium-pages/references/component-catalogue.generated.md',
  'src/skills/sovrium-automations/references/triggers-and-actions.generated.md',
  'src/skills/sovrium-seo-geo/references/seo-options.generated.md',
]
