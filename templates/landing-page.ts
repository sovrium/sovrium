/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Complete landing page example using Sovrium
 *
 * This template demonstrates a full-featured landing page configuration with:
 * - Multi-language support (English, French)
 * - Custom theme (colors, fonts)
 * - Reusable blocks (hero, features, CTA)
 * - Multiple page sections
 *
 * ## Running this example
 *
 * ```bash
 * bun run templates/landing-page.ts
 * ```
 *
 * Then visit http://localhost:3000 in your browser.
 */

import { start, type App } from '@/index'

// Define your complete application configuration
const myApp: App = {
  name: 'sovrium-landing-page-demo',
  version: '1.0.0',
  description: 'Complete landing page demo with theme, i18n, and reusable blocks',

  // Multi-language support
  languages: {
    default: 'en',
    supported: [
      {
        code: 'en',
        locale: 'en-US',
        label: 'English',
        direction: 'ltr',
        flag: '🇺🇸',
      },
      {
        code: 'fr',
        locale: 'fr-FR',
        label: 'Français',
        direction: 'ltr',
        flag: '🇫🇷',
      },
    ],
    fallback: 'en',
    detectBrowser: true,
    persistSelection: true,
    translations: {
      en: {
        'nav.home': 'Home',
        'nav.features': 'Features',
        'nav.pricing': 'Pricing',
        'nav.contact': 'Contact',
        'hero.title': 'Build Your Next App with Sovrium',
        'hero.subtitle':
          'A modern, configuration-driven platform for rapid application development',
        'hero.cta': 'Get Started',
        'hero.cta-secondary': 'Learn More',
        'features.title': 'Why Choose Sovrium?',
        'features.subtitle': 'Everything you need to build modern applications',
        'feature.declarative.title': 'Declarative Configuration',
        'feature.declarative.description':
          'Define your entire application using simple JSON schemas',
        'feature.typesafe.title': 'Type-Safe by Default',
        'feature.typesafe.description': 'Full TypeScript support with automatic type inference',
        'feature.reactive.title': 'Reactive & Fast',
        'feature.reactive.description': 'Built on Effect.ts for predictable, composable logic',
        'cta.title': 'Ready to get started?',
        'cta.subtitle': 'Join thousands of developers building with Sovrium',
        'cta.button': 'Start Building Now',
        'footer.copyright': '© 2025 Sovrium. All rights reserved.',
      },
      fr: {
        'nav.home': 'Accueil',
        'nav.features': 'Fonctionnalités',
        'nav.pricing': 'Tarifs',
        'nav.contact': 'Contact',
        'hero.title': 'Créez votre prochaine application avec Sovrium',
        'hero.subtitle':
          'Une plateforme moderne pilotée par la configuration pour le développement rapide',
        'hero.cta': 'Commencer',
        'hero.cta-secondary': 'En savoir plus',
        'features.title': 'Pourquoi choisir Sovrium?',
        'features.subtitle': 'Tout ce dont vous avez besoin pour créer des applications modernes',
        'feature.declarative.title': 'Configuration déclarative',
        'feature.declarative.description':
          'Définissez votre application entière avec des schémas JSON simples',
        'feature.typesafe.title': 'Type-safe par défaut',
        'feature.typesafe.description': 'Support TypeScript complet avec inférence automatique',
        'feature.reactive.title': 'Réactif et rapide',
        'feature.reactive.description':
          'Construit sur Effect.ts pour une logique prévisible et composable',
        'cta.title': 'Prêt à commencer?',
        'cta.subtitle': 'Rejoignez des milliers de développeurs qui construisent avec Sovrium',
        'cta.button': 'Commencer maintenant',
        'footer.copyright': '© 2025 Sovrium. Tous droits réservés.',
      },
    },
  },

  // Theme configuration
  theme: {
    colors: {
      primary: '#3b82f6',
      'primary-hover': '#2563eb',
      'primary-light': '#dbeafe',
      secondary: '#8b5cf6',
      'secondary-hover': '#7c3aed',
      accent: '#f59e0b',
      background: '#ffffff',
      'background-alt': '#f9fafb',
      text: '#111827',
      'text-muted': '#6b7280',
      border: '#e5e7eb',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      'gray-50': '#f9fafb',
      'gray-100': '#f3f4f6',
      'gray-200': '#e5e7eb',
      'gray-300': '#d1d5db',
      'gray-500': '#6b7280',
      'gray-700': '#374151',
      'gray-900': '#111827',
    },
    fonts: {
      sans: {
        family: 'Inter',
        fallback: 'system-ui, -apple-system, sans-serif',
        weights: [400, 500, 600, 700],
        size: '16px',
        lineHeight: '1.5',
      },
      heading: {
        family: 'Inter',
        fallback: 'system-ui, -apple-system, sans-serif',
        weights: [600, 700, 800],
        size: '48px',
        lineHeight: '1.2',
        letterSpacing: '-0.02em',
      },
      mono: {
        family: 'Fira Code',
        fallback: 'monospace',
        weights: [400, 500],
        size: '14px',
        lineHeight: '1.5',
      },
    },
  },

  // Reusable blocks
  blocks: [
    {
      name: 'hero-section',
      type: 'section',
      props: {
        className: 'py-20 px-4 bg-gradient-to-b from-primary-light to-background',
      },
      children: [
        {
          type: 'container',
          props: {
            className: 'max-w-4xl mx-auto text-center',
          },
          children: [
            {
              type: 'h1',
              props: {
                className: 'text-5xl font-bold text-gray-900 mb-6',
              },
              content: '$title',
            },
            {
              type: 'p',
              props: {
                className: 'text-xl text-gray-600 mb-8',
              },
              content: '$subtitle',
            },
            {
              type: 'flex',
              props: {
                className: 'gap-4 justify-center',
              },
              children: [
                {
                  type: 'button',
                  props: {
                    className:
                      'px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover font-semibold',
                  },
                  content: '$ctaPrimary',
                },
                {
                  type: 'button',
                  props: {
                    className:
                      'px-8 py-3 border-2 border-primary text-primary rounded-lg hover:bg-primary-light font-semibold',
                  },
                  content: '$ctaSecondary',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'feature-card',
      type: 'card',
      props: {
        className: 'p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow',
      },
      children: [
        {
          type: 'icon',
          props: {
            name: '$icon',
            className: 'w-12 h-12 text-primary mb-4',
          },
        },
        {
          type: 'h3',
          props: {
            className: 'text-xl font-semibold text-gray-900 mb-2',
          },
          content: '$title',
        },
        {
          type: 'p',
          props: {
            className: 'text-gray-600',
          },
          content: '$description',
        },
      ],
    },
    {
      name: 'cta-button',
      type: 'button',
      props: {
        className:
          'px-8 py-4 bg-primary text-white rounded-lg hover:bg-primary-hover text-lg font-semibold shadow-lg',
      },
      content: '$label',
    },
  ],

  // Page configuration
  pages: [
    {
      path: '/',
      name: 'home',
      sections: [
        // Navigation
        {
          type: 'navigation',
          props: {
            className: 'fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200',
          },
          children: [
            {
              type: 'container',
              props: {
                className: 'max-w-7xl mx-auto px-4 py-4 flex justify-between items-center',
              },
              children: [
                {
                  type: 'text',
                  props: {
                    className: 'text-2xl font-bold text-primary',
                  },
                  content: 'Sovrium',
                },
                {
                  type: 'flex',
                  props: {
                    className: 'gap-6',
                  },
                  children: [
                    {
                      type: 'link',
                      props: {
                        href: '#home',
                        className: 'text-gray-700 hover:text-primary',
                      },
                      content: '$t:nav.home',
                    },
                    {
                      type: 'link',
                      props: {
                        href: '#features',
                        className: 'text-gray-700 hover:text-primary',
                      },
                      content: '$t:nav.features',
                    },
                    {
                      type: 'link',
                      props: {
                        href: '#pricing',
                        className: 'text-gray-700 hover:text-primary',
                      },
                      content: '$t:nav.pricing',
                    },
                    {
                      type: 'link',
                      props: {
                        href: '#contact',
                        className: 'text-gray-700 hover:text-primary',
                      },
                      content: '$t:nav.contact',
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Hero Section (using block)
        {
          block: 'hero-section',
          vars: {
            title: '$t:hero.title',
            subtitle: '$t:hero.subtitle',
            ctaPrimary: '$t:hero.cta',
            ctaSecondary: '$t:hero.cta-secondary',
          },
        },

        // Features Section
        {
          type: 'section',
          props: {
            id: 'features',
            className: 'py-20 px-4 bg-background-alt',
          },
          children: [
            {
              type: 'container',
              props: {
                className: 'max-w-7xl mx-auto',
              },
              children: [
                {
                  type: 'h2',
                  props: {
                    className: 'text-4xl font-bold text-center text-gray-900 mb-4',
                  },
                  content: '$t:features.title',
                },
                {
                  type: 'p',
                  props: {
                    className: 'text-xl text-center text-gray-600 mb-12',
                  },
                  content: '$t:features.subtitle',
                },
                {
                  type: 'grid',
                  props: {
                    className: 'grid-cols-1 md:grid-cols-3 gap-8',
                  },
                  children: [
                    {
                      block: 'feature-card',
                      vars: {
                        icon: 'code',
                        title: '$t:feature.declarative.title',
                        description: '$t:feature.declarative.description',
                      },
                    },
                    {
                      block: 'feature-card',
                      vars: {
                        icon: 'shield-check',
                        title: '$t:feature.typesafe.title',
                        description: '$t:feature.typesafe.description',
                      },
                    },
                    {
                      block: 'feature-card',
                      vars: {
                        icon: 'zap',
                        title: '$t:feature.reactive.title',
                        description: '$t:feature.reactive.description',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // CTA Section
        {
          type: 'section',
          props: {
            className: 'py-20 px-4 bg-primary text-white',
          },
          children: [
            {
              type: 'container',
              props: {
                className: 'max-w-4xl mx-auto text-center',
              },
              children: [
                {
                  type: 'h2',
                  props: {
                    className: 'text-4xl font-bold mb-4',
                  },
                  content: '$t:cta.title',
                },
                {
                  type: 'p',
                  props: {
                    className: 'text-xl mb-8 opacity-90',
                  },
                  content: '$t:cta.subtitle',
                },
                {
                  block: 'cta-button',
                  vars: {
                    label: '$t:cta.button',
                  },
                },
              ],
            },
          ],
        },

        // Footer
        {
          type: 'section',
          props: {
            className: 'py-8 px-4 bg-gray-900 text-white',
          },
          children: [
            {
              type: 'container',
              props: {
                className: 'max-w-7xl mx-auto text-center',
              },
              children: [
                {
                  type: 'p',
                  props: {
                    className: 'text-gray-400',
                  },
                  content: '$t:footer.copyright',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// Start the server (handles everything automatically with defaults)
start(myApp).catch((error: Readonly<Error>) => {
  console.error('Failed to start server:', error)
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
})
