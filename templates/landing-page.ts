/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium Landing Page
 *
 * A complete, production-ready landing page showcasing Sovrium's capabilities.
 * This template demonstrates:
 * - Multi-language support (English, French)
 * - Custom theming with modern design
 * - Reusable component blocks
 * - Responsive layout patterns
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

export const landingPageApp: App = {
  name: 'sovrium-landing',
  version: '1.0.0',
  description: 'Build apps faster with configuration-driven development',

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
        // Navigation
        'nav.home': 'Home',
        'nav.features': 'Features',
        'nav.pricing': 'Pricing',
        'nav.docs': 'Docs',
        'nav.github': 'GitHub',
        'nav.getStarted': 'Get Started',

        // Hero
        'hero.badge': '✨ Now in Public Beta',
        'hero.title': 'Build Apps 10x Faster',
        'hero.titleHighlight': 'with Sovrium',
        'hero.subtitle':
          'The configuration-driven platform that turns your ideas into production-ready applications. Define once, deploy everywhere.',
        'hero.cta.primary': 'Start Building Free',
        'hero.cta.secondary': 'View Documentation',
        'hero.stats.apps': 'Apps Built',
        'hero.stats.developers': 'Developers',
        'hero.stats.uptime': 'Uptime',

        // Features
        'features.badge': 'Why Sovrium?',
        'features.title': 'Everything You Need to Ship Fast',
        'features.subtitle':
          'Stop wrestling with boilerplate. Focus on what makes your app unique.',

        'feature.schemas.title': 'Schema-First Development',
        'feature.schemas.description':
          'Define your data models, APIs, and UI in simple JSON schemas. Get type-safe code generated automatically.',

        'feature.database.title': 'Built-in Database',
        'feature.database.description':
          'PostgreSQL-powered with automatic migrations, relations, and a visual query builder. No ORM headaches.',

        'feature.auth.title': 'Authentication Ready',
        'feature.auth.description':
          'Email, OAuth, magic links, and SSO out of the box. Role-based access control included.',

        'feature.api.title': 'Auto-Generated APIs',
        'feature.api.description':
          'RESTful and RPC endpoints created from your schemas. OpenAPI docs generated automatically.',

        'feature.ui.title': 'UI Components',
        'feature.ui.description':
          'Beautiful, accessible components built with React and Tailwind. Customize everything.',

        'feature.deploy.title': 'One-Click Deploy',
        'feature.deploy.description':
          'Deploy to any platform. Docker, Kubernetes, serverless - we generate the configs.',

        // How it works
        'howItWorks.badge': 'How It Works',
        'howItWorks.title': 'From Idea to Production in Minutes',
        'howItWorks.subtitle': 'Three simple steps to launch your application',

        'step.1.title': '1. Define Your Schema',
        'step.1.description':
          'Describe your data models, relationships, and business rules in a simple JSON format.',

        'step.2.title': '2. Customize & Extend',
        'step.2.description':
          'Add custom logic, integrations, and branding. Everything is fully customizable.',

        'step.3.title': '3. Deploy & Scale',
        'step.3.description':
          'Push to production with one command. Scale automatically as your users grow.',

        // Testimonials
        'testimonials.badge': 'Loved by Developers',
        'testimonials.title': 'What Our Users Say',

        // CTA
        'cta.title': 'Ready to Build Something Amazing?',
        'cta.subtitle':
          'Join thousands of developers shipping faster with Sovrium. Free to start, scale as you grow.',
        'cta.button': 'Start Building for Free',
        'cta.note': 'No credit card required',

        // Footer
        'footer.tagline': 'Build apps faster with configuration-driven development.',
        'footer.product': 'Product',
        'footer.resources': 'Resources',
        'footer.company': 'Company',
        'footer.legal': 'Legal',
        'footer.copyright': '© 2025 Sovrium. All rights reserved.',
        'footer.madeWith': 'Made with',
        'footer.inFrance': 'in France',
      },
      fr: {
        // Navigation
        'nav.home': 'Accueil',
        'nav.features': 'Fonctionnalités',
        'nav.pricing': 'Tarifs',
        'nav.docs': 'Documentation',
        'nav.github': 'GitHub',
        'nav.getStarted': 'Commencer',

        // Hero
        'hero.badge': '✨ Maintenant en Bêta Publique',
        'hero.title': 'Créez des Apps 10x Plus Vite',
        'hero.titleHighlight': 'avec Sovrium',
        'hero.subtitle':
          "La plateforme pilotée par configuration qui transforme vos idées en applications prêtes pour la production. Définissez une fois, déployez partout.",
        'hero.cta.primary': 'Commencer Gratuitement',
        'hero.cta.secondary': 'Voir la Documentation',
        'hero.stats.apps': 'Apps Créées',
        'hero.stats.developers': 'Développeurs',
        'hero.stats.uptime': 'Disponibilité',

        // Features
        'features.badge': 'Pourquoi Sovrium ?',
        'features.title': 'Tout Ce Dont Vous Avez Besoin',
        'features.subtitle':
          'Arrêtez de lutter avec le code standard. Concentrez-vous sur ce qui rend votre app unique.',

        'feature.schemas.title': 'Développement Schema-First',
        'feature.schemas.description':
          'Définissez vos modèles de données, APIs et UI en JSON simple. Code type-safe généré automatiquement.',

        'feature.database.title': 'Base de Données Intégrée',
        'feature.database.description':
          'PostgreSQL avec migrations automatiques, relations et query builder visuel. Sans les problèmes ORM.',

        'feature.auth.title': 'Authentification Prête',
        'feature.auth.description':
          "Email, OAuth, liens magiques et SSO inclus. Contrôle d'accès par rôles fourni.",

        'feature.api.title': 'APIs Auto-Générées',
        'feature.api.description':
          'Endpoints REST et RPC créés depuis vos schemas. Documentation OpenAPI automatique.',

        'feature.ui.title': 'Composants UI',
        'feature.ui.description':
          'Composants beaux et accessibles avec React et Tailwind. Personnalisez tout.',

        'feature.deploy.title': 'Déploiement en Un Clic',
        'feature.deploy.description':
          'Déployez sur toute plateforme. Docker, Kubernetes, serverless - configs générées.',

        // How it works
        'howItWorks.badge': 'Comment Ça Marche',
        'howItWorks.title': "De l'Idée à la Production en Minutes",
        'howItWorks.subtitle': 'Trois étapes simples pour lancer votre application',

        'step.1.title': '1. Définissez Votre Schéma',
        'step.1.description':
          'Décrivez vos modèles de données, relations et règles métier en format JSON simple.',

        'step.2.title': '2. Personnalisez & Étendez',
        'step.2.description':
          'Ajoutez logique personnalisée, intégrations et branding. Tout est personnalisable.',

        'step.3.title': '3. Déployez & Scalez',
        'step.3.description':
          "Passez en production en une commande. Scalez automatiquement avec vos utilisateurs.",

        // Testimonials
        'testimonials.badge': 'Adoré par les Développeurs',
        'testimonials.title': 'Ce Que Disent Nos Utilisateurs',

        // CTA
        'cta.title': 'Prêt à Créer Quelque Chose de Génial ?',
        'cta.subtitle':
          'Rejoignez des milliers de développeurs qui livrent plus vite avec Sovrium. Gratuit pour commencer.',
        'cta.button': 'Commencer Gratuitement',
        'cta.note': 'Aucune carte de crédit requise',

        // Footer
        'footer.tagline': 'Créez des apps plus vite avec le développement piloté par configuration.',
        'footer.product': 'Produit',
        'footer.resources': 'Ressources',
        'footer.company': 'Entreprise',
        'footer.legal': 'Légal',
        'footer.copyright': '© 2025 Sovrium. Tous droits réservés.',
        'footer.madeWith': 'Fait avec',
        'footer.inFrance': 'en France',
      },
    },
  },

  // Theme configuration
  theme: {
    colors: {
      // Primary brand colors
      primary: '#2563eb',
      'primary-hover': '#1d4ed8',
      'primary-light': '#dbeafe',
      'primary-dark': '#1e40af',

      // Secondary colors
      secondary: '#7c3aed',
      'secondary-hover': '#6d28d9',
      'secondary-light': '#ede9fe',

      // Accent colors
      accent: '#f59e0b',
      'accent-hover': '#d97706',

      // Neutral colors
      background: '#ffffff',
      'background-alt': '#f8fafc',
      'background-dark': '#0f172a',
      surface: '#ffffff',
      'surface-alt': '#f1f5f9',

      // Text colors
      text: '#0f172a',
      'text-secondary': '#475569',
      'text-muted': '#64748b',
      'text-inverse': '#ffffff',

      // Border colors
      border: '#e2e8f0',
      'border-light': '#f1f5f9',

      // Status colors
      success: '#10b981',
      'success-light': '#d1fae5',
      warning: '#f59e0b',
      'warning-light': '#fef3c7',
      error: '#ef4444',
      'error-light': '#fee2e2',
      info: '#3b82f6',
      'info-light': '#dbeafe',

      // Gray scale
      'gray-50': '#f8fafc',
      'gray-100': '#f1f5f9',
      'gray-200': '#e2e8f0',
      'gray-300': '#cbd5e1',
      'gray-400': '#94a3b8',
      'gray-500': '#64748b',
      'gray-600': '#475569',
      'gray-700': '#334155',
      'gray-800': '#1e293b',
      'gray-900': '#0f172a',
    },
    fonts: {
      sans: {
        family: 'Inter',
        fallback: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        weights: [400, 500, 600, 700],
        size: '16px',
        lineHeight: '1.6',
      },
      heading: {
        family: 'Inter',
        fallback: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        weights: [600, 700, 800],
        size: '48px',
        lineHeight: '1.1',
        letterSpacing: '-0.025em',
      },
      mono: {
        family: 'JetBrains Mono',
        fallback: 'Fira Code, Consolas, monospace',
        weights: [400, 500],
        size: '14px',
        lineHeight: '1.6',
      },
    },
    borderRadius: {
      none: '0',
      sm: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
      '2xl': '1.5rem',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    },
  },

  // Reusable blocks
  blocks: [
    // Badge component
    {
      name: 'badge',
      type: 'span',
      props: {
        className:
          'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-light text-primary',
      },
      content: '$text',
    },

    // Feature card with emoji icon
    {
      name: 'feature-card',
      type: 'div',
      props: {
        className:
          'group p-6 bg-white rounded-2xl border border-gray-200 hover:border-primary hover:shadow-lg transition-all duration-300',
      },
      children: [
        {
          type: 'div',
          props: {
            className:
              'w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform',
          },
          content: '$icon',
        },
        {
          type: 'h3',
          props: {
            className: 'text-lg font-semibold text-gray-900 mb-2',
          },
          content: '$title',
        },
        {
          type: 'p',
          props: {
            className: 'text-gray-600 text-sm leading-relaxed',
          },
          content: '$description',
        },
      ],
    },

    // Step card for how it works section
    {
      name: 'step-card',
      type: 'div',
      props: {
        className: 'text-center',
      },
      children: [
        {
          type: 'div',
          props: {
            className:
              'w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4',
          },
          content: '$number',
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

    // Stat card
    {
      name: 'stat-card',
      type: 'div',
      props: {
        className: 'text-center',
      },
      children: [
        {
          type: 'div',
          props: {
            className: 'text-3xl font-bold text-primary mb-1',
          },
          content: '$value',
        },
        {
          type: 'div',
          props: {
            className: 'text-sm text-gray-500',
          },
          content: '$label',
        },
      ],
    },

    // Primary button
    {
      name: 'button-primary',
      type: 'a',
      props: {
        href: '$href',
        className:
          'inline-flex items-center justify-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover transition-colors shadow-md hover:shadow-lg',
      },
      content: '$label',
    },

    // Secondary button
    {
      name: 'button-secondary',
      type: 'a',
      props: {
        href: '$href',
        className:
          'inline-flex items-center justify-center px-6 py-3 bg-white text-primary font-semibold rounded-lg border-2 border-primary hover:bg-primary-light transition-colors',
      },
      content: '$label',
    },
  ],

  // Page configuration
  pages: [
    {
      path: '/',
      name: 'home',
      meta: {
        lang: 'en',
        title: 'Sovrium - Build Apps 10x Faster',
        description:
          'The configuration-driven platform for rapid application development. Define your schemas, get production-ready apps.',
      },
      sections: [
        // Navigation
        {
          type: 'header',
          props: {
            className:
              'fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100',
          },
          children: [
            {
              type: 'nav',
              props: {
                className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    className: 'flex justify-between items-center h-16',
                  },
                  children: [
                    // Logo
                    {
                      type: 'a',
                      props: {
                        href: '/',
                        className: 'flex items-center gap-2',
                      },
                      children: [
                        {
                          type: 'span',
                          props: {
                            className: 'text-2xl',
                          },
                          content: '⚡',
                        },
                        {
                          type: 'span',
                          props: {
                            className: 'text-xl font-bold text-gray-900',
                          },
                          content: 'Sovrium',
                        },
                      ],
                    },
                    // Nav links
                    {
                      type: 'div',
                      props: {
                        className: 'hidden md:flex items-center gap-8',
                      },
                      children: [
                        {
                          type: 'a',
                          props: {
                            href: '#features',
                            className:
                              'text-gray-600 hover:text-primary font-medium transition-colors',
                          },
                          content: '$t:nav.features',
                        },
                        {
                          type: 'a',
                          props: {
                            href: '#how-it-works',
                            className:
                              'text-gray-600 hover:text-primary font-medium transition-colors',
                          },
                          content: '$t:nav.docs',
                        },
                        {
                          type: 'a',
                          props: {
                            href: '#pricing',
                            className:
                              'text-gray-600 hover:text-primary font-medium transition-colors',
                          },
                          content: '$t:nav.pricing',
                        },
                        {
                          type: 'a',
                          props: {
                            href: 'https://github.com/sovrium/sovrium',
                            target: '_blank',
                            className:
                              'text-gray-600 hover:text-primary font-medium transition-colors',
                          },
                          content: '$t:nav.github',
                        },
                      ],
                    },
                    // CTA button
                    {
                      type: 'a',
                      props: {
                        href: '#get-started',
                        className:
                          'hidden sm:inline-flex items-center px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors',
                      },
                      content: '$t:nav.getStarted',
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Hero Section
        {
          type: 'section',
          props: {
            className: 'pt-32 pb-20 px-4 bg-gradient-to-b from-gray-50 to-white',
          },
          children: [
            {
              type: 'div',
              props: {
                className: 'max-w-5xl mx-auto text-center',
              },
              children: [
                // Badge
                {
                  type: 'div',
                  props: {
                    className: 'mb-6',
                  },
                  children: [
                    {
                      type: 'span',
                      props: {
                        className:
                          'inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-primary-light text-primary',
                      },
                      content: '$t:hero.badge',
                    },
                  ],
                },
                // Title
                {
                  type: 'h1',
                  props: {
                    className: 'text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6',
                  },
                  children: [
                    {
                      type: 'span',
                      content: '$t:hero.title',
                    },
                    {
                      type: 'br',
                    },
                    {
                      type: 'span',
                      props: {
                        className: 'text-primary',
                      },
                      content: '$t:hero.titleHighlight',
                    },
                  ],
                },
                // Subtitle
                {
                  type: 'p',
                  props: {
                    className: 'text-xl text-gray-600 mb-10 max-w-2xl mx-auto',
                  },
                  content: '$t:hero.subtitle',
                },
                // CTA buttons
                {
                  type: 'div',
                  props: {
                    className: 'flex flex-col sm:flex-row gap-4 justify-center mb-16',
                  },
                  children: [
                    {
                      type: 'a',
                      props: {
                        href: '#get-started',
                        className:
                          'inline-flex items-center justify-center px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5',
                      },
                      content: '$t:hero.cta.primary',
                    },
                    {
                      type: 'a',
                      props: {
                        href: '#how-it-works',
                        className:
                          'inline-flex items-center justify-center px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-primary hover:text-primary transition-all',
                      },
                      content: '$t:hero.cta.secondary',
                    },
                  ],
                },
                // Stats
                {
                  type: 'div',
                  props: {
                    className:
                      'flex flex-wrap justify-center gap-12 pt-8 border-t border-gray-200',
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'text-center' },
                      children: [
                        {
                          type: 'div',
                          props: { className: 'text-3xl font-bold text-gray-900' },
                          content: '2,500+',
                        },
                        {
                          type: 'div',
                          props: { className: 'text-sm text-gray-500' },
                          content: '$t:hero.stats.apps',
                        },
                      ],
                    },
                    {
                      type: 'div',
                      props: { className: 'text-center' },
                      children: [
                        {
                          type: 'div',
                          props: { className: 'text-3xl font-bold text-gray-900' },
                          content: '10,000+',
                        },
                        {
                          type: 'div',
                          props: { className: 'text-sm text-gray-500' },
                          content: '$t:hero.stats.developers',
                        },
                      ],
                    },
                    {
                      type: 'div',
                      props: { className: 'text-center' },
                      children: [
                        {
                          type: 'div',
                          props: { className: 'text-3xl font-bold text-gray-900' },
                          content: '99.9%',
                        },
                        {
                          type: 'div',
                          props: { className: 'text-sm text-gray-500' },
                          content: '$t:hero.stats.uptime',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Features Section
        {
          type: 'section',
          props: {
            id: 'features',
            className: 'py-24 px-4 bg-white',
          },
          children: [
            {
              type: 'div',
              props: {
                className: 'max-w-7xl mx-auto',
              },
              children: [
                // Section header
                {
                  type: 'div',
                  props: {
                    className: 'text-center mb-16',
                  },
                  children: [
                    {
                      type: 'span',
                      props: {
                        className:
                          'inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-secondary-light text-secondary mb-4',
                      },
                      content: '$t:features.badge',
                    },
                    {
                      type: 'h2',
                      props: {
                        className: 'text-4xl sm:text-5xl font-bold text-gray-900 mb-4',
                      },
                      content: '$t:features.title',
                    },
                    {
                      type: 'p',
                      props: {
                        className: 'text-xl text-gray-600 max-w-2xl mx-auto',
                      },
                      content: '$t:features.subtitle',
                    },
                  ],
                },
                // Features grid
                {
                  type: 'div',
                  props: {
                    className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
                  },
                  children: [
                    // Feature 1: Schema-First
                    {
                      type: 'div',
                      props: {
                        className:
                          'group p-6 bg-white rounded-2xl border border-gray-200 hover:border-primary hover:shadow-lg transition-all duration-300',
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            className:
                              'w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform',
                          },
                          content: '📋',
                        },
                        {
                          type: 'h3',
                          props: { className: 'text-lg font-semibold text-gray-900 mb-2' },
                          content: '$t:feature.schemas.title',
                        },
                        {
                          type: 'p',
                          props: { className: 'text-gray-600 text-sm leading-relaxed' },
                          content: '$t:feature.schemas.description',
                        },
                      ],
                    },
                    // Feature 2: Database
                    {
                      type: 'div',
                      props: {
                        className:
                          'group p-6 bg-white rounded-2xl border border-gray-200 hover:border-primary hover:shadow-lg transition-all duration-300',
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            className:
                              'w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform',
                          },
                          content: '🗄️',
                        },
                        {
                          type: 'h3',
                          props: { className: 'text-lg font-semibold text-gray-900 mb-2' },
                          content: '$t:feature.database.title',
                        },
                        {
                          type: 'p',
                          props: { className: 'text-gray-600 text-sm leading-relaxed' },
                          content: '$t:feature.database.description',
                        },
                      ],
                    },
                    // Feature 3: Auth
                    {
                      type: 'div',
                      props: {
                        className:
                          'group p-6 bg-white rounded-2xl border border-gray-200 hover:border-primary hover:shadow-lg transition-all duration-300',
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            className:
                              'w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform',
                          },
                          content: '🔐',
                        },
                        {
                          type: 'h3',
                          props: { className: 'text-lg font-semibold text-gray-900 mb-2' },
                          content: '$t:feature.auth.title',
                        },
                        {
                          type: 'p',
                          props: { className: 'text-gray-600 text-sm leading-relaxed' },
                          content: '$t:feature.auth.description',
                        },
                      ],
                    },
                    // Feature 4: API
                    {
                      type: 'div',
                      props: {
                        className:
                          'group p-6 bg-white rounded-2xl border border-gray-200 hover:border-primary hover:shadow-lg transition-all duration-300',
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            className:
                              'w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform',
                          },
                          content: '🔌',
                        },
                        {
                          type: 'h3',
                          props: { className: 'text-lg font-semibold text-gray-900 mb-2' },
                          content: '$t:feature.api.title',
                        },
                        {
                          type: 'p',
                          props: { className: 'text-gray-600 text-sm leading-relaxed' },
                          content: '$t:feature.api.description',
                        },
                      ],
                    },
                    // Feature 5: UI
                    {
                      type: 'div',
                      props: {
                        className:
                          'group p-6 bg-white rounded-2xl border border-gray-200 hover:border-primary hover:shadow-lg transition-all duration-300',
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            className:
                              'w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform',
                          },
                          content: '🎨',
                        },
                        {
                          type: 'h3',
                          props: { className: 'text-lg font-semibold text-gray-900 mb-2' },
                          content: '$t:feature.ui.title',
                        },
                        {
                          type: 'p',
                          props: { className: 'text-gray-600 text-sm leading-relaxed' },
                          content: '$t:feature.ui.description',
                        },
                      ],
                    },
                    // Feature 6: Deploy
                    {
                      type: 'div',
                      props: {
                        className:
                          'group p-6 bg-white rounded-2xl border border-gray-200 hover:border-primary hover:shadow-lg transition-all duration-300',
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            className:
                              'w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform',
                          },
                          content: '🚀',
                        },
                        {
                          type: 'h3',
                          props: { className: 'text-lg font-semibold text-gray-900 mb-2' },
                          content: '$t:feature.deploy.title',
                        },
                        {
                          type: 'p',
                          props: { className: 'text-gray-600 text-sm leading-relaxed' },
                          content: '$t:feature.deploy.description',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // How It Works Section
        {
          type: 'section',
          props: {
            id: 'how-it-works',
            className: 'py-24 px-4 bg-gray-50',
          },
          children: [
            {
              type: 'div',
              props: {
                className: 'max-w-7xl mx-auto',
              },
              children: [
                // Section header
                {
                  type: 'div',
                  props: {
                    className: 'text-center mb-16',
                  },
                  children: [
                    {
                      type: 'span',
                      props: {
                        className:
                          'inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700 mb-4',
                      },
                      content: '$t:howItWorks.badge',
                    },
                    {
                      type: 'h2',
                      props: {
                        className: 'text-4xl sm:text-5xl font-bold text-gray-900 mb-4',
                      },
                      content: '$t:howItWorks.title',
                    },
                    {
                      type: 'p',
                      props: {
                        className: 'text-xl text-gray-600',
                      },
                      content: '$t:howItWorks.subtitle',
                    },
                  ],
                },
                // Steps
                {
                  type: 'div',
                  props: {
                    className: 'grid grid-cols-1 md:grid-cols-3 gap-12',
                  },
                  children: [
                    // Step 1
                    {
                      type: 'div',
                      props: { className: 'text-center' },
                      children: [
                        {
                          type: 'div',
                          props: {
                            className:
                              'w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-6',
                          },
                          content: '1',
                        },
                        {
                          type: 'h3',
                          props: { className: 'text-xl font-semibold text-gray-900 mb-3' },
                          content: '$t:step.1.title',
                        },
                        {
                          type: 'p',
                          props: { className: 'text-gray-600' },
                          content: '$t:step.1.description',
                        },
                      ],
                    },
                    // Step 2
                    {
                      type: 'div',
                      props: { className: 'text-center' },
                      children: [
                        {
                          type: 'div',
                          props: {
                            className:
                              'w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-6',
                          },
                          content: '2',
                        },
                        {
                          type: 'h3',
                          props: { className: 'text-xl font-semibold text-gray-900 mb-3' },
                          content: '$t:step.2.title',
                        },
                        {
                          type: 'p',
                          props: { className: 'text-gray-600' },
                          content: '$t:step.2.description',
                        },
                      ],
                    },
                    // Step 3
                    {
                      type: 'div',
                      props: { className: 'text-center' },
                      children: [
                        {
                          type: 'div',
                          props: {
                            className:
                              'w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-6',
                          },
                          content: '3',
                        },
                        {
                          type: 'h3',
                          props: { className: 'text-xl font-semibold text-gray-900 mb-3' },
                          content: '$t:step.3.title',
                        },
                        {
                          type: 'p',
                          props: { className: 'text-gray-600' },
                          content: '$t:step.3.description',
                        },
                      ],
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
            id: 'get-started',
            className: 'py-24 px-4 bg-primary',
          },
          children: [
            {
              type: 'div',
              props: {
                className: 'max-w-4xl mx-auto text-center',
              },
              children: [
                {
                  type: 'h2',
                  props: {
                    className: 'text-4xl sm:text-5xl font-bold text-white mb-6',
                  },
                  content: '$t:cta.title',
                },
                {
                  type: 'p',
                  props: {
                    className: 'text-xl text-blue-100 mb-10 max-w-2xl mx-auto',
                  },
                  content: '$t:cta.subtitle',
                },
                {
                  type: 'div',
                  props: {
                    className: 'flex flex-col items-center gap-4',
                  },
                  children: [
                    {
                      type: 'a',
                      props: {
                        href: '#',
                        className:
                          'inline-flex items-center justify-center px-8 py-4 bg-white text-primary font-semibold rounded-xl hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl',
                      },
                      content: '$t:cta.button',
                    },
                    {
                      type: 'p',
                      props: {
                        className: 'text-sm text-blue-200',
                      },
                      content: '$t:cta.note',
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Footer
        {
          type: 'footer',
          props: {
            className: 'py-16 px-4 bg-gray-900 text-white',
          },
          children: [
            {
              type: 'div',
              props: {
                className: 'max-w-7xl mx-auto',
              },
              children: [
                // Footer top
                {
                  type: 'div',
                  props: {
                    className:
                      'grid grid-cols-1 md:grid-cols-4 gap-12 pb-12 border-b border-gray-800',
                  },
                  children: [
                    // Brand column
                    {
                      type: 'div',
                      props: { className: 'col-span-1' },
                      children: [
                        {
                          type: 'div',
                          props: { className: 'flex items-center gap-2 mb-4' },
                          children: [
                            { type: 'span', props: { className: 'text-2xl' }, content: '⚡' },
                            {
                              type: 'span',
                              props: { className: 'text-xl font-bold' },
                              content: 'Sovrium',
                            },
                          ],
                        },
                        {
                          type: 'p',
                          props: { className: 'text-gray-400 text-sm' },
                          content: '$t:footer.tagline',
                        },
                      ],
                    },
                    // Product links
                    {
                      type: 'div',
                      children: [
                        {
                          type: 'h4',
                          props: { className: 'font-semibold mb-4' },
                          content: '$t:footer.product',
                        },
                        {
                          type: 'ul',
                          props: { className: 'space-y-2 text-sm text-gray-400' },
                          children: [
                            {
                              type: 'li',
                              children: [
                                {
                                  type: 'a',
                                  props: { href: '#', className: 'hover:text-white' },
                                  content: 'Features',
                                },
                              ],
                            },
                            {
                              type: 'li',
                              children: [
                                {
                                  type: 'a',
                                  props: { href: '#', className: 'hover:text-white' },
                                  content: 'Pricing',
                                },
                              ],
                            },
                            {
                              type: 'li',
                              children: [
                                {
                                  type: 'a',
                                  props: { href: '#', className: 'hover:text-white' },
                                  content: 'Changelog',
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    // Resources links
                    {
                      type: 'div',
                      children: [
                        {
                          type: 'h4',
                          props: { className: 'font-semibold mb-4' },
                          content: '$t:footer.resources',
                        },
                        {
                          type: 'ul',
                          props: { className: 'space-y-2 text-sm text-gray-400' },
                          children: [
                            {
                              type: 'li',
                              children: [
                                {
                                  type: 'a',
                                  props: { href: '#', className: 'hover:text-white' },
                                  content: 'Documentation',
                                },
                              ],
                            },
                            {
                              type: 'li',
                              children: [
                                {
                                  type: 'a',
                                  props: { href: '#', className: 'hover:text-white' },
                                  content: 'Guides',
                                },
                              ],
                            },
                            {
                              type: 'li',
                              children: [
                                {
                                  type: 'a',
                                  props: { href: '#', className: 'hover:text-white' },
                                  content: 'API Reference',
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    // Company links
                    {
                      type: 'div',
                      children: [
                        {
                          type: 'h4',
                          props: { className: 'font-semibold mb-4' },
                          content: '$t:footer.company',
                        },
                        {
                          type: 'ul',
                          props: { className: 'space-y-2 text-sm text-gray-400' },
                          children: [
                            {
                              type: 'li',
                              children: [
                                {
                                  type: 'a',
                                  props: { href: '#', className: 'hover:text-white' },
                                  content: 'About',
                                },
                              ],
                            },
                            {
                              type: 'li',
                              children: [
                                {
                                  type: 'a',
                                  props: { href: '#', className: 'hover:text-white' },
                                  content: 'Blog',
                                },
                              ],
                            },
                            {
                              type: 'li',
                              children: [
                                {
                                  type: 'a',
                                  props: { href: '#', className: 'hover:text-white' },
                                  content: 'Contact',
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                // Footer bottom
                {
                  type: 'div',
                  props: {
                    className: 'pt-8 flex flex-col md:flex-row justify-between items-center gap-4',
                  },
                  children: [
                    {
                      type: 'p',
                      props: { className: 'text-gray-400 text-sm' },
                      content: '$t:footer.copyright',
                    },
                    {
                      type: 'p',
                      props: { className: 'text-gray-400 text-sm flex items-center gap-1' },
                      children: [
                        { type: 'span', content: '$t:footer.madeWith' },
                        { type: 'span', content: ' ❤️ ' },
                        { type: 'span', content: '$t:footer.inFrance' },
                        { type: 'span', content: ' 🇫🇷' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// Start the server
start(landingPageApp).catch((error: Readonly<Error>) => {
  console.error('Failed to start server:', error)
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
})
