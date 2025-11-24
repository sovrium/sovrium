/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type App } from '@/index'
import { home } from './pages/home'
import { privacyPolicy } from './pages/privacy-policy'
import { termsOfService } from './pages/terms-of-service'

export const app: App = {
  name: 'sovrium-website',
  theme: {
    colors: {
      // Primary palette - Deep blues conveying trust and control
      'sovereignty-dark': '#0a0e1a', // Background dark
      'sovereignty-darker': '#050810', // Background darker
      'sovereignty-light': '#e8ecf4', // Primary text
      'sovereignty-accent': '#3b82f6', // Primary blue accent (CTA, highlights)
      'sovereignty-accent-hover': '#2563eb', // Hover state

      // Secondary palette - Teal for technical credibility
      'sovereignty-teal': '#14b8a6', // Secondary accent
      'sovereignty-teal-dark': '#0d9488', // Secondary dark

      // Neutral palette - Grays for content hierarchy
      'sovereignty-gray-100': '#f3f4f6',
      'sovereignty-gray-200': '#e5e7eb',
      'sovereignty-gray-300': '#d1d5db',
      'sovereignty-gray-400': '#9ca3af',
      'sovereignty-gray-500': '#6b7280',
      'sovereignty-gray-600': '#4b5563',
      'sovereignty-gray-700': '#374151',
      'sovereignty-gray-800': '#1f2937',
      'sovereignty-gray-900': '#111827',

      // Semantic colors
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',

      // Gradient stops
      'gradient-start': '#0a0e1a',
      'gradient-end': '#050810',
    },
    fonts: {
      heading: {
        family: 'Inter',
        fallback: 'system-ui, -apple-system, sans-serif',
        weights: [600, 700, 800],
        lineHeight: '1.2',
        url: 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap',
      },
      body: {
        family: 'Inter',
        fallback: 'system-ui, -apple-system, sans-serif',
        weights: [400, 500, 600],
        size: '16px',
        lineHeight: '1.6',
        url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
      },
      mono: {
        family: 'Fira Code',
        fallback: 'Monaco, Courier New, monospace',
        weights: [400, 500],
        size: '14px',
        lineHeight: '1.5',
        url: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap',
      },
    },
    spacing: {
      // Container variations
      container: 'max-w-7xl mx-auto px-4',
      'container-small': 'max-w-4xl mx-auto px-4',
      'container-xsmall': 'max-w-2xl mx-auto px-4',

      // Section padding
      section: 'py-16 sm:py-20 lg:py-24',
      'section-small': 'py-8 sm:py-12 lg:py-16',
      'section-large': 'py-24 sm:py-32 lg:py-40',

      // Component spacing
      gap: 'gap-6',
      'gap-small': 'gap-4',
      'gap-large': 'gap-8',
      padding: 'p-6',
      'padding-small': 'p-4',
      'padding-large': 'p-8',
    },
  },
  blocks: [],
  pages: [home, termsOfService, privacyPolicy],
}
