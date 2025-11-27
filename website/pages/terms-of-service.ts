/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/index'

export const termsOfService: Page = {
  name: 'terms-of-service',
  path: '/terms-of-service',
  meta: {
    title: 'Terms of Service - Sovrium',
    description:
      'Terms of service and license information for Sovrium, the self-hosted configuration-driven platform',
    canonical: 'https://sovrium.com/terms-of-service',
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
              content: 'Terms of Service',
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
            // Agreement
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '1. Agreement to Terms',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'By accessing or using the Sovrium software, website, or any related services (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms") and all applicable laws and regulations. If you do not agree with these Terms, you may not use our Services.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // License
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '2. Software License',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'Sovrium is licensed under the Business Source License 1.1 (BSL 1.1). The full license terms are available in the LICENSE.md file in the source repository.',
                  props: { className: 'text-sovereignty-light mb-4' },
                },

                {
                  type: 'h3',
                  content: '2.1 Permitted Uses',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: 'You may use Sovrium for:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '✓ Internal business use within your organization',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '✓ Personal projects and development',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '✓ Educational and academic purposes',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '✓ Non-competing client deployments',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '✓ Creating applications for your own use or your direct clients',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: '2.2 Prohibited Uses',
                  props: { className: 'text-xl font-semibold mb-3 mt-6 text-sovereignty-teal' },
                },
                {
                  type: 'paragraph',
                  content: 'Without a commercial license, you may NOT:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content:
                        '❌ Offer Sovrium as a commercial hosted or managed service to third parties',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '❌ Create a competitive SaaS offering based on Sovrium',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '❌ Resell, sublicense, or distribute Sovrium as a commercial product',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '❌ Remove or modify copyright notices or license terms',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: '2.3 Change Date',
                  props: { className: 'text-xl font-semibold mb-3 mt-6 text-sovereignty-teal' },
                },
                {
                  type: 'paragraph',
                  content:
                    'On January 1, 2029, the BSL 1.1 license will automatically convert to Apache License 2.0, making Sovrium fully open source.',
                  props: { className: 'text-sovereignty-light font-semibold' },
                },

                {
                  type: 'h3',
                  content: '2.4 Commercial Licensing',
                  props: { className: 'text-xl font-semibold mb-3 mt-6 text-sovereignty-teal' },
                },
                {
                  type: 'paragraph',
                  content:
                    'For commercial hosting, managed services, or competitive use cases, please contact license@sovrium.com to obtain a commercial license.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Trademark
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '3. Trademark and Branding',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content: 'Sovrium is a registered trademark of ESSENTIAL SERVICES. You may:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '✓ State that your application is "Powered by Sovrium"',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '✓ Use the Sovrium name in factual statements about the software',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '✓ Include Sovrium in technical documentation',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: 'You may NOT:',
                  props: { className: 'text-sovereignty-light mb-3 mt-4' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '❌ Use Sovrium in your product name without permission',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '❌ Imply endorsement by ESSENTIAL SERVICES',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '❌ Modify the Sovrium logo without authorization',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content:
                    'For detailed trademark guidelines, see TRADEMARK.md in the source repository.',
                  props: { className: 'text-sovereignty-light mt-4' },
                },
              ],
            },

            // Warranty Disclaimer
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '4. Warranty Disclaimer',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.',
                  props: { className: 'text-sovereignty-light uppercase mb-4' },
                },
                {
                  type: 'paragraph',
                  content: 'ESSENTIAL SERVICES does not warrant that:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• The software will meet your requirements',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• The software will be uninterrupted or error-free',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Any defects will be corrected',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• The software is free of vulnerabilities',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Limitation of Liability
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '5. Limitation of Liability',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'IN NO EVENT SHALL ESSENTIAL SERVICES, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, OR OTHER INTANGIBLE LOSSES.',
                  props: { className: 'text-sovereignty-light uppercase mb-4' },
                },
                {
                  type: 'paragraph',
                  content:
                    'This limitation applies even if ESSENTIAL SERVICES has been advised of the possibility of such damages.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Indemnification
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '6. Indemnification',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'You agree to indemnify and hold harmless ESSENTIAL SERVICES from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• Your use of the software',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Your violation of these Terms',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Your violation of any third-party rights',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Your applications built with Sovrium',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Modifications
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '7. Modifications to Terms',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting to the website. Your continued use of the Services after changes constitutes acceptance of the modified Terms.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Termination
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '8. Termination',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'We may terminate or suspend your access to the Services immediately, without prior notice, for any reason, including:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• Breach of these Terms',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Violation of the BSL 1.1 license',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Unauthorized commercial use',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Harmful or malicious use',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Governing Law
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '9. Governing Law',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'These Terms shall be governed by and construed in accordance with the laws of France, without regard to its conflict of law provisions. Any disputes shall be resolved in the courts of France.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Severability
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '10. Severability',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Entire Agreement
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '11. Entire Agreement',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content:
                    'These Terms, together with the BSL 1.1 license and any commercial license agreements, constitute the entire agreement between you and ESSENTIAL SERVICES regarding the use of Sovrium.',
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
                  content: '12. Contact Information',
                  props: { className: 'text-2xl font-semibold mb-4 text-sovereignty-accent' },
                },
                {
                  type: 'paragraph',
                  content: 'For questions about these Terms or licensing:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '• License inquiries: license@sovrium.com',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• General questions: GitHub Issues',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Company: ESSENTIAL SERVICES',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Website: sovrium.com',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Acceptance
            {
              type: 'div',
              props: {
                className:
                  'mb-8 p-4 sm:p-6 bg-sovereignty-gray-900 border border-sovereignty-accent rounded-lg',
              },
              children: [
                {
                  type: 'h2',
                  content: '⚠️ Important Notice',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'By downloading, installing, or using Sovrium, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and the Business Source License 1.1.',
                  props: { className: 'text-sovereignty-light font-semibold' },
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
                  content: 'Privacy Policy',
                  props: {
                    href: '/privacy-policy',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'link',
                  content: 'View License',
                  props: {
                    href: 'https://github.com/sovrium/sovrium/blob/main/LICENSE.md',
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
