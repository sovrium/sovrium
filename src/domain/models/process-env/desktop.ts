/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as path from 'node:path'

/**
 * The project directory: where the app being run actually lives.
 *
 * A supervising process — a desktop shell, a systemd unit, a CI step — knows
 * which folder holds the app but does not get to choose the working directory
 * the binary is launched from. `SOVRIUM_PROJECT_DIR` lets it say so without a
 * `cd`, and `SOVRIUM_CONFIG_FILE` names the file within that folder.
 *
 * Both are ENVIRONMENT, never schema. Nothing about how an app is supervised
 * enters `AppSchema`, so a config authored under a shell runs unchanged in
 * Docker, on a server and in CI.
 *
 * ### The engine resolves; it never `chdir`s
 *
 * `process.chdir()` would be a process-global mutation that silently relocates
 * every other cwd-relative resolution at once — a relative positional argument,
 * a relative `SOVRIUM_DATA_DIR`, a relative `SOVRIUM_PUBLIC_DIR` — and whether
 * it did so correctly would depend on the order those happened to be read. The
 * project directory is therefore resolved explicitly at each site that needs
 * it, which is what the helpers below are for.
 *
 * Plain functions over `process.env`, deliberately: these are paths rather than
 * decoded documents, and `data-dir.ts` next door is the precedent they have to
 * agree with.
 */

/**
 * The project root, as an absolute path.
 *
 * `SOVRIUM_PROJECT_DIR` when set and non-empty, otherwise the process working
 * directory — so every existing invocation resolves exactly where it resolves
 * today.
 *
 * @public
 */
export const parseProjectDir = (): string => path.resolve(process.env.SOVRIUM_PROJECT_DIR || '.')

/**
 * The project root ONLY when a supervisor explicitly named one.
 *
 * This is the distinction that keeps the `$ref` jail from being a breaking
 * change. {@link parseProjectDir} falls back to the working directory, which is
 * the right default for *resolving* a path; it is the wrong default for
 * *confining* one, because a config legitimately loaded from outside the cwd
 * (`sovrium start ../other/app.yaml`, every E2E fixture in `tmpdir()`) pulls in
 * `$ref`s outside the cwd too. Jailing against the implicit default would
 * refuse all of them.
 *
 * So the jail exists only where something asked for it: when a supervisor hands
 * over a folder, it is also declaring that the folder is the whole of what the
 * engine may read.
 *
 * @public
 */
export const parseProjectDirJail = (): string | undefined => {
  const declared = process.env.SOVRIUM_PROJECT_DIR
  return declared ? path.resolve(declared) : undefined
}

/**
 * The config filename inside the project root, when one was named.
 *
 * `undefined` when unset or empty, so the caller keeps its ordinary
 * `app.yaml` → `app.yml` → `app.ts` candidate probe. This is a REPLACEMENT for
 * that probe, not an addition to it: naming a file means that file, and a
 * fallback to a different one would silently boot something the supervisor did
 * not ask for.
 *
 * @public
 */
export const parseConfigFileName = (): string | undefined =>
  process.env.SOVRIUM_CONFIG_FILE || undefined

/**
 * Whether closing the server's stdin should stop it, the way a signal does.
 *
 * OPT-IN, and that is the whole design. Windows has no SIGTERM, so a supervisor
 * on it has no portable way to ask a child to stop — closing the child's stdin
 * is the portable equivalent. But a server is routinely launched with stdin
 * ALREADY closed (`nohup`, systemd, a CI step, `sovrium start &`), and under
 * those an unconditional EOF handler would kill the server the instant it
 * booted. So the trigger exists only where a supervisor that keeps stdin open
 * asked for it.
 *
 * It ADDS a stop trigger; it replaces nothing. SIGINT and SIGTERM keep working
 * exactly as they do today, and both paths run the same graceful stop.
 *
 * @public
 */
export const parseShutdownOnStdinClose = (): boolean =>
  process.env.SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE === '1'

/**
 * True when `candidate` (absolute) is `root` itself or sits beneath it.
 *
 * Pure path arithmetic, with no `realpath`: both sides are compared in the form
 * they were given, so a symlinked temp directory (`/var` → `/private/var` on
 * macOS) does not read as an escape merely because one side was canonicalised
 * and the other was not. The cost of that choice is recorded where it bites — a
 * symlink INSIDE the root pointing out of it reads as contained, so this
 * confines the path graph rather than the inode graph.
 *
 * BOTH clauses of the negative are load-bearing, which is the reason this is
 * shared rather than re-typed at each site. `..` catches the ordinary escape;
 * `isAbsolute` catches the one that has no `..` in it at all — on Windows,
 * `path.relative('C:\\p', 'D:\\other')` returns `D:\other`, and a check that
 * tested only the prefix would read a different drive as contained.
 *
 * @public
 */
export const isPathWithin = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

/**
 * Resolve `candidate` against the project directory, refusing any result that
 * escapes it.
 *
 * `undefined` IS the refusal — there is no thrown error here, because the two
 * callers word their refusals differently (one names `SOVRIUM_CONFIG_FILE`, the
 * other names the offending `$ref`) and a shared message would serve neither.
 *
 * An absolute `candidate` is handled by the same rule rather than by a special
 * case: `path.resolve` returns it unchanged, and it is then inside the root or
 * it is not. That is what lets the `$ref` jail — which only ever sees paths
 * already resolved against their own file's directory — consume this too.
 *
 * @public
 */
export const resolveInProjectDir = (candidate: string): string | undefined => {
  const root = parseProjectDir()
  const resolved = path.resolve(root, candidate)
  return isPathWithin(root, resolved) ? resolved : undefined
}

/**
 * Refuse a path that escapes an explicitly declared project root.
 *
 * Returns `undefined` when no root was declared — i.e. the jail is closed only
 * where a supervisor opened it. See {@link parseProjectDirJail}.
 *
 * @public
 */
export const findProjectJailEscape = (
  absolutePath: string
): { readonly root: string; readonly escaped: string } | undefined => {
  const root = parseProjectDirJail()
  if (!root) return undefined
  return isPathWithin(root, absolutePath) ? undefined : { root, escaped: absolutePath }
}
