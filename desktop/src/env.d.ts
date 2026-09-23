/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The engine's template catalogue, inlined at build time.
 *
 * Produced by `vite-plugin-templates.ts` from `templates/catalog.json` at the
 * repository root — the engine's own description of what it ships embedded.
 * Declared here because a virtual module has no file for TypeScript to read.
 */
declare module 'virtual:sovrium-templates' {
  export interface TemplateEntry {
    readonly name: string
    readonly description: string
    readonly category: string
    readonly topics: readonly string[]
  }
  /** Slug → template. The slug is what `sovrium init --template` takes. */
  export const templates: Readonly<Record<string, TemplateEntry>>
}
