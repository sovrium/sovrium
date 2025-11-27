/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/index'

export const privacyPolicy: Page = {
  name: 'privacy-policy',
  path: '/privacy-policy',
  meta: {
    title: 'Privacy Policy - Sovrium',
    description: 'Privacy policy for Sovrium, the self-hosted configuration-driven platform',
    canonical: 'https://sovrium.com/privacy-policy',
  },
  sections: [
    // Header
    {
      type: 'section',
      props: {
        className:
          'py-16 bg-gradient-to-b from-sovereignty-dark to-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-4xl mx-auto px-4' },
          children: [
            {
              type: 'h1',
              content: 'Privacy Policy',
              props: { className: 'text-3xl sm:text-4xl md:text-5xl font-bold mb-4' },
            },
            {
              type: 'paragraph',
              content: 'Last Updated: January 1, 2025',
              props: { className: 'text-sovereignty-gray-400' },
            },
          ],
        },
      ],
    },

    // Content
    {
      type: 'section',
      props: {
        className: 'py-8 md:py-12 bg-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-4xl mx-auto px-4 sm:px-6 md:px-8 prose prose-invert' },
          children: [
            // Introduction
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '1. Introduction',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'ESSENTIAL SERVICES ("we", "us", "our") respects your privacy. This Privacy Policy explains how we collect, use, and protect information related to sovrium.com (the "Website") and the Sovrium software (the "Software").',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content:
                    'Sovrium is designed with digital sovereignty in mind. As a self-hosted platform, we believe your data should remain under your control.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Data Collection
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '2. Data Collection',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },

                {
                  type: 'h3',
                  content: '2.1 Website Analytics',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'We may use privacy-respecting analytics services (such as Plausible Analytics) to understand website traffic and usage patterns. These services:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• Do not use cookies',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Do not collect personal data',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Do not track users across sites',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Are fully GDPR compliant',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: '2.2 Self-Hosted Software',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'Sovrium is self-hosted software that runs on your infrastructure. We do not:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• Collect data from your Sovrium installations',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Store or process your application data',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Have access to your configurations',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Monitor your usage or deployments',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content:
                    'You are the data controller for all data processed by your Sovrium installation.',
                  props: { className: 'text-sovereignty-light mt-3 font-semibold' },
                },

                {
                  type: 'h3',
                  content: '2.3 GitHub and Open Source',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'When you interact with our GitHub repository (issues, pull requests, discussions), GitHub collects data according to their privacy policy. We may see public information you share on GitHub.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Use of Information
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '3. Use of Information',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: 'Any analytics data we collect is used solely to:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• Improve our website and documentation',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Understand which features interest users',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Fix technical issues with the website',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Plan development priorities',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Third-Party Services
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '4. Third-Party Services',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content: 'Our website may link to or interact with third-party services:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• GitHub (for source code and issues)',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Google Fonts (for typography)',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• CDN services (for faster content delivery)',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content:
                    'These services have their own privacy policies and data practices. We encourage you to review their policies.',
                  props: { className: 'text-sovereignty-light mt-3' },
                },
              ],
            },

            // Your Rights
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '5. Your Rights',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content: 'Under GDPR and other privacy laws, you have the right to:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• Access any personal data we hold about you',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Request correction of inaccurate data',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Request deletion of your data',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Object to data processing',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Request data portability',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: 'To exercise these rights, contact us at privacy@sovrium.com.',
                  props: { className: 'text-sovereignty-light mt-3' },
                },
              ],
            },

            // Security
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '6. Security',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'We take reasonable measures to protect any information we collect. However, as we collect minimal data and the Sovrium software is self-hosted, your primary security responsibility lies with your own infrastructure and deployment practices.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Children\'s Privacy
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: "7. Children's Privacy",
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'Our website and software are not directed to children under 13. We do not knowingly collect personal information from children under 13.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Changes to This Policy
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '8. Changes to This Policy',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Your continued use of the website after changes constitutes acceptance of the updated policy.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Contact Information
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '9. Contact Information',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content: 'For privacy-related inquiries:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• Email: privacy@sovrium.com',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• GitHub Issues: https://github.com/sovrium/sovrium/issues',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Company: ESSENTIAL SERVICES',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Data Protection Officer
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '10. Data Protection',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'As a company committed to digital sovereignty, we practice data minimization. We collect the absolute minimum data necessary and encourage you to maintain control of your own data through self-hosting.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },
          ],
        },
      ],
    },

    // Footer
    {
      type: 'section',
      props: {
        className:
          'py-8 bg-sovereignty-darker border-t border-sovereignty-gray-800 text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-4xl mx-auto px-4 text-center' },
          children: [
            {
              type: 'flex',
              props: {
                className:
                  'flex-col sm:flex-row justify-center gap-4 sm:gap-6 md:gap-8 text-sovereignty-gray-400 mb-4 text-center sm:text-left',
              },
              children: [
                {
                  type: 'link',
                  content: 'Back to Home',
                  props: {
                    href: '/',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'link',
                  content: 'Terms of Service',
                  props: {
                    href: '/terms-of-service',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'link',
                  content: 'GitHub',
                  props: {
                    href: 'https://github.com/sovrium/sovrium',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
              ],
            },
            {
              type: 'paragraph',
              content: '© 2025 ESSENTIAL SERVICES. Sovrium is a trademark of ESSENTIAL SERVICES.',
              props: { className: 'text-sovereignty-gray-500 text-sm' },
            },
          ],
        },
      ],
    },
  ],
}
