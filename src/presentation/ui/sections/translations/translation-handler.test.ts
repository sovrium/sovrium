/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, it } from 'bun:test'
import { substitutePropsTranslationTokens } from './translation-handler'
import type { Languages } from '@/domain/models/app/languages'

describe('substitutePropsTranslationTokens', () => {
  const languages: Languages = {
    default: 'en',
    supported: [
      { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' },
      { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' },
    ],
    translations: {
      en: {
        'close.label': 'Close dialog',
        'save.tooltip': 'Save changes',
        'search.placeholder': 'Type to search',
      },
      fr: {
        'close.label': 'Fermer la boîte de dialogue',
        'save.tooltip': 'Enregistrer les modifications',
        'search.placeholder': 'Tapez pour rechercher',
      },
    },
  }

  it('should resolve translation tokens in props', () => {
    const props = {
      'aria-label': '$t:close.label',
      title: '$t:save.tooltip',
      placeholder: '$t:search.placeholder',
    }

    const result = substitutePropsTranslationTokens(props, 'en-US', languages)

    expect(result).toEqual({
      'aria-label': 'Close dialog',
      title: 'Save changes',
      placeholder: 'Type to search',
    })
  })

  it('should resolve translation tokens in different language', () => {
    const props = {
      'aria-label': '$t:close.label',
      title: '$t:save.tooltip',
    }

    const result = substitutePropsTranslationTokens(props, 'fr-FR', languages)

    expect(result).toEqual({
      'aria-label': 'Fermer la boîte de dialogue',
      title: 'Enregistrer les modifications',
    })
  })

  it('should leave non-translation strings unchanged', () => {
    const props = {
      'aria-label': '$t:close.label',
      title: 'Static text',
      className: 'btn-primary',
    }

    const result = substitutePropsTranslationTokens(props, 'en-US', languages)

    expect(result).toEqual({
      'aria-label': 'Close dialog',
      title: 'Static text',
      className: 'btn-primary',
    })
  })

  it('should handle nested objects recursively', () => {
    const props = {
      'aria-label': '$t:close.label',
      style: {
        color: 'red',
        title: '$t:save.tooltip',
      },
    }

    const result = substitutePropsTranslationTokens(props, 'en-US', languages)

    expect(result).toEqual({
      'aria-label': 'Close dialog',
      style: {
        color: 'red',
        title: 'Save changes',
      },
    })
  })

  it('should return undefined when props is undefined', () => {
    const result = substitutePropsTranslationTokens(undefined, 'en-US', languages)

    expect(result).toBeUndefined()
  })

  it('should return props unchanged when languages is undefined', () => {
    const props = {
      'aria-label': '$t:close.label',
      title: 'Static text',
    }

    const result = substitutePropsTranslationTokens(props, 'en-US', undefined)

    expect(result).toEqual(props)
  })

  it('should use default language when currentLang is undefined', () => {
    const props = {
      'aria-label': '$t:close.label',
    }

    const result = substitutePropsTranslationTokens(props, undefined, languages)

    expect(result).toEqual({
      'aria-label': 'Close dialog',
    })
  })

  it('should fallback to key when translation is missing', () => {
    const props = {
      'aria-label': '$t:missing.key',
    }

    const result = substitutePropsTranslationTokens(props, 'en-US', languages)

    expect(result).toEqual({
      'aria-label': 'missing.key',
    })
  })

  it('should handle non-string values', () => {
    const props = {
      'aria-label': '$t:close.label',
      width: 100,
      disabled: true,
      items: ['a', 'b', 'c'],
    }

    const result = substitutePropsTranslationTokens(props, 'en-US', languages)

    expect(result).toEqual({
      'aria-label': 'Close dialog',
      width: 100,
      disabled: true,
      items: ['a', 'b', 'c'],
    })
  })
})
