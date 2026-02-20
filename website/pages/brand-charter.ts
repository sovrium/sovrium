/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from './favicons'
import type { Page } from '@/index'

// ─── Helpers ────────────────────────────────────────────────────────────────────

const sidebarLink = (id: string, label: string) => ({
  type: 'link' as const,
  content: label,
  props: {
    href: `#${id}`,
    className:
      'block py-2 px-3 text-sm text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors rounded hover:bg-sovereignty-gray-900',
    'data-nav': id,
  },
})

const colorSwatch = (name: string, hex: string, usage: string) => ({
  type: 'div' as const,
  props: { className: 'flex items-center gap-4' },
  children: [
    {
      type: 'div' as const,
      props: {
        className: 'w-16 h-16 rounded-lg border border-sovereignty-gray-700 flex-shrink-0',
        style: `background-color: ${hex};`,
      },
    },
    {
      type: 'div' as const,
      children: [
        {
          type: 'paragraph' as const,
          content: name,
          props: { className: 'font-semibold text-sovereignty-light' },
        },
        {
          type: 'paragraph' as const,
          content: hex,
          props: { className: 'text-sm font-mono text-sovereignty-accent' },
        },
        {
          type: 'paragraph' as const,
          content: usage,
          props: { className: 'text-xs text-sovereignty-gray-400 mt-1' },
        },
      ],
    },
  ],
})

const principleCard = (title: string, description: string) => ({
  type: 'card' as const,
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
  },
  children: [
    {
      type: 'h4' as const,
      content: title,
      props: { className: 'text-lg font-semibold mb-3 text-sovereignty-light' },
    },
    {
      type: 'paragraph' as const,
      content: description,
      props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
    },
  ],
})

const doItem = (text: string) => ({
  type: 'div' as const,
  props: { className: 'flex items-start gap-2' },
  children: [
    {
      type: 'span' as const,
      content: '\u2705',
      props: { className: 'flex-shrink-0 mt-0.5' },
    },
    {
      type: 'paragraph' as const,
      content: text,
      props: { className: 'text-sm text-sovereignty-gray-300' },
    },
  ],
})

const dontItem = (text: string) => ({
  type: 'div' as const,
  props: { className: 'flex items-start gap-2' },
  children: [
    {
      type: 'span' as const,
      content: '\u274C',
      props: { className: 'flex-shrink-0 mt-0.5' },
    },
    {
      type: 'paragraph' as const,
      content: text,
      props: { className: 'text-sm text-sovereignty-gray-300' },
    },
  ],
})

const typographyRow = (
  label: string,
  className: string,
  specs: string,
  sampleText: string = 'Sovrium, the sovereignty element'
) => ({
  type: 'div' as const,
  props: {
    className: 'border-b border-sovereignty-gray-800 pb-6 mb-6 last:border-b-0 last:pb-0 last:mb-0',
  },
  children: [
    {
      type: 'div' as const,
      props: { className: 'flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-2' },
      children: [
        {
          type: 'span' as const,
          content: label,
          props: {
            className:
              'text-xs uppercase tracking-widest text-sovereignty-accent font-semibold mb-1 sm:mb-0',
          },
        },
        {
          type: 'span' as const,
          content: specs,
          props: { className: 'text-xs font-mono text-sovereignty-gray-500' },
        },
      ],
    },
    {
      type: 'paragraph' as const,
      content: sampleText,
      props: { className },
    },
  ],
})

// ─── Page ───────────────────────────────────────────────────────────────────────

