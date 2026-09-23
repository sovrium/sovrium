/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE place a generated import specifier or manifest key is spelled.
 *
 * ## The defect this exists to make impossible
 *
 * Four generators emit `with { type: 'file' }` import specifiers into `src/`,
 * and every one of them derives the path from `path.relative()` /
 * `path.join()`. Those return the **platform** separator, which on Windows is
 * a backslash — and a backslash inside a JavaScript string literal is an
 * ESCAPE character, not a path component. So a template that resolves on disk
 * as `templates\api-only\config\tables\projects.yaml` is written into the
 * generated module as
 *
 * ```ts
 * import _a1 from '../../../templates\api-only\config\tables\projects.yaml' with { type: 'file' }
 * ```
 *
 * which the bundler reads as `../../../templates/api-onlyconfig<TAB>ablesprojects.yaml`:
 * `\a` and `\c` are IDENTITY escapes, so the backslash simply vanishes and the
 * two path components fuse; `\t` is a TAB. Every one of the three is a legal
 * string literal, so nothing warns — the file simply fails to resolve, several
 * generators later, with an error naming a path that appears nowhere in the
 * repository. `[internal ref]` reproduces all four verbatim.
 *
 * Measured, not hypothetical: the v0.27.0 GitHub release built on macOS, Linux
 * x64/arm64 and Docker and failed on `windows-latest` inside `build:binary`
 * with exactly those four lines, leaving the release a draft with four of five
 * engine binaries. The COMMITTED generated files were correct, because they
 * were produced on macOS; the Windows lane regenerates them, because
 * `build-binary.ts` runs every generator whose sources are present.
 *
 * ## Why the normalisation is unconditional rather than `sep`-gated
 *
 * The idiom this replaces was `relative(a, b).split(sep).join('/')`, which is
 * correct on Windows and a **no-op on POSIX**, where `sep` is already `/`. That
 * makes the fix untestable on the machine every developer and four of five CI
 * lanes actually use: a unit test feeding it a `path.win32`-shaped input passes
 * vacuously on macOS, since the backslashes survive untouched. Replacing `\`
 * unconditionally is what makes the property testable where it is developed.
 *
 * It costs nothing real. A backslash is a legal filename character on POSIX,
 * but no file in this repository carries one, and a file that did could not be
 * embedded anyway — the specifier would be corrupt in exactly the way above.
 * Normalising it is strictly better than emitting it.
 */

import { relative, sep } from 'node:path'

/**
 * A path rendered with forward slashes, whichever separator produced it.
 *
 * Both separators are folded, not just {@link sep}: see the module docblock for
 * why gating on the platform separator makes the fix untestable on POSIX.
 */
export const toPosixPath = (value: string): string =>
  value.replaceAll('\\', '/').split(sep).join('/')

/**
 * {@link relative}, rendered POSIX.
 *
 * This is the shape every manifest KEY takes — `crm/app.yaml`,
 * `sovrium/mark-light-outline.svg`, `island-chunks/data-table-a1b2c3.js`. The
 * key matters as much as the specifier: a Windows-generated
 * `templates\api-only\app.yaml` key is a lookup that never resolves at
 * runtime, and unlike the specifier it fails silently rather than at build
 * time.
 */
export const posixRelative = (from: string, to: string): string => toPosixPath(relative(from, to))

/**
 * The full text of a generated relative import specifier.
 *
 * Every segment is normalised and the result is asserted to be relative, so a
 * caller that hands over an absolute path — or a path that has escaped its own
 * root — fails here rather than several minutes later inside `bun build
 * --compile`.
 *
 * @param relRoot the generated file's own way back to the repository root, e.g.
 *   `'../../..'` for a module in `src/infrastructure/assets/`
 * @param segments path segments below that root, in any separator
 */
export const fileImportSpecifier = (relRoot: string, ...segments: readonly string[]): string => {
  const specifier = [relRoot, ...segments]
    .map(toPosixPath)
    .filter((segment) => segment.length > 0)
    .join('/')
    .replaceAll(/\/{2,}/g, '/')
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    throw new Error(
      `Generated import specifier is not relative: ${specifier}. A \`with { type: 'file' }\` ` +
        `import is resolved from the generated module's own directory, so an absolute or ` +
        `bare specifier would embed nothing (or the wrong file) in the compiled binary.`
    )
  }
  return specifier
}
