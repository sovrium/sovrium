/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Ambient declaration for the generated operation sets,
 * `src/library/generated/<provider>.json.gz`.
 *
 * They are imported `with { type: 'file' }` ONLY: Bun embeds the bytes in the
 * compiled binary and hands back a path (a real one in dev, `/$bunfs/…` in the
 * binary), and `Bun.file()` reads either. Imported without the attribute, Bun
 * would try to evaluate a gzip stream as a module. The shim cannot enforce the
 * attribute; the `Library Operations` gate loads every set through the real
 * loader, which is the runtime half.
 */
declare module '*.json.gz' {
  /** Absolute path to the gzipped set. */
  const path: string
  export default path
}
