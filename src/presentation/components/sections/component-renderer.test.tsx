/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { ComponentRenderer } from './component-renderer'

describe('ComponentRenderer - Variable Substitution', () => {
  test('should substitute variables in block reference', () => {
    const blocks = [
      {
        name: 'hero',
        type: 'section',
        props: { id: 'hero' },
        children: [{ type: 'h1', children: ['$title'] }],
      },
    ]

    const component = {
      block: 'hero',
      vars: { title: 'Welcome to Our Platform' },
    }

    const html = renderToString(
      <ComponentRenderer
        component={component}
        blocks={blocks}
      />
    )

    expect(html).toContain('Welcome to Our Platform')
    expect(html).not.toContain('$title')
  })
})

describe('ComponentRenderer - Translation Fallback', () => {
  test('should render French translation when currentLang is fr-FR', () => {
    const languages = {
      default: 'en',
      fallback: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' as const },
        { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' as const },
      ],
      translations: {
        en: {
          'common.save': 'Save',
          'common.cancel': 'Cancel',
        },
        fr: {
          'common.save': 'Enregistrer',
          // 'common.cancel' is missing
        },
      },
    }

    const component = {
      type: 'button' as const,
      children: ['$t:common.save'],
    }

    const html = renderToString(
      <ComponentRenderer
        component={component}
        languages={languages}
        currentLang="fr-FR"
      />
    )

    expect(html).toContain('>Enregistrer</button>')
    expect(html).not.toContain('>Save</button>')
  })

  test('should fall back to English when French translation is missing', () => {
    const languages = {
      default: 'en',
      fallback: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' as const },
        { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' as const },
      ],
      translations: {
        en: {
          'common.save': 'Save',
          'common.cancel': 'Cancel',
        },
        fr: {
          'common.save': 'Enregistrer',
          // 'common.cancel' is missing
        },
      },
    }

    const component = {
      type: 'button' as const,
      children: ['$t:common.cancel'],
    }

    const html = renderToString(
      <ComponentRenderer
        component={component}
        languages={languages}
        currentLang="fr-FR"
      />
    )

    expect(html).toContain('>Cancel</button>')
    expect(html).not.toContain('>common.cancel</button>')
  })
})
