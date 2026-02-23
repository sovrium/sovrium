/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  buildMetaElement,
  buildLinkElement,
  buildScriptElement,
  buildStyleElement,
  buildBaseElement,
  buildCustomElement,
} from './custom-elements-builders'

describe('Custom Elements Builders', () => {
  describe('buildMetaElement', () => {
    test('should build meta element with attributes', () => {
      const element = {
        type: 'meta' as const,
        attrs: { name: 'theme-color', content: '#FFAF00' },
      }
      const result = buildMetaElement(element, 'test-key')
      const html = renderToStaticMarkup(result)

      expect(html).toBe('<meta name="theme-color" content="#FFAF00"/>')
    })
  })

  describe('buildLinkElement', () => {
    test('should build link element with attributes', () => {
      const element = {
        type: 'link' as const,
        attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com' },
      }
      const result = buildLinkElement(element, 'test-key')
      const html = renderToStaticMarkup(result)

      expect(html).toBe('<link rel="preconnect" href="https://fonts.gstatic.com"/>')
    })
  })

  describe('buildScriptElement', () => {
    test('should build script element with src attribute', () => {
      const element = {
        type: 'script' as const,
        attrs: { src: 'https://example.com/script.js' },
      }
      const result = buildScriptElement(element, 'test-key')
      const html = renderToStaticMarkup(result)

      expect(html).toBe('<script src="https://example.com/script.js"></script>')
    })

    test('should build script element with inline content', () => {
      const element = {
        type: 'script' as const,
        content: 'console.log("test");',
      }
      const result = buildScriptElement(element, 'test-key')
      const html = renderToStaticMarkup(result)

      expect(html).toBe('<script>console.log("test");</script>')
    })

    test('should convert boolean attribute string "true" to true', () => {
      const element = {
        type: 'script' as const,
        attrs: { src: 'https://example.com/script.js', async: 'true' },
      }
      const result = buildScriptElement(element, 'test-key')
      const html = renderToStaticMarkup(result)

      // React renders boolean attributes without value when true
      expect(html).toBe('<script src="https://example.com/script.js" async=""></script>')
    })

    test('should remove boolean attribute when string "false"', () => {
      const element = {
        type: 'script' as const,
        attrs: { src: 'https://example.com/script.js', async: 'false' },
      }
      const result = buildScriptElement(element, 'test-key')
      const html = renderToStaticMarkup(result)

      expect(html).toBe('<script src="https://example.com/script.js"></script>')
    })

    test('should handle defer boolean attribute', () => {
      const element = {
        type: 'script' as const,
        attrs: { src: 'https://example.com/script.js', defer: 'true' },
      }
      const result = buildScriptElement(element, 'test-key')
      const html = renderToStaticMarkup(result)

      expect(html).toBe('<script src="https://example.com/script.js" defer=""></script>')
    })

    test('should handle noModule boolean attribute', () => {
      const element = {
        type: 'script' as const,
        attrs: { src: 'https://example.com/script.js', noModule: 'true' },
      }
      const result = buildScriptElement(element, 'test-key')
      const html = renderToStaticMarkup(result)

      expect(html).toBe('<script src="https://example.com/script.js" noModule=""></script>')
    })
  })

  describe('buildStyleElement', () => {
    test('should build style element with inline content', () => {
      const element = {
        type: 'style' as const,
        content: 'body { margin: 0; }',
      }
      const result = buildStyleElement(element, 'test-key')
      const html = renderToStaticMarkup(result)

      expect(html).toBe('<style>body { margin: 0; }</style>')
    })
  })

  describe('buildBaseElement', () => {
    test('should build base element with href attribute', () => {
      const element = {
        type: 'base' as const,
        attrs: { href: 'https://example.com/' },
      }
      const result = buildBaseElement(element, 'test-key')
      const html = renderToStaticMarkup(result)

      expect(html).toBe('<base href="https://example.com/"/>')
    })
  })

  describe('buildCustomElement', () => {
    test('should build meta element via dispatcher', () => {
      const element = {
        type: 'meta' as const,
        attrs: { name: 'description', content: 'Test' },
      }
      const result = buildCustomElement(element, 0)
      const html = renderToStaticMarkup(result!)

      expect(html).toBe('<meta name="description" content="Test"/>')
    })

    test('should build script element via dispatcher with boolean attributes', () => {
      const element = {
        type: 'script' as const,
        attrs: { src: 'https://example.com/script.js', async: 'true' },
      }
      const result = buildCustomElement(element, 0)
      const html = renderToStaticMarkup(result!)

      expect(html).toBe('<script src="https://example.com/script.js" async=""></script>')
    })

    test('should return undefined for unknown element type', () => {
      const element = {
        type: 'unknown' as any,
        attrs: {},
      }
      const result = buildCustomElement(element, 0)

      expect(result).toBeUndefined()
    })
  })
})
