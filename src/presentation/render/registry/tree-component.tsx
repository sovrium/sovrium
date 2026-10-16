/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `tree` SSR host — the placeholder the tree island mounts into.
 *
 * The rows are read by the island from the records API (through the bound view
 * when there is one), so what the tree nests is what that API answers the
 * reader. The host carries the island's props and a loading line at the size
 * of one row, so the page does not jump when the nodes arrive.
 */

import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { cn } from '@/presentation/design/class-merge'
import { localizeChildLabel } from './island-child-label'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'

interface TreeRoot {
  readonly dataSource?: unknown
  readonly parentField?: string
  readonly labelField?: string
  readonly iconField?: string
  readonly countField?: string
  readonly sortBy?: unknown
  readonly expanded?: number
  readonly search?: boolean
  readonly onSelect?: unknown
  readonly publishes?: unknown
  readonly emptyMessage?: string
}

/**
 * The words the tree draws itself, in the page language and with its name
 * already filled in. Unlike the other islands' `uiStrings` — only the strings
 * that differ from English — the tree is handed every one, because the island
 * carries no English of its own: its mount budget has no room for a fallback.
 */
const treeUiStrings = (
  label: string,
  lang: string | undefined,
  languages: Languages | undefined,
  authored: boolean
): Readonly<Record<string, string>> => {
  const word = (key: string, name = label): string =>
    fillPlaceholders(resolveInterpreterString(key, lang, languages), { label: name })
  return {
    'tree.loading': word('tree.loading'),
    'tree.empty': word('tree.empty'),
    // Inside a sentence the engine's own name is a common noun, lower-cased with its
    // article (`tree.labelInSentence`); an author's label is a name, kept as written.
    'tree.loadFailed': word(
      'tree.loadFailed',
      authored || label !== resolveInterpreterString('tree.label', lang, undefined)
        ? label
        : word('tree.labelInSentence')
    ),
    'tree.filter': word('tree.filter'),
    'tree.filterLabel': word('tree.filterLabel', label.toLocaleLowerCase(lang)),
  }
}

export const treeComponent: ComponentRenderer = ({
  component,
  elementProps,
  currentLang,
  languages,
}) => {
  const root = (component ?? {}) as TreeRoot
  const authoredLabel = elementProps['aria-label']
  const label =
    typeof authoredLabel === 'string'
      ? authoredLabel
      : resolveInterpreterString('tree.label', currentLang, languages)
  const uiStrings = treeUiStrings(label, currentLang, languages, typeof authoredLabel === 'string')
  const islandProps = {
    dataSource: root.dataSource,
    parentField: root.parentField,
    labelField: root.labelField,
    iconField: root.iconField,
    countField: root.countField,
    sortBy: root.sortBy,
    expanded: root.expanded,
    search: root.search,
    onSelect: root.onSelect,
    publishes: root.publishes,
    ...(root.emptyMessage !== undefined && {
      emptyMessage: localizeChildLabel(root.emptyMessage, currentLang, languages),
    }),
    label,
    uiStrings,
  }
  return (
    <div
      id={elementProps['id'] as string | undefined}
      data-testid={elementProps['data-testid'] as string | undefined}
      data-component-type="tree"
      data-island="tree"
      data-island-props={JSON.stringify(islandProps)}
      className={cn('flex flex-col gap-2', elementProps['className'] as string | undefined)}
    >
      <p
        aria-busy="true"
        className="text-muted-foreground h-8 text-sm"
      >
        {uiStrings['tree.loading']}
      </p>
    </div>
  )
}
