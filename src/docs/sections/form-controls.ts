/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import formControlsAdvancedBody from '@/domain/models/app/pages/components/component-types/form-controls/form-controls-advanced.docs.md' with { type: 'file' }
import formControlsBody from '@/domain/models/app/pages/components/component-types/form-controls/form-controls.docs.md' with { type: 'file' }
import designConsoleComponentsBody from '@/domain/models/app/pages/components/component-types/specialty/design-console-components.docs.md' with { type: 'file' }
import specialtyComponentsBody from '@/domain/models/app/pages/components/component-types/specialty/specialty-components.docs.md' with { type: 'file' }
import { componentType } from './component-directives'
import { defineArticle, defineSection } from './define'

/**
 * Form Controls — the section manifest.
 *
 * Every `body` is imported `with { type: 'file' }`, so the value is a PATH and
 * the prose is never loaded until something reads it.
 *
 * `documents` is positional: its Nth entry is what the fragment's Nth
 * `sovrium:options` directive expands. Most sections fill it with imported
 * schemas, so deleting one fails `tsc` here. A component type cannot be
 * imported — it is a field bag rather than an exported schema — so its entry is
 * {@link componentType}, which throws on a name the catalogue does not hold.
 * `docs-structure.test.ts` asserts the round trip over all ninety names.
 */
export const section = defineSection({
  slug: 'form-controls',
  title: 'Form Controls',
  order: 3420,
  tab: 'pages',
  articles: [
    defineArticle({
      slug: 'form-controls',
      title: 'Text & Choice Controls',
      description:
        'The eleven text and choice inputs — input, input-group, textarea, rich-text-editor, code-editor, select, checkbox, radio-group, switch, toggle and toggle-group — plus the field wrapper that labels any of them.',
      keywords: ['sovrium', 'form controls', 'input', 'inputType', 'input-group', 'prefix'],
      order: 3420,
      sidebarLabel: 'Text & Choice Controls',
      body: formControlsBody,
      documents: [
        componentType('input'),
        componentType('input-group'),
        componentType('textarea'),
        componentType('rich-text-editor'),
        componentType('code-editor'),
        componentType('select'),
        componentType('checkbox'),
        componentType('radio-group'),
        componentType('switch'),
        componentType('toggle'),
        componentType('toggle-group'),
        componentType('field'),
      ],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-FORM-CONTROLS-CODE-EDITOR',
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-FORM-CONTROLS-INPUT-GROUP',
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-FORM-CONTROLS-RICH-TEXT-EDITOR',
        'US-PAGES-AUTH-FORM-NATIVE-STYLING',
        'US-PAGES-DIALOG-WRAPPING-A-FORM',
        'US-PAGES-FORM-CONTROLS-001',
        'US-PAGES-FORM-CONTROLS-002',
        'US-PAGES-FORM-CONTROLS-003',
        'US-PAGES-FORM-CONTROLS-004',
        'US-PAGES-FORM-CONTROLS-005',
        'US-PAGES-FORM-CONTROLS-006',
        'US-PAGES-FORM-CONTROLS-007',
        'US-PAGES-FORM-CONTROLS-008',
        'US-PAGES-FORM-CONTROLS-009',
        'US-PAGES-FORM-CONTROLS-010',
        'US-PAGES-FORM-CONTROLS-CONTROL-LABEL',
        'US-PAGES-FORM-CONTROLS-FIELD-COMPOSED-FORM-FIELD',
        'US-PAGES-FORM-CONTROLS-ONE-TIME-CODE',
        'US-PAGES-FORM-CONTROLS-SELECT-EMPTY-OPTION',
        'US-PAGES-FORM-CONTROLS-SELECT-NATIVE',
        'US-PAGES-FORM-CONTROLS-SELECT-OPTION-SOURCE',
      ],
    }),
    defineArticle({
      slug: 'form-controls-advanced',
      title: 'Date, Range & Record Controls',
      description:
        'The four remaining form controls — slider, date-picker, date-range-picker and record-picker.',
      keywords: [
        'sovrium',
        'slider',
        'date picker',
        'datePickerMode',
        'date range picker',
        'presets',
      ],
      order: 3424,
      sidebarLabel: 'Date & Record Controls',
      body: formControlsAdvancedBody,
      documents: [
        componentType('slider'),
        componentType('date-picker'),
        componentType('date-range-picker'),
        componentType('record-picker'),
      ],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-FORM-CONTROLS-DATE-RANGE-PICKER',
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-FORM-CONTROLS-GAPS',
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-FORM-CONTROLS-RECORD-PICKER',
      ],
    }),
    defineArticle({
      slug: 'specialty-components',
      title: 'Specialty Components',
      description:
        'The focused-use-case types — reorderable-list, language-switcher, file-upload, number-input and time-picker.',
      keywords: [
        'sovrium',
        'reorderable list',
        'language switcher',
        'file upload',
        'number input',
        'time picker',
      ],
      order: 3428,
      sidebarLabel: 'Specialty Components',
      body: specialtyComponentsBody,
      documents: [
        componentType('reorderable-list'),
        componentType('file-upload'),
        componentType('number-input'),
        componentType('time-picker'),
      ],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-SPECIALTY',
        'US-PAGES-FORM-CONTROLS-FILE-UPLOAD-001',
        'US-PAGES-FORM-CONTROLS-FILE-UPLOAD-002',
        'US-PAGES-FORM-CONTROLS-FILE-UPLOAD-003',
        'US-PAGES-FORM-CONTROLS-NUMBER-INPUT',
        'US-PAGES-FORM-CONTROLS-TIME-PICKER',
        'US-PAGES-INTERACTIVITY-REORDERABLE-LIST',
      ],
    }),
    defineArticle({
      slug: 'design-console-components',
      title: 'Design-Console Components',
      description:
        'The three types that document a design system rather than build a feature — specimen, field-specimen and preview.',
      keywords: [
        'sovrium',
        'specimen',
        'field specimen',
        'preview',
        'design system',
        'design console',
      ],
      order: 3430,
      sidebarLabel: 'Design Console',
      body: designConsoleComponentsBody,
      documents: [
        componentType('specimen'),
        componentType('field-specimen'),
        componentType('preview'),
      ],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-SPECIALTY-PREVIEW',
        'US-PAGES-DESIGN-CONSOLE-EASING-CURVE',
        'US-PAGES-DESIGN-CONSOLE-FIELD-SPECIMEN',
        'US-PAGES-DESIGN-CONSOLE-PRIMITIVES',
        'US-PAGES-DESIGN-CONSOLE-RECORD-REFS-IN-ROW-TEMPLATES',
        'US-PAGES-DESIGN-CONSOLE-SPECIMEN-SUBJECT',
      ],
    }),
  ],
})
