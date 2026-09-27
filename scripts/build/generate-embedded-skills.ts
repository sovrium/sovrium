/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codegen: ship the Agent Skills inside the compiled binary ([internal ref] A2).
 *
 * One generated module, `embedded-skills.generated.ts`: every skill's
 * `SKILL.md` and every file one level under its `references/`, imported
 * `with { type: 'file' }` and keyed `EMBEDDED_SKILLS[<name>][<relative path>]`.
 * `sovrium init` and `sovrium skills` write them into a project; the config MCP
 * serves them as prompts. Nothing here is on the `sovrium start` boot path.
 *
 * ## What it refuses, and why it refuses rather than skips
 *
 * - A skill directory with no `SKILL.md`, or whose name is not kebab-case. The
 *   format discovers a skill BY that file, under a directory named as the
 *   skill, so shipping anything else would write a directory no host loads.
 * - When handed the DECLARED list (`LAYER_CHILDREN.skills` in
 * `[internal ref]`), any difference in either direction: an undeclared
 *   directory would ship unannounced, a declared skill with no directory would
 *   be missing from every project `sovrium init` writes.
 *
 * ## Why this module does not import the declared list itself
 *
 * `scripts/build/` ships in the public mirror and `build-binary.ts` runs this
 * generator there, while `[internal ref]` is an EXCLUDED path in `filtered-mirror.sh`
 * — `[internal ref]` would report the import as a hole and
 * abort the release. So the declared list is a PARAMETER: the generator's test
 * passes `LAYER_CHILDREN.skills` and holds the payload to it both ways, and
 * `Layout Drift` fails an undeclared skill directory on its own
 * (`layer-child-not-in-manifest`). The build keeps the checks that need no
 * manifest.
 *
 * `evals/` is never embedded: evaluations are internal fixtures that describe
 * how the skill is tested, not what a user's agent should read.
 *
 * ## Why the prose is not inlined
 *
 * The CSS-harvest reason, shared with the manual and written once in
 * `[internal ref]`.
 *
 * Regenerate after adding, moving or deleting a skill file:
 *   bun run build:skills            (writes the module)
 *   bun run build:skills --check    (exit 1 when the committed module is stale)
 * (also run by `build:binary`.)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO_ROOT, walkSync } from '../lib/drift/walk'
import { generatedModuleHeader, renderFileImports } from '../lib/embedded-file-module'
import { posixRelative } from '../lib/posix-path'

/** The module this generator writes, root-parameterized for tests and the build. */
export const skillsPayloadPaths = (root: string): { readonly manifest: string } => ({
  manifest: join(root, 'src', 'infrastructure', 'assets', 'embedded-skills.generated.ts'),
})

/** Import paths in the generated module are relative to `src/infrastructure/assets/`. */
const REL_ROOT = '../../..'

/** Thrown for a tree the payload must not be built from. */
export class SkillsTreeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillsTreeError'
  }
}

/** A skill name: the format's own rule, which is the layout law's kebab-case. */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** What ships from one skill directory: its entry file and one-level references. */
const isShippedSkillFile = (path: string): boolean =>
  /^src\/skills\/[^/]+\/(?:SKILL\.md|references\/[^/]+\.md)$/.test(path)

/**
 * Every file the binary ships for every skill, repo-relative and sorted, after
 * checking the tree against the declared list in BOTH directions.
 *
 * @param root - The repository root to read `src/skills/` under.
 * @param declared - When given, the skill names the layout manifest publishes,
 *   and the tree must match it in both directions.
 * @throws {SkillsTreeError} on a missing tree, a non-kebab or `SKILL.md`-less
 *   skill directory, or a disagreement with `declared`.
 */
export const collectSkillFiles = (
  root: string,
  declared?: readonly string[]
): readonly string[] => {
  const skillsRoot = join(root, 'src', 'skills')
  if (!existsSync(skillsRoot)) {
    throw new SkillsTreeError('src/skills/ does not exist, so the binary would ship no skills.')
  }
  const all = walkSync({ root: skillsRoot }).map((absolute) => posixRelative(root, absolute))
  const onDisk = [...new Set(all.map((path) => path.split('/')[2] ?? ''))].toSorted()

  const badNames = onDisk.filter((name) => !KEBAB.test(name))
  if (badNames.length > 0) {
    throw new SkillsTreeError(
      `Skill director(y/ies) not named in kebab-case: ${badNames.join(', ')}. A skill's ` +
        'directory is its published name.'
    )
  }
  const undeclared = declared === undefined ? [] : onDisk.filter((name) => !declared.includes(name))
  const absent = declared === undefined ? [] : declared.filter((name) => !onDisk.includes(name))
  if (undeclared.length > 0 || absent.length > 0) {
    throw new SkillsTreeError(
      `The skills tree and LAYER_CHILDREN.skills (eslint/layout.ts) disagree — undeclared: ` +
        `${undeclared.join(', ') || 'none'}; declared but absent: ${absent.join(', ') || 'none'}.`
    )
  }
  const withoutEntry = onDisk.filter((name) => !all.includes(`src/skills/${name}/SKILL.md`))
  if (withoutEntry.length > 0) {
    throw new SkillsTreeError(
      `Declared skill(s) with no SKILL.md: ${withoutEntry.join(', ')}. The format discovers a ` +
        'skill by that file, so a directory without it is not a skill.'
    )
  }
  return all.filter(isShippedSkillFile).toSorted((a, b) => a.localeCompare(b))
}

/** The generated module, as text. */
export const renderSkillsModule = (paths: readonly string[]): string => {
  const { imports, identifierOf } = renderFileImports(paths, { prefix: '_s', relRoot: REL_ROOT })
  const byName = Map.groupBy(paths, (path) => path.split('/')[2] ?? '')
  const entries = [...byName.entries()]
    .map(([name, files]) => {
      const inner = files
        .map((path) => {
          const relative = path.slice(`src/skills/${name}/`.length)
          return `    ${JSON.stringify(relative)}: ${identifierOf(path)},`
        })
        .join('\n')
      return `  ${JSON.stringify(name)}: {\n${inner}\n  },`
    })
    .join('\n')
  return `${generatedModuleHeader(
    'scripts/build/generate-embedded-skills.ts',
    "Each `with { type: 'file' }` import embeds one skill file into the compiled\n" +
      '// binary and resolves to its on-disk path in dev/bundled mode.'
  )}
${imports}

export const EMBEDDED_SKILLS = {
${entries}
}
`
}

if (import.meta.main) {
  const check = process.argv.includes('--check')
  const { manifest } = skillsPayloadPaths(REPO_ROOT)
  const paths = collectSkillFiles(REPO_ROOT)
  const rendered = renderSkillsModule(paths)
  const skills = new Set(paths.map((path) => path.split('/')[2])).size
  if (check) {
    const committed = existsSync(manifest) ? readFileSync(manifest, 'utf8') : ''
    if (committed !== rendered) {
      console.log(
        'embedded-skills.generated.ts is stale — run `bun run build:skills` and commit the result.'
      )
      process.exit(1)
    }
    console.log(
      `embedded-skills.generated.ts is current — ${skills} skill(s), ${paths.length} file(s)`
    )
  } else {
    writeFileSync(manifest, rendered)
    console.log(`embedded-skills.generated.ts — ${skills} skill(s), ${paths.length} file(s)`)
  }
}