export const brandCharter: Page = {
  name: 'brand-charter',
  path: '/brand-charter',
  meta: {
    title: 'Brand Charter - Sovrium',
    description:
      'Sovrium brand guidelines: logo, colors, typography, tone of voice, and visual identity.',
    noindex: true, // Exclude from sitemap and search engines
    favicons,
  },
  sections: [
    // ─── Header ─────────────────────────────────────────────────────────────
    {
      type: 'section',
      props: {
        className:
          'py-16 sm:py-20 bg-gradient-to-b from-sovereignty-dark to-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-5xl mx-auto px-4' },
          children: [
            {
              type: 'div',
              props: { className: 'flex items-center gap-3 mb-6' },
              children: [
                {
                  type: 'link',
                  content: '\u2190 sovrium.com',
                  props: {
                    href: '/',
                    className:
                      'text-sm text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'span',
                  content: 'v1.0',
                  props: {
                    className:
                      'text-xs font-mono px-2 py-0.5 bg-sovereignty-gray-800 rounded text-sovereignty-gray-400',
                  },
                },
              ],
            },
            {
              type: 'h1',
              content: 'Brand Charter',
              props: { className: 'text-4xl sm:text-5xl md:text-6xl font-bold mb-4' },
            },
            {
              type: 'paragraph',
              content:
                'Guidelines for representing Sovrium consistently across all touchpoints. This document defines our visual identity, tone of voice, and design principles rooted in digital sovereignty, ownership, and configuration-as-code.',
              props: {
                className: 'text-lg text-sovereignty-gray-300 max-w-3xl leading-relaxed',
              },
            },
          ],
        },
      ],
    },

    // ─── Main Content (Sidebar + Content) ───────────────────────────────────
    {
      type: 'section',
      props: {
        className: 'bg-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 py-12' },
          children: [
            {
              type: 'div',
              props: { className: 'flex flex-col lg:flex-row gap-12' },
              children: [
                // ── Sidebar Navigation ──────────────────────────────────
                {
                  type: 'nav',
                  props: {
                    className:
                      'lg:w-56 flex-shrink-0 lg:sticky lg:top-8 lg:self-start hidden lg:block',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        className: 'border-l border-sovereignty-gray-800 pl-2 space-y-1',
                      },
                      children: [
                        sidebarLink('principles', 'Principles'),
                        sidebarLink('design-philosophy', 'Design Philosophy'),
                        sidebarLink('logo', 'Logo'),
                        sidebarLink('colors', 'Colors'),
                        sidebarLink('typography', 'Typography'),
                        sidebarLink('spacing', 'Spacing & Whitespace'),
                        sidebarLink('transitions', 'Transitions'),
                        sidebarLink('tone', 'Tone & Voice'),
                        sidebarLink('components', 'Components'),
                        sidebarLink('visuals', 'Visuals'),
                        sidebarLink('best-practices', 'Best Practices'),
                      ],
                    },
                  ],
                },

                // ── Content Sections ────────────────────────────────────
                {
                  type: 'div',
                  props: { className: 'flex-1 min-w-0 space-y-20' },
                  children: [
                    // ══ 1. Principles ═══════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'principles' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Principles',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content:
                            'Every design decision at Sovrium flows from four foundational pillars.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },
                        {
                          type: 'grid',
                          props: {
                            className: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
                          },
                          children: [
                            principleCard(
                              'Sovereignty',
                              'Your data, your infrastructure, your rules. Every visual element should reinforce the idea that the user is in control \u2014 not a vendor, not a platform, not a third party.'
                            ),
                            principleCard(
                              'Clarity & Precision',
                              'Configuration-as-code demands clarity. Our design language is clean, structured, and unambiguous. We favor sharp geometry over decoration, monospace accents over script, and generous whitespace over density. Every pixel is intentional.'
                            ),
                            principleCard(
                              'Technical Credibility',
                              'Sovrium is built for developers and technical teams. Our brand should feel engineered, not marketed. Show the code, show the config, show the terminal \u2014 the product speaks for itself.'
                            ),
                            principleCard(
                              'Openness & Trust',
                              'Source-available, self-hosted, no telemetry. Our visual identity reflects transparency: open structures, visible layers, nothing hidden behind a paywall or a dark pattern.'
                            ),
                          ],
                        },
                      ],
                    },

                    // ══ 1b. Design Philosophy ═════════════════════════
                    {
                      type: 'div',
                      props: { id: 'design-philosophy' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Design Philosophy',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content:
                            'Sovrium\u2019s visual identity aspires to the same standard as the finest product websites \u2014 Apple, Linear, Stripe. Not by imitating their aesthetic, but by matching their attention to detail, intentionality, and polish in every pixel.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },
                        {
                          type: 'grid',
                          props: {
                            className: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
                          },
                          children: [
                            principleCard(
                              'Typography-First',
                              'Typography is the primary design element, not decoration. Every heading, body text, and caption has a clear purpose in the visual hierarchy. Use font weight, size, tracking, and color deliberately \u2014 never arbitrarily.'
                            ),
                            principleCard(
                              'Generous Whitespace',
                              'Whitespace is not empty space; it is a structural element. Sections feel spacious, not crammed. Content blocks breathe. When in doubt, add more space, not less. Density signals clutter; space signals confidence.'
                            ),
                            principleCard(
                              'Pixel-Perfect Alignment',
                              'Every element aligns to a deliberate grid. Text baselines match across columns. Icons are optically centered. Spacing between similar elements is mathematically consistent \u2014 not \u201Cclose enough,\u201D but exact.'
                            ),
                            principleCard(
                              'Purposeful Restraint',
                              'Every visual element \u2014 gradient, border, shadow, icon \u2014 serves a function: guide attention, create hierarchy, or indicate interactivity. If it doesn\u2019t serve a function, remove it. Decoration without purpose is noise.'
                            ),
                          ],
                        },

                        // The quality bar
                        {
                          type: 'div',
                          props: {
                            className:
                              'mt-10 bg-sovereignty-gray-900 border border-sovereignty-accent/30 p-6 rounded-lg',
                          },
                          children: [
                            {
                              type: 'h3',
                              content: 'The Quality Bar',
                              props: {
                                className: 'text-lg font-semibold mb-3 text-sovereignty-accent',
                              },
                            },
                            {
                              type: 'paragraph',
                              content:
                                'A designer visiting sovrium.com should find nothing to criticize. Transitions are smooth. Colors are purposeful. Spacing is generous and consistent. Text is readable and well-proportioned. The experience feels like a single, cohesive product \u2014 not a collection of pages assembled over time.',
                              props: {
                                className: 'text-sovereignty-gray-300 leading-relaxed italic',
                              },
                            },
                          ],
                        },
                      ],
                    },

                    // ══ 2. Logo ═════════════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'logo' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Logo',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content:
                            'The Sovereign Shield: a bold shield silhouette with double chevrons carved as negative space. The shield represents protection and ownership of data; the chevrons represent structured configuration layers.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },
                        // Logo variants grid
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8' },
                          children: [
                            // Dark on light
                            {
                              type: 'div',
                              props: {
                                className:
                                  'bg-white rounded-lg p-8 flex flex-col items-center justify-center min-h-[200px]',
                              },
                              children: [
                                {
                                  type: 'image',
                                  props: {
                                    src: '/logos/sovrium-icon-dark.svg',
                                    alt: 'Sovrium logo - dark variant',
                                    className: 'h-20 w-auto mb-4',
                                  },
                                },
                                {
                                  type: 'span',
                                  content: 'SOVRIUM',
                                  props: {
                                    className: 'text-lg font-bold tracking-[0.08em] text-[#0a0a0a]',
                                  },
                                },
                              ],
                            },
                            // Light on dark
                            {
                              type: 'div',
                              props: {
                                className:
                                  'bg-sovereignty-dark border border-sovereignty-gray-800 rounded-lg p-8 flex flex-col items-center justify-center min-h-[200px]',
                              },
                              children: [
                                {
                                  type: 'image',
                                  props: {
                                    src: '/logos/sovrium-icon-light.svg',
                                    alt: 'Sovrium logo - light variant',
                                    className: 'h-20 w-auto mb-4',
                                  },
                                },
                                {
                                  type: 'span',
                                  content: 'SOVRIUM',
                                  props: {
                                    className: 'text-lg font-bold tracking-[0.08em] text-white',
                                  },
                                },
                              ],
                            },
                          ],
                        },
                        // Horizontal lockups
                        {
                          type: 'h3',
                          content: 'Horizontal lockup',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8' },
                          children: [
                            {
                              type: 'div',
                              props: {
                                className:
                                  'bg-white rounded-lg p-8 flex items-center justify-center min-h-[100px]',
                              },
                              children: [
                                {
                                  type: 'image',
                                  props: {
                                    src: '/logos/sovrium-horizontal-dark.svg',
                                    alt: 'Sovrium horizontal lockup - dark',
                                    className: 'h-10 w-auto',
                                  },
                                },
                              ],
                            },
                            {
                              type: 'div',
                              props: {
                                className:
                                  'bg-sovereignty-dark border border-sovereignty-gray-800 rounded-lg p-8 flex items-center justify-center min-h-[100px]',
                              },
                              children: [
                                {
                                  type: 'image',
                                  props: {
                                    src: '/logos/sovrium-horizontal-light.svg',
                                    alt: 'Sovrium horizontal lockup - light',
                                    className: 'h-10 w-auto',
                                  },
                                },
                              ],
                            },
                          ],
                        },
                        // Logo rules
                        {
                          type: 'h3',
                          content: 'Usage rules',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6' },
                          children: [
                            {
                              type: 'div',
                              props: { className: 'space-y-3' },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Do',
                                  props: {
                                    className:
                                      'text-sm uppercase tracking-widest text-green-500 font-semibold mb-2',
                                  },
                                },
                                doItem('Use the shield icon at minimum 24px height'),
                                doItem(
                                  'Maintain clear space equal to the chevron height around the mark'
                                ),
                                doItem('Use the dark variant on light backgrounds'),
                                doItem('Use the light variant on dark backgrounds'),
                              ],
                            },
                            {
                              type: 'div',
                              props: { className: 'space-y-3' },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Don\u2019t',
                                  props: {
                                    className:
                                      'text-sm uppercase tracking-widest text-red-500 font-semibold mb-2',
                                  },
                                },
                                dontItem('Rotate, stretch, or distort the logo'),
                                dontItem('Change the chevron colors independently'),
                                dontItem('Place on busy or low-contrast backgrounds'),
                                dontItem('Add drop shadows, gradients, or effects'),
                              ],
                            },
                          ],
                        },
                      ],
                    },

                    // ══ 3. Colors ═══════════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'colors' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Colors',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content:
                            'A palette of deep blues conveying trust and control, with teal as a secondary accent for technical credibility.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },

                        // Primary colors
                        {
                          type: 'h3',
                          content: 'Primary palette',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10' },
                          children: [
                            colorSwatch('Sovereignty Dark', '#0a0e1a', 'Primary background'),
                            colorSwatch('Sovereignty Accent', '#3b82f6', 'CTAs, links, highlights'),
                            colorSwatch(
                              'Sovereignty Teal',
                              '#14b8a6',
                              'Secondary accent, code, tech'
                            ),
                            colorSwatch(
                              'Sovereignty Light',
                              '#e8ecf4',
                              'Primary text on dark backgrounds'
                            ),
                          ],
                        },

                        // Neutral palette
                        {
                          type: 'h3',
                          content: 'Neutral palette',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10' },
                          children: [
                            colorSwatch('Gray 900', '#111827', 'Card backgrounds'),
                            colorSwatch('Gray 800', '#1f2937', 'Borders, dividers'),
                            colorSwatch('Gray 400', '#9ca3af', 'Secondary text'),
                            colorSwatch('Gray 100', '#f3f4f6', 'Light mode backgrounds'),
                          ],
                        },

                        // Semantic colors
                        {
                          type: 'h3',
                          content: 'Semantic colors',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-2 sm:grid-cols-4 gap-4' },
                          children: [
                            colorSwatch('Success', '#10b981', 'Confirmations'),
                            colorSwatch('Warning', '#f59e0b', 'Alerts'),
                            colorSwatch('Error', '#ef4444', 'Errors'),
                            colorSwatch('Info', '#3b82f6', 'Informational'),
                          ],
                        },
                      ],
                    },

                    // ══ 4. Typography ═══════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'typography' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Typography',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content:
                            'Inter for headings and body text, Fira Code for technical and code elements. Clean, readable, engineered.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },

                        // Font families
                        {
                          type: 'div',
                          props: {
                            className:
                              'bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg p-6 mb-8',
                          },
                          children: [
                            {
                              type: 'grid',
                              props: {
                                className: 'grid grid-cols-1 sm:grid-cols-2 gap-6',
                              },
                              children: [
                                {
                                  type: 'div',
                                  children: [
                                    {
                                      type: 'span',
                                      content: 'HEADINGS & BODY',
                                      props: {
                                        className:
                                          'text-xs uppercase tracking-widest text-sovereignty-accent font-semibold',
                                      },
                                    },
                                    {
                                      type: 'paragraph',
                                      content: 'Inter',
                                      props: {
                                        className: 'text-3xl font-bold text-sovereignty-light mt-2',
                                      },
                                    },
                                    {
                                      type: 'paragraph',
                                      content: 'Weights: 400, 500, 600, 700, 800',
                                      props: {
                                        className:
                                          'text-xs font-mono text-sovereignty-gray-500 mt-1',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'div',
                                  children: [
                                    {
                                      type: 'span',
                                      content: 'CODE & TECHNICAL',
                                      props: {
                                        className:
                                          'text-xs uppercase tracking-widest text-sovereignty-teal font-semibold',
                                      },
                                    },
                                    {
                                      type: 'paragraph',
                                      content: 'Fira Code',
                                      props: {
                                        className:
                                          'text-3xl font-bold text-sovereignty-light mt-2 font-mono',
                                      },
                                    },
                                    {
                                      type: 'paragraph',
                                      content: 'Weights: 400, 500',
                                      props: {
                                        className:
                                          'text-xs font-mono text-sovereignty-gray-500 mt-1',
                                      },
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },

                        // Hierarchy
                        {
                          type: 'h3',
                          content: 'Type hierarchy',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            className:
                              'bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg p-6',
                          },
                          children: [
                            typographyRow(
                              'H1 \u2014 Hero',
                              'text-4xl sm:text-5xl md:text-6xl font-bold text-sovereignty-light',
                              'Inter 800 / 48\u201372px / line-height 1.2'
                            ),
                            typographyRow(
                              'H2 \u2014 Section Title',
                              'text-2xl sm:text-3xl font-bold text-sovereignty-light',
                              'Inter 700 / 30\u201336px / line-height 1.3'
                            ),
                            typographyRow(
                              'H3 \u2014 Subsection',
                              'text-xl font-semibold text-sovereignty-gray-300',
                              'Inter 600 / 20\u201324px / line-height 1.4'
                            ),
                            typographyRow(
                              'Body',
                              'text-base text-sovereignty-gray-300 leading-relaxed',
                              'Inter 400 / 16px / line-height 1.6',
                              'Sovrium turns a simple configuration file into a complete business application \u2014 authentication, database, API, pages, and admin panel included.'
                            ),
                            typographyRow(
                              'Code',
                              'text-sm font-mono text-sovereignty-teal',
                              'Fira Code 400 / 14px / line-height 1.5',
                              'bun run start app.yaml'
                            ),
                          ],
                        },
                      ],
                    },

                    // ══ 4b. Spacing & Whitespace ══════════════════════
                    {
                      type: 'div',
                      props: { id: 'spacing' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Spacing & Whitespace',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content:
                            'Generous whitespace is a defining characteristic of the Sovrium aesthetic. Space communicates confidence and clarity. These values are non-negotiable.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },

                        // Vertical spacing table
                        {
                          type: 'h3',
                          content: 'Vertical rhythm',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            className:
                              'bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg p-6 mb-8',
                          },
                          children: [
                            {
                              type: 'div',
                              props: { className: 'space-y-4' },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-sovereignty-gray-800',
                                  },
                                  children: [
                                    {
                                      type: 'span',
                                      content: 'Between page sections',
                                      props: {
                                        className: 'font-semibold text-sovereignty-light',
                                      },
                                    },
                                    {
                                      type: 'span',
                                      content: '96\u2013120px desktop / 48\u201364px mobile',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-sovereignty-gray-800',
                                  },
                                  children: [
                                    {
                                      type: 'span',
                                      content: 'Section heading to content',
                                      props: {
                                        className: 'font-semibold text-sovereignty-light',
                                      },
                                    },
                                    {
                                      type: 'span',
                                      content: '32\u201348px desktop / 24\u201332px mobile',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-sovereignty-gray-800',
                                  },
                                  children: [
                                    {
                                      type: 'span',
                                      content: 'Between cards in a grid',
                                      props: {
                                        className: 'font-semibold text-sovereignty-light',
                                      },
                                    },
                                    {
                                      type: 'span',
                                      content: '24\u201332px desktop / 16\u201320px mobile',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-sovereignty-gray-800',
                                  },
                                  children: [
                                    {
                                      type: 'span',
                                      content: 'Card internal padding',
                                      props: {
                                        className: 'font-semibold text-sovereignty-light',
                                      },
                                    },
                                    {
                                      type: 'span',
                                      content: '24\u201332px desktop / 20\u201324px mobile',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3',
                                  },
                                  children: [
                                    {
                                      type: 'span',
                                      content: 'Between paragraphs',
                                      props: {
                                        className: 'font-semibold text-sovereignty-light',
                                      },
                                    },
                                    {
                                      type: 'span',
                                      content: '16\u201324px desktop / 12\u201316px mobile',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },

                        // Content width
                        {
                          type: 'h3',
                          content: 'Content width',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            className:
                              'bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg p-6 mb-8',
                          },
                          children: [
                            {
                              type: 'div',
                              props: { className: 'space-y-4' },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-sovereignty-gray-800',
                                  },
                                  children: [
                                    {
                                      type: 'span',
                                      content: 'Page max-width (general)',
                                      props: {
                                        className: 'font-semibold text-sovereignty-light',
                                      },
                                    },
                                    {
                                      type: 'span',
                                      content: '1200px (max-w-6xl)',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-sovereignty-gray-800',
                                  },
                                  children: [
                                    {
                                      type: 'span',
                                      content: 'Page max-width (text-heavy)',
                                      props: {
                                        className: 'font-semibold text-sovereignty-light',
                                      },
                                    },
                                    {
                                      type: 'span',
                                      content: '768px (max-w-3xl)',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3',
                                  },
                                  children: [
                                    {
                                      type: 'span',
                                      content: 'Horizontal page padding',
                                      props: {
                                        className: 'font-semibold text-sovereignty-light',
                                      },
                                    },
                                    {
                                      type: 'span',
                                      content: '16px mobile / 24px tablet / 32px desktop',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },

                        // Whitespace principle callout
                        {
                          type: 'div',
                          props: {
                            className:
                              'bg-sovereignty-gray-900 border border-sovereignty-accent/30 p-6 rounded-lg',
                          },
                          children: [
                            {
                              type: 'h3',
                              content: 'The Whitespace Rule',
                              props: {
                                className: 'text-lg font-semibold mb-3 text-sovereignty-accent',
                              },
                            },
                            {
                              type: 'paragraph',
                              content:
                                'If a section feels crowded, the answer is never \u201Cmake the text smaller.\u201D The answer is always \u201Cadd more space\u201D or \u201Cremove content.\u201D Density signals clutter. Space signals confidence and clarity.',
                              props: {
                                className: 'text-sovereignty-gray-300 leading-relaxed italic',
                              },
                            },
                          ],
                        },
                      ],
                    },

                    // ══ 4c. Transitions & Animation ═══════════════════
                    {
                      type: 'div',
                      props: { id: 'transitions' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Transitions & Animation',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content:
                            'Motion should feel natural and purposeful. Every transition serves a function: providing feedback, guiding attention, or smoothing state changes. Motion that exists only for show is removed.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },

                        // Transition table
                        {
                          type: 'h3',
                          content: 'Standard durations',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            className:
                              'bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg p-6 mb-8',
                          },
                          children: [
                            {
                              type: 'div',
                              props: { className: 'space-y-4' },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-sovereignty-gray-800',
                                  },
                                  children: [
                                    {
                                      type: 'div',
                                      children: [
                                        {
                                          type: 'span',
                                          content: 'Links',
                                          props: {
                                            className: 'font-semibold text-sovereignty-light',
                                          },
                                        },
                                        {
                                          type: 'paragraph',
                                          content: 'Color change on hover',
                                          props: {
                                            className: 'text-xs text-sovereignty-gray-500',
                                          },
                                        },
                                      ],
                                    },
                                    {
                                      type: 'span',
                                      content: '150ms ease-out',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-sovereignty-gray-800',
                                  },
                                  children: [
                                    {
                                      type: 'div',
                                      children: [
                                        {
                                          type: 'span',
                                          content: 'Buttons',
                                          props: {
                                            className: 'font-semibold text-sovereignty-light',
                                          },
                                        },
                                        {
                                          type: 'paragraph',
                                          content: 'Background, border, shadow',
                                          props: {
                                            className: 'text-xs text-sovereignty-gray-500',
                                          },
                                        },
                                      ],
                                    },
                                    {
                                      type: 'span',
                                      content: '200ms ease-out',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-sovereignty-gray-800',
                                  },
                                  children: [
                                    {
                                      type: 'div',
                                      children: [
                                        {
                                          type: 'span',
                                          content: 'Cards',
                                          props: {
                                            className: 'font-semibold text-sovereignty-light',
                                          },
                                        },
                                        {
                                          type: 'paragraph',
                                          content: 'Border color, shadow, subtle lift',
                                          props: {
                                            className: 'text-xs text-sovereignty-gray-500',
                                          },
                                        },
                                      ],
                                    },
                                    {
                                      type: 'span',
                                      content: '300ms ease-out',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'div',
                                  props: {
                                    className:
                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between py-3',
                                  },
                                  children: [
                                    {
                                      type: 'div',
                                      children: [
                                        {
                                          type: 'span',
                                          content: 'Navigation (mobile)',
                                          props: {
                                            className: 'font-semibold text-sovereignty-light',
                                          },
                                        },
                                        {
                                          type: 'paragraph',
                                          content: 'Height, opacity',
                                          props: {
                                            className: 'text-xs text-sovereignty-gray-500',
                                          },
                                        },
                                      ],
                                    },
                                    {
                                      type: 'span',
                                      content: '300ms ease-in-out',
                                      props: {
                                        className: 'text-sm font-mono text-sovereignty-accent',
                                      },
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },

                        // Motion rules
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6' },
                          children: [
                            {
                              type: 'div',
                              props: { className: 'space-y-3' },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Motion principles',
                                  props: {
                                    className:
                                      'text-sm uppercase tracking-widest text-green-500 font-semibold mb-2',
                                  },
                                },
                                doItem('All interactive elements have a transition'),
                                doItem(
                                  'Hover states are subtle: opacity shift, gentle color change, or slight lift'
                                ),
                                doItem('Easing is always ease-out or ease-in-out, never linear'),
                                doItem(
                                  'Maximum transition duration: 400ms (longer feels sluggish)'
                                ),
                              ],
                            },
                            {
                              type: 'div',
                              props: { className: 'space-y-3' },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Motion anti-patterns',
                                  props: {
                                    className:
                                      'text-sm uppercase tracking-widest text-red-500 font-semibold mb-2',
                                  },
                                },
                                dontItem('Instant color jumps with no transition'),
                                dontItem('Bouncy or elastic easing (feels playful, not premium)'),
                                dontItem('Transitions on scroll position or layout shifts'),
                                dontItem(
                                  'Animation for decoration (spinning icons, pulsing badges)'
                                ),
                              ],
                            },
                          ],
                        },
                      ],
                    },

                    // ══ 5. Tone & Voice ═════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'tone' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Tone & Voice',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content:
                            'How we speak is as important as how we look. Sovrium\u2019s voice is direct, technical, and respectful of the reader\u2019s intelligence.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },

                        // Voice characteristics
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10' },
                          children: [
                            principleCard(
                              'Direct, not aggressive',
                              'State facts plainly. \u201CYou own your data\u201D beats \u201CWe believe in empowering users to take ownership of their data journey.\u201D Skip the fluff.'
                            ),
                            principleCard(
                              'Technical, not exclusionary',
                              'We speak to developers and technical teams. Use precise terminology (config, schema, runtime) but always remain approachable. Define terms when necessary.'
                            ),
                            principleCard(
                              'Confident, not arrogant',
                              'We know what Sovrium does well. We don\u2019t need to trash competitors to make our case. Let the architecture speak: self-hosted, config-driven, source-available.'
                            ),
                            principleCard(
                              'Honest, not hedging',
                              'If something is a limitation, say it. \u201CSovrium is in Phase 0\u201D is better than \u201Ccoming soon.\u201D Transparency builds more trust than polish.'
                            ),
                          ],
                        },

                        // Vocabulary
                        {
                          type: 'h3',
                          content: 'Preferred vocabulary',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            className: 'flex flex-wrap gap-2 mb-10',
                          },
                          children: [
                            '#sovereignty',
                            '#self-hosted',
                            '#config-driven',
                            '#ownership',
                            '#source-available',
                            '#no-vendor-lock-in',
                            '#your-infrastructure',
                            '#single-config',
                            '#no-telemetry',
                            '#open-source-roadmap',
                          ].map((tag) => ({
                            type: 'span' as const,
                            content: tag,
                            props: {
                              className:
                                'px-3 py-1 text-xs font-mono bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-full text-sovereignty-accent',
                            },
                          })),
                        },

                        // Avoid vocabulary
                        {
                          type: 'h3',
                          content: 'Terms to avoid',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            className: 'flex flex-wrap gap-2 mb-10',
                          },
                          children: [
                            'disrupting',
                            'game-changer',
                            'revolutionary',
                            'leverage',
                            'synergize',
                            'empower',
                            'unlock',
                            'supercharge',
                            'seamless',
                            'world-class',
                          ].map((tag) => ({
                            type: 'span' as const,
                            content: tag,
                            props: {
                              className:
                                'px-3 py-1 text-xs font-mono bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-full text-sovereignty-gray-500 line-through',
                            },
                          })),
                        },

                        // Do / Don't table
                        {
                          type: 'h3',
                          content: 'Wording examples',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6' },
                          children: [
                            {
                              type: 'div',
                              props: { className: 'space-y-3' },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Write this',
                                  props: {
                                    className:
                                      'text-sm uppercase tracking-widest text-green-500 font-semibold mb-2',
                                  },
                                },
                                doItem('Self-hosted on your infrastructure'),
                                doItem('One config file, full application'),
                                doItem('No per-seat pricing, no vendor lock-in'),
                                doItem('Source-available under BSL 1.1'),
                              ],
                            },
                            {
                              type: 'div',
                              props: { className: 'space-y-3' },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Not this',
                                  props: {
                                    className:
                                      'text-sm uppercase tracking-widest text-red-500 font-semibold mb-2',
                                  },
                                },
                                dontItem('Empowering teams to leverage cloud solutions'),
                                dontItem('Disrupting the no-code space with AI'),
                                dontItem('Unlock unlimited possibilities for free'),
                                dontItem('The world\u2019s most powerful platform'),
                              ],
                            },
                          ],
                        },
                      ],
                    },

                    // ══ 6. Components ═══════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'components' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Components',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: 'Core UI patterns used across the Sovrium website and product.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },

                        // Buttons
                        {
                          type: 'h3',
                          content: 'Buttons',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            className:
                              'bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg p-6 mb-8',
                          },
                          children: [
                            {
                              type: 'div',
                              props: { className: 'flex flex-wrap gap-4 items-center' },
                              children: [
                                {
                                  type: 'span',
                                  content: 'Primary CTA',
                                  props: {
                                    className:
                                      'inline-block bg-sovereignty-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-sovereignty-accent-hover transition-colors cursor-pointer',
                                  },
                                },
                                {
                                  type: 'span',
                                  content: 'Secondary',
                                  props: {
                                    className:
                                      'inline-block border border-sovereignty-gray-600 text-sovereignty-light px-6 py-3 rounded-lg font-semibold hover:border-sovereignty-accent hover:text-sovereignty-accent transition-colors cursor-pointer',
                                  },
                                },
                                {
                                  type: 'span',
                                  content: 'Teal Accent',
                                  props: {
                                    className:
                                      'inline-block bg-sovereignty-teal text-white px-6 py-3 rounded-lg font-semibold hover:bg-sovereignty-teal-dark transition-colors cursor-pointer',
                                  },
                                },
                                {
                                  type: 'span',
                                  content: 'Ghost',
                                  props: {
                                    className:
                                      'inline-block text-sovereignty-gray-400 px-6 py-3 rounded-lg font-semibold hover:text-sovereignty-light hover:bg-sovereignty-gray-800 transition-colors cursor-pointer',
                                  },
                                },
                              ],
                            },
                          ],
                        },

                        // Cards
                        {
                          type: 'h3',
                          content: 'Cards',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8' },
                          children: [
                            {
                              type: 'card',
                              props: {
                                className:
                                  'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
                              },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Default Card',
                                  props: {
                                    className: 'font-semibold mb-2 text-sovereignty-light',
                                  },
                                },
                                {
                                  type: 'paragraph',
                                  content:
                                    'Gray-900 background with Gray-800 border. Hover state transitions to accent border.',
                                  props: {
                                    className: 'text-sm text-sovereignty-gray-400',
                                  },
                                },
                              ],
                            },
                            {
                              type: 'card',
                              props: {
                                className:
                                  'bg-sovereignty-gray-900 border-l-4 border-l-sovereignty-accent border border-sovereignty-gray-800 p-6 rounded-lg',
                              },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Accent Border',
                                  props: {
                                    className: 'font-semibold mb-2 text-sovereignty-light',
                                  },
                                },
                                {
                                  type: 'paragraph',
                                  content:
                                    'Left accent border for emphasis or status. Use sparingly for key content.',
                                  props: {
                                    className: 'text-sm text-sovereignty-gray-400',
                                  },
                                },
                              ],
                            },
                            {
                              type: 'card',
                              props: {
                                className:
                                  'bg-gradient-to-r from-sovereignty-accent to-sovereignty-teal p-6 rounded-lg text-white',
                              },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Gradient CTA',
                                  props: {
                                    className: 'font-semibold mb-2',
                                  },
                                },
                                {
                                  type: 'paragraph',
                                  content:
                                    'Accent-to-teal gradient for high-impact CTAs and announcements.',
                                  props: {
                                    className: 'text-sm text-white/90',
                                  },
                                },
                              ],
                            },
                          ],
                        },

                        // Badges
                        {
                          type: 'h3',
                          content: 'Badges & Tags',
                          props: {
                            className: 'text-lg font-semibold mb-4 text-sovereignty-gray-300',
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            className:
                              'bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg p-6',
                          },
                          children: [
                            {
                              type: 'div',
                              props: { className: 'flex flex-wrap gap-3' },
                              children: [
                                {
                                  type: 'span',
                                  content: 'Self-Hosted',
                                  props: {
                                    className:
                                      'px-3 py-1 text-xs font-mono bg-sovereignty-accent/10 border border-sovereignty-accent/30 rounded-full text-sovereignty-accent',
                                  },
                                },
                                {
                                  type: 'span',
                                  content: 'BSL 1.1',
                                  props: {
                                    className:
                                      'px-3 py-1 text-xs font-mono bg-sovereignty-teal/10 border border-sovereignty-teal/30 rounded-full text-sovereignty-teal',
                                  },
                                },
                                {
                                  type: 'span',
                                  content: 'Phase 0',
                                  props: {
                                    className:
                                      'px-3 py-1 text-xs font-mono bg-warning/10 border border-warning/30 rounded-full text-warning',
                                  },
                                },
                                {
                                  type: 'span',
                                  content: 'v0.0.1',
                                  props: {
                                    className:
                                      'px-3 py-1 text-xs font-mono bg-sovereignty-gray-800 border border-sovereignty-gray-700 rounded-full text-sovereignty-gray-400',
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },

                    // ══ 7. Visuals ══════════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'visuals' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Visuals & Imagery',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content:
                            'Guidelines for photography, illustrations, and iconography across Sovrium materials.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6' },
                          children: [
                            {
                              type: 'div',
                              props: { className: 'space-y-3' },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Preferred imagery',
                                  props: {
                                    className:
                                      'text-sm uppercase tracking-widest text-green-500 font-semibold mb-2',
                                  },
                                },
                                doItem('Terminal screenshots and real code examples'),
                                doItem('Architecture diagrams with clean, geometric lines'),
                                doItem('Dark-mode-first UI mockups'),
                                doItem(
                                  'Abstract geometric shapes evoking shields, layers, structures'
                                ),
                                doItem('Lucide icons (outline style, 1.5px stroke)'),
                              ],
                            },
                            {
                              type: 'div',
                              props: { className: 'space-y-3' },
                              children: [
                                {
                                  type: 'h4',
                                  content: 'Avoid',
                                  props: {
                                    className:
                                      'text-sm uppercase tracking-widest text-red-500 font-semibold mb-2',
                                  },
                                },
                                dontItem('Stock photos of people at laptops'),
                                dontItem('Colorful 3D renders or isometric illustrations'),
                                dontItem('Overly complex infographics'),
                                dontItem('Clip art, emoji-heavy visuals, or cartoon mascots'),
                                dontItem('Busy backgrounds that compete with content'),
                              ],
                            },
                          ],
                        },
                      ],
                    },

                    // ══ 8. Best Practices ═══════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'best-practices' },
                      children: [
                        {
                          type: 'h2',
                          content: 'Best Practices',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content:
                            'A quick reference for maintaining brand consistency across all Sovrium touchpoints.',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },
                        {
                          type: 'grid',
                          props: { className: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
                          children: [
                            // Visual
                            {
                              type: 'div',
                              props: {
                                className:
                                  'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg',
                              },
                              children: [
                                {
                                  type: 'h3',
                                  content: 'Visual Identity',
                                  props: {
                                    className: 'text-lg font-semibold mb-4 text-sovereignty-light',
                                  },
                                },
                                {
                                  type: 'div',
                                  props: { className: 'space-y-3' },
                                  children: [
                                    doItem('Dark backgrounds as default'),
                                    doItem('Accent blue for interactive elements only'),
                                    doItem('Monospace for code and technical content'),
                                    doItem('Generous whitespace between sections'),
                                    dontItem('Bright, saturated backgrounds'),
                                    dontItem('More than 2 accent colors per viewport'),
                                    dontItem('Cramped sections with no breathing room'),
                                  ],
                                },
                              ],
                            },
                            // Communication
                            {
                              type: 'div',
                              props: {
                                className:
                                  'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg',
                              },
                              children: [
                                {
                                  type: 'h3',
                                  content: 'Communication',
                                  props: {
                                    className: 'text-lg font-semibold mb-4 text-sovereignty-light',
                                  },
                                },
                                {
                                  type: 'div',
                                  props: { className: 'space-y-3' },
                                  children: [
                                    doItem('Lead with concrete capabilities'),
                                    doItem('Show code and config examples'),
                                    doItem('Be transparent about limitations'),
                                    dontItem('Marketing hyperbole or buzzwords'),
                                    dontItem('Vague promises without specifics'),
                                  ],
                                },
                              ],
                            },
                            // Technical
                            {
                              type: 'div',
                              props: {
                                className:
                                  'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg',
                              },
                              children: [
                                {
                                  type: 'h3',
                                  content: 'Technical Content',
                                  props: {
                                    className: 'text-lg font-semibold mb-4 text-sovereignty-light',
                                  },
                                },
                                {
                                  type: 'div',
                                  props: { className: 'space-y-3' },
                                  children: [
                                    doItem('Real code snippets over pseudocode'),
                                    doItem('Version numbers and concrete specs'),
                                    doItem('Architecture diagrams for complex flows'),
                                    dontItem('Fake terminal output or mocked data'),
                                    dontItem('Abstract descriptions of technical features'),
                                  ],
                                },
                              ],
                            },
                          ],
                        },

                        // Design Excellence Checklist
                        {
                          type: 'div',
                          props: {
                            className:
                              'mt-10 bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg',
                          },
                          children: [
                            {
                              type: 'h3',
                              content: 'Design Excellence Checklist',
                              props: {
                                className: 'text-lg font-semibold mb-4 text-sovereignty-light',
                              },
                            },
                            {
                              type: 'paragraph',
                              content:
                                'Before publishing any page, verify every item. These are the details that separate professional from amateur.',
                              props: {
                                className: 'text-sm text-sovereignty-gray-400 mb-4',
                              },
                            },
                            {
                              type: 'div',
                              props: { className: 'space-y-3' },
                              children: [
                                doItem(
                                  'Whitespace is generous \u2014 sections feel spacious, not crowded'
                                ),
                                doItem(
                                  'Typography hierarchy is clear \u2014 3\u20134 contrast levels, logical heading step-down'
                                ),
                                doItem(
                                  'Alignment is pixel-perfect \u2014 grid items align, spacing is mathematically consistent'
                                ),
                                doItem(
                                  'All interactive elements have smooth transitions \u2014 no instant color jumps'
                                ),
                                doItem(
                                  'Accent color is used sparingly \u2014 only on CTAs, links, and emphasis'
                                ),
                                doItem(
                                  'Content breathes \u2014 comfortable line-height, text not too wide'
                                ),
                                doItem('Same component is pixel-identical everywhere it appears'),
                                doItem(
                                  'No decoration without purpose \u2014 every visual element serves a function'
                                ),
                              ],
                            },
                          ],
                        },

                        // Authenticity filter
                        {
                          type: 'div',
                          props: {
                            className:
                              'mt-6 bg-sovereignty-gray-900 border border-sovereignty-accent/30 p-6 rounded-lg',
                          },
                          children: [
                            {
                              type: 'h3',
                              content: 'The Sovereignty Filter',
                              props: {
                                className: 'text-lg font-semibold mb-3 text-sovereignty-accent',
                              },
                            },
                            {
                              type: 'paragraph',
                              content:
                                'Before publishing any content, ask: \u201CDoes this reinforce the user\u2019s autonomy, or does it create dependency?\u201D If a message, design, or feature feels like it\u2019s locking someone in, building artificial urgency, or obscuring the truth \u2014 it doesn\u2019t belong in Sovrium.',
                              props: {
                                className: 'text-sovereignty-gray-300 leading-relaxed italic',
                              },
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
        },
      ],
    },

    // ─── Footer ─────────────────────────────────────────────────────────────
    {
      type: 'footer',
      props: {
        className:
          'py-12 bg-sovereignty-darker border-t border-sovereignty-gray-800 text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-5xl mx-auto px-4 text-center' },
          children: [
            {
              type: 'div',
              props: { className: 'flex items-center justify-center gap-3 mb-4' },
              children: [
                {
                  type: 'span',
                  content: 'v1.0',
                  props: {
                    className:
                      'text-xs font-mono px-2 py-0.5 bg-sovereignty-gray-800 rounded text-sovereignty-gray-400',
                  },
                },
                {
                  type: 'span',
                  content: '\u00B7',
                  props: { className: 'text-sovereignty-gray-600' },
                },
                {
                  type: 'span',
                  content: 'February 2026',
                  props: { className: 'text-xs text-sovereignty-gray-500' },
                },
              ],
            },
            {
              type: 'link',
              content: 'sovrium.com',
              props: {
                href: '/',
                className:
                  'text-sm text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors',
              },
            },
            {
              type: 'paragraph',
              content:
                '\u00A9 2025-2026 ESSENTIAL SERVICES. Sovrium\u00AE is a registered trademark of ESSENTIAL SERVICES.',
              props: { className: 'text-xs text-sovereignty-gray-600 mt-4' },
            },
          ],
        },
      ],
    },
  ],
}
