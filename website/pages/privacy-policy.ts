/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from './favicons'
import { footer } from './footer'
import { navbar } from './navbar'
import type { Page } from '@/index'

export const privacyPolicy: Page = {
  name: 'privacy-policy',
  path: '/privacy-policy',
  meta: {
    title: 'Privacy Policy - Sovrium',
    description:
      'Privacy policy for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',
    canonical: 'https://sovrium.com/privacy-policy',
    openGraph: {
      title: 'Privacy Policy - Sovrium',
      description:
        'Privacy policy for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',
      url: 'https://sovrium.com/privacy-policy',
      siteName: 'Sovrium',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: 'Privacy Policy - Sovrium',
      description:
        'Privacy policy for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',
    },
    favicons,
  },
  sections: [
    // Navigation Bar
    navbar,

    // Header
    {
      type: 'section',
      props: {
        className:
          'py-16 md:py-24 bg-gradient-to-b from-sovereignty-dark to-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-4xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h1',
              content: 'Privacy Policy',
              props: { className: 'text-3xl sm:text-4xl md:text-5xl font-bold mb-4' },
            },
            {
              type: 'paragraph',
              content: 'Last Updated: February 20, 2026',
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
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-4xl mx-auto px-4 sm:px-6 md:px-8' },
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
                  content: '2.2 Cookies',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'The sovrium.com website does not use cookies. We do not set any first-party or third-party cookies. No cookie consent banner is necessary because no cookies are used.',
                  props: { className: 'text-sovereignty-light' },
                },

                {
                  type: 'h3',
                  content: '2.3 Self-Hosted Software',
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
                  content: '2.4 GitHub and Open Source',
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

                {
                  type: 'h3',
                  content: '2.5 Facebook and Social Login',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'Sovrium-powered applications may integrate Facebook Login (or other social authentication providers) as an optional sign-in method. When a user authenticates via Facebook Login, the following data may be received by the Sovrium application:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '\u2022 Name and profile picture',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '\u2022 Email address',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '\u2022 Facebook user ID',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content:
                    'Legal basis: This data is processed under GDPR Art. 6(1)(b) (performance of a contract) when you choose to sign in via Facebook Login, and Art. 6(1)(a) (consent) as you explicitly authorize the data sharing through Facebook\u2019s authorization dialog.',
                  props: { className: 'text-sovereignty-light mt-3 mb-3' },
                },
                {
                  type: 'paragraph',
                  content:
                    'This data is used solely for the purpose of authenticating your identity and creating your user account within the Sovrium-powered application. For self-hosted installations, this data is stored on the infrastructure controlled by the organization operating the application. ESSENTIAL SERVICES does not have access to this data unless it directly operates the application.',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'paragraph',
                  content:
                    'You may request deletion of your data at any time. See our Data Deletion page at sovrium.com/data-deletion for detailed instructions.',
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

                {
                  type: 'h3',
                  content: '3.1 Data Retention',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content:
                        '\u2022 Website analytics: Aggregated and anonymized. No personal data is retained.',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '\u2022 Facebook Login data (for ESSENTIAL SERVICES-operated applications): Retained as long as your user account is active. Deleted within 30 days of a valid deletion request.',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '\u2022 Self-hosted installations: Data retention is determined by the organization operating the Sovrium instance.',
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
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
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
                      content:
                        '• Facebook/Meta (for social authentication in Sovrium-powered applications)',
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
                    'These services have their own privacy policies and data practices. We encourage you to review their policies, in particular the Meta Privacy Policy at https://www.facebook.com/privacy/policy/.',
                  props: { className: 'text-sovereignty-light mt-3' },
                },

                {
                  type: 'h3',
                  content: '4.1 Data Sharing',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'ESSENTIAL SERVICES does not sell, rent, or trade your personal data to third parties. We do not share your personal data with third parties for their marketing purposes. Data may only be shared with third parties in the following limited circumstances:',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content:
                        '\u2022 With your explicit consent (e.g., when you authorize a social login)',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '\u2022 To comply with legal obligations or respond to lawful government requests',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        '\u2022 To protect the rights, property, or safety of ESSENTIAL SERVICES, our users, or the public',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // International Data Transfers
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '5. International Data Transfers',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content:
                    'When you use Facebook Login or other social authentication providers, your data may be transferred to and processed in countries outside the European Economic Area (EEA), including the United States. These transfers are necessary for the performance of the authentication service and are conducted in accordance with applicable data protection laws.',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content:
                    'Where data is transferred outside the EEA, we rely on appropriate safeguards such as the EU-US Data Privacy Framework, Standard Contractual Clauses (SCCs), or other lawful transfer mechanisms to ensure your data is adequately protected.',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content:
                    'For self-hosted Sovrium installations, data transfers are determined by the organization operating the instance. ESSENTIAL SERVICES has no involvement in those transfers.',
                  props: { className: 'text-sovereignty-light' },
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
                  content: '6. Your Rights',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
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
                  content: '7. Security',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
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
                  content: "8. Children's Privacy",
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
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
                  content: '9. Changes to This Policy',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
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
                  content: '10. Contact Information',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
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
                      content: '• Company: ESSENTIAL SERVICES, SAS au capital de 10 000 \u20AC',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• RCS Paris \u2014 SIREN: 834 241 481',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• SIRET: 834 241 481 00029',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• TVA: FR04834241481',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Address: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• President: Thomas Jeanneau',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '• Data Deletion: sovrium.com/data-deletion',
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
                  content: '11. Data Protection',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
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
    footer,
  ],
}
