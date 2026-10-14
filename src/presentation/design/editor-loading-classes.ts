/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The stand-ins the `rich-text-editor` and `code-editor` islands draw while
 * their editor downloads: the input group's edge and radius at rest, and
 * nothing more.
 *
 * A leaf module on purpose. The editors' own recipes import the input group
 * and button recipes; a loading control importing from them would put those
 * modules in a chunk shared with the editor, on the island's mount path.
 */

/** The rich-text editor's stand-in, the body's height and padding. */
export const computeRichTextLoadingClasses = (): string =>
  'min-h-14 w-full rounded-lg border border-input px-2.5 py-2 text-sm text-muted-foreground'

/** The code editor's stand-in, the source in the mono face. */
export const computeCodeEditorLoadingClasses = (): string =>
  'w-full overflow-hidden rounded-lg border border-input p-2.5 font-mono text-sm text-muted-foreground'
