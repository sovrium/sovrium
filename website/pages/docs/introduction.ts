/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutTip, codeBlock, docsPage, sectionHeader } from './shared'

export const docsIntroduction = docsPage({
  activeId: 'introduction',
  path: '/docs',
  metaTitle: '$t:docs.introduction.meta.title',
  metaDescription: '$t:docs.introduction.meta.description',
  toc: [
    { label: '$t:docs.introduction.what.title', anchor: 'what-is-sovrium' },
    { label: '$t:docs.introduction.why.title', anchor: 'why-sovrium' },
    { label: '$t:docs.introduction.how.title', anchor: 'how-it-works' },
    { label: '$t:docs.introduction.next.title', anchor: 'next-steps' },
  ],
  content: [
    // ── Header ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.introduction.header.title',
          props: { className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light' },
        },
        {
          type: 'paragraph',
          content: '$t:docs.introduction.header.description',
          props: {
            className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed',
          },
        },
      ],
    },

    // ── What is Sovrium? ────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.introduction.what.title',
          '$t:docs.introduction.what.description',
          'what-is-sovrium'
        ),
        {
          type: 'paragraph',
          content: '$t:docs.introduction.what.detail',
          props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed mb-6' },
        },
        codeBlock(
          'name: my-app\n\ntables:\n  - id: 1\n    name: tasks\n    fields:\n      - id: 1\n        name: title\n        type: single-line-text\n        required: true\n\nauth:\n  strategies:\n    emailPassword: true\n\ntheme:\n  colors:\n    primary: "#3b82f6"',
          'yaml'
        ),
      ],
    },

    // ── Why Sovrium? ────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.introduction.why.title',
          '$t:docs.introduction.why.description',
          'why-sovrium'
        ),
        {
          type: 'div',
          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4' },
          children: [
            {
              $ref: 'docs-info-card-icon',
              vars: {
                iconName: 'shield',
                title: '$t:docs.introduction.why.point1.title',
                description: '$t:docs.introduction.why.point1.description',
              },
            },
            {
              $ref: 'docs-info-card-icon',
              vars: {
                iconName: 'file-cog',
                title: '$t:docs.introduction.why.point2.title',
                description: '$t:docs.introduction.why.point2.description',
              },
            },
            {
              $ref: 'docs-info-card-icon',
              vars: {
                iconName: 'rocket',
                title: '$t:docs.introduction.why.point3.title',
                description: '$t:docs.introduction.why.point3.description',
              },
            },
            {
              $ref: 'docs-info-card-icon',
              vars: {
                iconName: 'git-branch',
                title: '$t:docs.introduction.why.point4.title',
                description: '$t:docs.introduction.why.point4.description',
              },
            },
          ],
        },
      ],
    },

    // ── How it works ────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.introduction.how.title',
          '$t:docs.introduction.how.description',
          'how-it-works'
        ),
        {
          type: 'div',
          props: { className: 'space-y-3 mt-4' },
          children: [
            {
              type: 'div',
              props: { className: 'flex items-start gap-3' },
              children: [
                {
                  type: 'span',
                  content: '1',
                  props: {
                    className:
                      'flex-shrink-0 w-6 h-6 rounded-full bg-sovereignty-accent/20 text-sovereignty-accent flex items-center justify-center text-xs font-bold',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.introduction.how.step1',
                  props: { className: 'text-sm text-sovereignty-gray-300 pt-0.5' },
                },
              ],
            },
            {
              type: 'div',
              props: { className: 'flex items-start gap-3' },
              children: [
                {
                  type: 'span',
                  content: '2',
                  props: {
                    className:
                      'flex-shrink-0 w-6 h-6 rounded-full bg-sovereignty-accent/20 text-sovereignty-accent flex items-center justify-center text-xs font-bold',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.introduction.how.step2',
                  props: { className: 'text-sm text-sovereignty-gray-300 pt-0.5' },
                },
              ],
            },
            {
              type: 'div',
              props: { className: 'flex items-start gap-3' },
              children: [
                {
                  type: 'span',
                  content: '3',
                  props: {
                    className:
                      'flex-shrink-0 w-6 h-6 rounded-full bg-sovereignty-accent/20 text-sovereignty-accent flex items-center justify-center text-xs font-bold',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.introduction.how.step3',
                  props: { className: 'text-sm text-sovereignty-gray-300 pt-0.5' },
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Next Steps ──────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.introduction.next.title',
          '$t:docs.introduction.next.description',
          'next-steps'
        ),
        calloutTip('$t:docs.installation.header.title', '$t:docs.installation.header.description'),
      ],
    },
  ],
})
