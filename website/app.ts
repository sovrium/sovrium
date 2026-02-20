/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type App } from '@/index'
import { home } from './pages/home'
import { partners } from './pages/partners'
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
  languages: {
    default: 'en',
    supported: [
      { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' },
      { code: 'fr', locale: 'fr-FR', label: 'Fran\u00E7ais', direction: 'ltr' },
    ],
    translations: {
      en: {
        // ════════════════════════════════════════════════════════════════════
        //  HOME PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Home: Meta ──────────────────────────────────────────────────────
        'home.meta.title': 'Sovrium \u2014 Own Your Software',
        'home.meta.description':
          'Build complete business applications with a single configuration file. Self-hosted, open-source, no vendor lock-in.',
        'home.meta.og.title': 'Sovrium \u2014 Own Your Software',
        'home.meta.og.description':
          'Configuration-driven application platform. Self-hosted, no vendor lock-in.',
        'home.meta.twitter.title': 'Sovrium \u2014 Own Your Software',
        'home.meta.twitter.description':
          'Configuration-driven application platform. Self-hosted, no vendor lock-in.',

        // ── Home: Hero ──────────────────────────────────────────────────────
        'home.hero.title': 'Sovrium, the sovereignty element',
        'home.hero.subtitle': 'Own your data. Own your tools. Own your future.',
        'home.hero.description':
          'Break free from SaaS dependency with a self-hosted, configuration-driven platform that puts you back in control.',
        'home.hero.cta.primary': 'Get Started',
        'home.hero.cta.secondary': 'View on GitHub',

        // ── Home: Problem Statement ─────────────────────────────────────────
        'home.problem.title': 'The SaaS Trap',
        'home.problem.stat1.value': '$10K+',
        'home.problem.stat1.label': 'Average annual SaaS spend per employee',
        'home.problem.stat2.value': '0%',
        'home.problem.stat2.label': 'Data you actually own on SaaS platforms',
        'home.problem.stat3.value': '73%',
        'home.problem.stat3.label': 'Companies worried about vendor lock-in',
        'home.problem.hidden.title': 'The Hidden Costs of SaaS Dependency',
        'home.problem.hidden.cost1.title': 'Vendor Lock-in \u2014 ',
        'home.problem.hidden.cost1.description':
          'Your data, workflows, and team habits are trapped in someone else\u2019s platform.',
        'home.problem.hidden.cost2.title': 'Per-Seat Pricing \u2014 ',
        'home.problem.hidden.cost2.description':
          'Costs scale with headcount, not value. Growing your team means growing your SaaS bill.',
        'home.problem.hidden.cost3.title': 'Feature Bloat \u2014 ',
        'home.problem.hidden.cost3.description':
          'You pay for thousands of features you never use, while the ones you need are behind enterprise paywalls.',
        'home.problem.hidden.cost4.title': 'Data Sovereignty \u2014 ',
        'home.problem.hidden.cost4.description':
          'Your business data lives on servers you don\u2019t control, in jurisdictions you didn\u2019t choose.',
        'home.problem.hidden.cost5.title': 'Integration Tax \u2014 ',
        'home.problem.hidden.cost5.description':
          'Connecting SaaS tools requires middleware, custom APIs, and constant maintenance.',

        // ── Home: Solution Overview ─────────────────────────────────────────
        'home.solution.title': 'One Config. Full Application.',
        'home.solution.description':
          'Sovrium turns a simple configuration file into a complete business application \u2014 authentication, database, API, pages, and admin panel included.',
        'home.solution.code.alsoWorks': 'Also works with YAML and JSON configs:',
        'home.solution.howItWorks.title': 'How It Works',
        'home.solution.howItWorks.step1.title': 'Configure',
        'home.solution.howItWorks.step1.description':
          'Define your app schema in TypeScript, YAML, or JSON.',
        'home.solution.howItWorks.step2.title': 'Deploy',
        'home.solution.howItWorks.step2.description':
          'Run on your server, your cloud, your laptop.',
        'home.solution.howItWorks.step3.title': 'Own',
        'home.solution.howItWorks.step3.description': 'Full source code access, full data control.',
        'home.solution.howItWorks.step4.title': 'Evolve',
        'home.solution.howItWorks.step4.description':
          'Add features by updating your config. No migration pain.',

        // ── Home: Core Principles ───────────────────────────────────────────
        'home.principles.title': 'Core Principles',
        'home.principles.sovereignty.title': 'Digital Sovereignty',
        'home.principles.sovereignty.point1': '\u2705 Self-hosted on your infrastructure',
        'home.principles.sovereignty.point2': '\u2705 Full data ownership and portability',
        'home.principles.sovereignty.point3': '\u2705 Source-available with open-source roadmap',
        'home.principles.sovereignty.point4':
          '\u2705 No telemetry, no tracking, no data harvesting',
        'home.principles.configuration.title': 'Configuration Over Coding',
        'home.principles.configuration.point1': '\u2705 TypeScript, YAML, or JSON configuration',
        'home.principles.configuration.point2': '\u2705 Type-safe with full IDE completion',
        'home.principles.configuration.point3': '\u2705 No boilerplate, no scaffolding',
        'home.principles.configuration.point4': '\u2705 From config to running app in seconds',
        'home.principles.dependencies.title': 'Minimal Dependencies',
        'home.principles.dependencies.point1': '\u2705 Single binary, single dependency: Bun',
        'home.principles.dependencies.point2': '\u2705 No Docker required for development',
        'home.principles.dependencies.point3': '\u2705 PostgreSQL for production data',
        'home.principles.dependencies.point4': '\u2705 No vendor SDKs, no cloud lock-in',
        'home.principles.business.title': 'Business Focus',
        'home.principles.business.point1': '\u2705 Built for real business workflows',
        'home.principles.business.point2': '\u2705 Authentication, roles, and permissions included',
        'home.principles.business.point3': '\u2705 API-first: every table gets a REST API',
        'home.principles.business.point4': '\u2705 Multi-language and theming out of the box',

        // ── Home: Comparison ────────────────────────────────────────────────
        'home.comparison.title': 'Why Not Just Use SaaS?',
        'home.comparison.stat1': '90% less cost than equivalent SaaS tools',
        'home.comparison.stat2': '100% data ownership, forever',
        'home.comparison.table.title': 'Sovrium vs Traditional SaaS',
        'home.comparison.table.header.aspect': 'Aspect',
        'home.comparison.table.row1.aspect': 'Data Ownership',
        'home.comparison.table.row1.sovrium': '\u2705 100% yours',
        'home.comparison.table.row1.saas': '\u274C Vendor-owned',
        'home.comparison.table.row2.aspect': 'Source Code',
        'home.comparison.table.row2.sovrium': '\u2705 Full access',
        'home.comparison.table.row2.saas': '\u274C Closed source',
        'home.comparison.table.row3.aspect': 'Monthly Cost',
        'home.comparison.table.row3.sovrium': '\u2705 Server costs only',
        'home.comparison.table.row3.saas': '\u274C $50\u2013500+/user/mo',
        'home.comparison.table.row4.aspect': 'Vendor Lock-in',
        'home.comparison.table.row4.sovrium': '\u2705 Zero',
        'home.comparison.table.row4.saas': '\u274C High',
        'home.comparison.table.row5.aspect': 'Customization',
        'home.comparison.table.row5.sovrium': '\u2705 Unlimited',
        'home.comparison.table.row5.saas': '\u26A0\uFE0F Limited',
        'home.comparison.table.row6.aspect': 'Version Control',
        'home.comparison.table.row6.sovrium': '\u2705 Git-native',
        'home.comparison.table.row6.saas': '\u26A0\uFE0F Limited/None',
        'home.comparison.table.row7.aspect': 'Privacy',
        'home.comparison.table.row7.sovrium': '\u2705 Your servers',
        'home.comparison.table.row7.saas': '\u274C Third-party',

        // ── Home: Use Cases ─────────────────────────────────────────────────
        'home.useCases.title': 'Built For Real Work',
        'home.useCases.internal.title': 'Internal Tools',
        'home.useCases.internal.description':
          'CRM, project management, inventory tracking \u2014 built specifically for how your team works.',
        'home.useCases.portals.title': 'Client Portals',
        'home.useCases.portals.description':
          'Secure dashboards for clients to view reports, submit requests, and track progress.',
        'home.useCases.business.title': 'Business Apps',
        'home.useCases.business.description':
          'Custom applications for workflows that off-the-shelf SaaS can\u2019t handle.',
        'home.useCases.api.title': 'API Backends',
        'home.useCases.api.description':
          'REST APIs with authentication, validation, and database \u2014 zero boilerplate.',
        'home.useCases.static.title': 'Static Sites',
        'home.useCases.static.description':
          'Marketing pages, documentation sites, and landing pages with i18n support.',
        'home.useCases.mvp.title': 'MVPs & Prototypes',
        'home.useCases.mvp.description':
          'From idea to working product in hours, not weeks. Iterate with config changes.',

        // ── Home: Platform Features ─────────────────────────────────────────
        'home.features.title': 'Everything You Need',
        'home.features.subtitle': 'A complete platform, not another framework to learn.',
        'home.features.auth.title': '\uD83D\uDD10 Authentication',
        'home.features.auth.point1': '\u2022 Email/password & social OAuth',
        'home.features.auth.point2': '\u2022 Role-based access (admin, member, viewer)',
        'home.features.auth.point3': '\u2022 Session management',
        'home.features.auth.point4': '\u2022 Two-factor authentication',
        'home.features.auth.point5': '\u2022 Passkeys support',
        'home.features.auth.point6': '\u2022 Custom user fields',
        'home.features.tables.title': '\uD83D\uDDC2\uFE0F Tables & Data',
        'home.features.tables.point1': '\u2022 15+ field types (text, email, number, \u2026)',
        'home.features.tables.point2': '\u2022 Automatic CRUD API',
        'home.features.tables.point3': '\u2022 Relations and lookups',
        'home.features.tables.point4': '\u2022 Sorting, filtering, pagination',
        'home.features.tables.point5': '\u2022 Formula fields',
        'home.features.tables.point6': '\u2022 Import/export',
        'home.features.api.title': '\uD83D\uDD0C Records API',
        'home.features.api.point1': '\u2022 Auto-generated REST endpoints',
        'home.features.api.point2': '\u2022 OpenAPI documentation',
        'home.features.api.point3': '\u2022 Type-safe client SDK',
        'home.features.api.point4': '\u2022 Filtering and sorting',
        'home.features.api.point5': '\u2022 Bulk operations',
        'home.features.api.point6': '\u2022 Webhook support',
        'home.features.pages.title': '\uD83D\uDCBB Pages & UI',
        'home.features.pages.point1': '\u2022 Server-rendered React pages',
        'home.features.pages.point2': '\u2022 Component library included',
        'home.features.pages.point3': '\u2022 Responsive by default',
        'home.features.pages.point4': '\u2022 Custom layouts',
        'home.features.pages.point5': '\u2022 Form builder',
        'home.features.pages.point6': '\u2022 Navigation system',
        'home.features.theming.title': '\uD83C\uDFA8 Theming & i18n',
        'home.features.theming.point1': '\u2022 Custom color schemes',
        'home.features.theming.point2': '\u2022 Typography system',
        'home.features.theming.point3': '\u2022 Dark mode support',
        'home.features.theming.point4': '\u2022 Multi-language (i18n)',
        'home.features.theming.point5': '\u2022 CSS variable theming',
        'home.features.theming.point6': '\u2022 Brand-consistent design',
        'home.features.admin.title': '\u2699\uFE0F Admin & Operations',
        'home.features.admin.point1': '\u2022 Admin dashboard',
        'home.features.admin.point2': '\u2022 User management',
        'home.features.admin.point3': '\u2022 Activity logs',
        'home.features.admin.point4': '\u2022 Database studio',
        'home.features.admin.point5': '\u2022 CLI tools',
        'home.features.admin.point6': '\u2022 Health monitoring',

        // ── Home: Tech Stack ────────────────────────────────────────────────
        'home.techStack.title': 'Modern Stack. No Compromises.',
        'home.techStack.subtitle':
          'Built on battle-tested technologies chosen for performance, reliability, and developer experience.',

        // ── Home: Getting Started ───────────────────────────────────────────
        'home.gettingStarted.title': 'Get Started in Minutes',
        'home.gettingStarted.step1.title': 'Install',
        'home.gettingStarted.step2.title': 'Configure',
        'home.gettingStarted.step2.description': 'Define your app schema in a config file',
        'home.gettingStarted.step3.title': 'Launch',
        'home.gettingStarted.step4.title': 'Customize',
        'home.gettingStarted.step4.description':
          'Add tables, pages, auth \u2014 all through configuration',
        'home.gettingStarted.status.title': 'Early Access',
        'home.gettingStarted.status.description':
          'Sovrium is in active development. Star the repo and follow along as we build the future of self-hosted applications.',
        'home.gettingStarted.status.cta': 'Star on GitHub',

        // ── Home: Footer ────────────────────────────────────────────────────
        'home.footer.cta.title': 'Ready to Own Your Software?',
        'home.footer.cta.docs': 'Read the Docs',
        'home.footer.cta.github': 'View on GitHub',
        'home.footer.privacy': 'Privacy Policy',
        'home.footer.privacy.href': '/en/privacy-policy',
        'home.footer.terms': 'Terms of Service',
        'home.footer.terms.href': '/en/terms-of-service',
        'home.footer.license': 'License',
        'home.footer.trademark': 'Trademark',
        'home.footer.partners': 'Partners',
        'home.footer.partners.href': '/en/partners',
        'home.footer.copyright':
          '\u00A9 2025-2026 ESSENTIAL SERVICES. Sovrium is a trademark of ESSENTIAL SERVICES.',

        // ════════════════════════════════════════════════════════════════════
        //  PARTNERS PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Partners: Meta ──────────────────────────────────────────────────
        'partners.meta.title': 'Sovrium Partners - Custom Software Solutions',
        'partners.meta.description':
          'ESSENTIAL SERVICES builds tailor-made software solutions with Sovrium. 50+ clients served, 200+ tools built, 10,000+ hours saved.',
        'partners.meta.og.title': 'Sovrium Partners - Custom Software Solutions',
        'partners.meta.og.description':
          'Tailor-made solutions to your software challenges. Built on Sovrium, deployed on your infrastructure.',
        'partners.meta.twitter.title': 'Sovrium Partners - Custom Software Solutions',
        'partners.meta.twitter.description':
          'Tailor-made solutions to your software challenges. Built with Sovrium.',

        // ── Partners: Hero ──────────────────────────────────────────────────
        'partners.hero.title': 'Tailor-made solutions to your software challenges',
        'partners.hero.subtitle':
          'We design, build, and maintain custom internal tools on your infrastructure. No vendor lock-in, no surprise bills \u2014 just software that works for your team.',
        'partners.hero.cta.primary': 'Join the Waitlist',
        'partners.hero.cta.secondary': 'Our Methodology',

        // ── Partners: Trusted By ────────────────────────────────────────────
        'partners.trust.title': 'Trusted By',

        // ── Partners: Stats ─────────────────────────────────────────────────
        'partners.stats.title': 'Proven Track Record',
        'partners.stats.clients.stat': '50+',
        'partners.stats.clients.title': 'Clients Served',
        'partners.stats.clients.description':
          'Startups, SMEs, and enterprises trust us to streamline their operations with custom-built tools.',
        'partners.stats.tools.stat': '200+',
        'partners.stats.tools.title': 'Tools Built',
        'partners.stats.tools.description':
          'From internal dashboards to full business applications, tailored to each client\u2019s unique workflows.',
        'partners.stats.hours.stat': '10,000+',
        'partners.stats.hours.title': 'Hours Saved',
        'partners.stats.hours.description':
          'Automating repetitive tasks and consolidating scattered tools into cohesive platforms.',

        // ── Partners: Process (5 steps) ─────────────────────────────────────
        'partners.process.title': 'Our Process',
        'partners.process.subtitle':
          'A proven 5-step approach to deliver software that fits your needs perfectly.',
        'partners.process.step1.title': 'Listen',
        'partners.process.step1.description':
          'Understand your workflows, pain points, and goals through in-depth discovery sessions.',
        'partners.process.step2.title': 'Advise',
        'partners.process.step2.description':
          'Design the optimal solution architecture based on your specific constraints and objectives.',
        'partners.process.step3.title': 'Develop',
        'partners.process.step3.description':
          'Build with Sovrium on your infrastructure. Clean code, tested, deployed on your terms.',
        'partners.process.step4.title': 'Adjust',
        'partners.process.step4.description':
          'Iterate based on real usage and feedback. We refine until it fits perfectly.',
        'partners.process.step5.title': 'Maintain',
        'partners.process.step5.description':
          'Ongoing support and evolution as your needs grow. We stay with you for the long run.',

        // ── Partners: Methodology (10 principles — exact LTF Engine wording)
        'partners.methodology.title': 'Our Methodology',
        'partners.methodology.subtitle': '10 principles that guide every project we deliver.',
        'partners.methodology.1.title':
          '\u2699\uFE0F We automate existing processes and exclusively develop internal tools',
        'partners.methodology.1.description':
          'We listen to your needs and analyze your current processes to identify repetitive tasks that can be automated.',
        'partners.methodology.2.title':
          '\uD83D\uDCAC We are available to answer your questions, needs, and technical support',
        'partners.methodology.2.description':
          'Our team is here to understand your specific needs and support you in your projects.',
        'partners.methodology.3.title':
          '\uD83E\uDD47 We use the best of both code and No Code worlds',
        'partners.methodology.3.description':
          'We combine the advantages of traditional coding technologies and No Code solutions to provide you with tailor-made tools.',
        'partners.methodology.4.title':
          '\uD83D\uDCBB We work remotely and asynchronously, using video conferencing when necessary',
        'partners.methodology.4.description':
          'Our remote work approach is based on clear and effective communication.',
        'partners.methodology.5.title':
          '\u23F1\uFE0F You pay for the time we spend on all your requests',
        'partners.methodology.5.description':
          'Our billing system is transparent and based on actual time spent on your projects.',
        'partners.methodology.6.title': '\u274C We don\u2019t do estimates',
        'partners.methodology.6.description':
          'We prefer a pragmatic approach based on action rather than approximate predictions.',
        'partners.methodology.7.title':
          '\uD83D\uDC8E We take the time to do quality work, focusing on what matters',
        'partners.methodology.7.description':
          'Our commitment to quality guides every aspect of our work.',
        'partners.methodology.8.title': '\uD83C\uDFE1 You own everything we develop for you',
        'partners.methodology.8.description':
          'All code, applications, and solutions developed as part of our services belong entirely to you.',
        'partners.methodology.9.title': '\uD83D\uDD4A\uFE0F You are not committed to anything',
        'partners.methodology.9.description':
          'Our flexible approach allows you to work with us according to your needs, without long-term contractual commitment.',
        'partners.methodology.10.title': '\u2764\uFE0F We take care of you',
        'partners.methodology.10.description':
          'Your satisfaction is our priority. We don\u2019t just deliver a project: we commit to supporting you at every step.',

        // ── Partners: Testimonials (exact LTF Engine quotes) ────────────────
        'partners.testimonials.title': 'What Our Clients Say',
        'partners.testimonials.1.quote':
          'Very satisfying work, it\u2019s a very positive and enriching experience. The La Tech Force team helped us quickly gain expertise.',
        'partners.testimonials.1.author': 'Marco PERONE',
        'partners.testimonials.1.role': 'Co-founder at CAPITAL PV',
        'partners.testimonials.2.quote':
          'Excellent support, great responsiveness and availability of the team, high quality deliverables, proactive suggestions.',
        'partners.testimonials.2.author': 'Simon SALLANDRE',
        'partners.testimonials.2.role': 'Operations Director at AGORASTORE',
        'partners.testimonials.3.quote':
          'Competent team & effective work. I learned a lot and developed a better understanding of automation logic.',
        'partners.testimonials.3.author': 'Mbemba DANSOKO',
        'partners.testimonials.3.role': 'Co-founder at ACTIVPRENEUR',
        'partners.testimonials.4.quote':
          'A great collaboration, we were able to make a giant leap and support across multiple business areas.',
        'partners.testimonials.4.author': 'Meryem BENMOUAZ',
        'partners.testimonials.4.role': 'Co-founder at LINTENDANCE',

        // ── Partners: Waitlist CTA ──────────────────────────────────────────
        'partners.waitlist.title': 'Supercharge Your Team',
        'partners.waitlist.description':
          'We work with a limited number of clients to ensure quality. Join our waitlist to be the first to know when a spot opens.',
        'partners.waitlist.cta': 'Join the Waitlist',

        // ── Partners: Footer ────────────────────────────────────────────────
        'partners.footer.privacy': 'Privacy Policy',
        'partners.footer.privacy.href': '/en/privacy-policy',
        'partners.footer.terms': 'Terms of Service',
        'partners.footer.terms.href': '/en/terms-of-service',
        'partners.footer.license': 'License',
        'partners.footer.trademark': 'Trademark',
        'partners.footer.sovrium.href': 'https://sovrium.com/en/',
        'partners.footer.copyright':
          '\u00A9 2025-2026 ESSENTIAL SERVICES. Sovrium is a trademark of ESSENTIAL SERVICES.',
      },
      fr: {
        // ════════════════════════════════════════════════════════════════════
        //  HOME PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Home: Meta ──────────────────────────────────────────────────────
        'home.meta.title': 'Sovrium \u2014 Ma\u00EEtrisez votre logiciel',
        'home.meta.description':
          'Construisez des applications m\u00E9tier compl\u00E8tes avec un simple fichier de configuration. Auto-h\u00E9berg\u00E9, open-source, sans d\u00E9pendance fournisseur.',
        'home.meta.og.title': 'Sovrium \u2014 Ma\u00EEtrisez votre logiciel',
        'home.meta.og.description':
          'Plateforme applicative pilot\u00E9e par la configuration. Auto-h\u00E9berg\u00E9e, sans d\u00E9pendance fournisseur.',
        'home.meta.twitter.title': 'Sovrium \u2014 Ma\u00EEtrisez votre logiciel',
        'home.meta.twitter.description':
          'Plateforme applicative pilot\u00E9e par la configuration. Auto-h\u00E9berg\u00E9e, sans d\u00E9pendance fournisseur.',

        // ── Home: Hero ──────────────────────────────────────────────────────
        'home.hero.title': 'Sovrium, l\u0027\u00E9l\u00E9ment de souverainet\u00E9',
        'home.hero.subtitle': 'Vos donn\u00E9es. Vos outils. Votre avenir.',
        'home.hero.description':
          'Lib\u00E9rez-vous de la d\u00E9pendance au SaaS gr\u00E2ce \u00E0 une plateforme auto-h\u00E9berg\u00E9e et pilot\u00E9e par la configuration, qui vous redonne le contr\u00F4le.',
        'home.hero.cta.primary': 'Commencer',
        'home.hero.cta.secondary': 'Voir sur GitHub',

        // ── Home: Problem Statement ─────────────────────────────────────────
        'home.problem.title': 'Le pi\u00E8ge du SaaS',
        'home.problem.stat1.value': '10 000 \u20AC+',
        'home.problem.stat1.label': 'D\u00E9pense SaaS annuelle moyenne par employ\u00E9',
        'home.problem.stat2.value': '0%',
        'home.problem.stat2.label':
          'Des donn\u00E9es que vous poss\u00E9dez r\u00E9ellement sur les plateformes SaaS',
        'home.problem.stat3.value': '73%',
        'home.problem.stat3.label':
          'Des entreprises pr\u00E9occup\u00E9es par la d\u00E9pendance fournisseur',
        'home.problem.hidden.title': 'Les co\u00FBts cach\u00E9s de la d\u00E9pendance au SaaS',
        'home.problem.hidden.cost1.title': 'D\u00E9pendance fournisseur \u2014 ',
        'home.problem.hidden.cost1.description':
          'Vos donn\u00E9es, workflows et habitudes d\u2019\u00E9quipe sont pris au pi\u00E8ge dans la plateforme d\u2019un autre.',
        'home.problem.hidden.cost2.title': 'Tarification par utilisateur \u2014 ',
        'home.problem.hidden.cost2.description':
          'Les co\u00FBts augmentent avec les effectifs, pas la valeur. Agrandir votre \u00E9quipe signifie augmenter votre facture SaaS.',
        'home.problem.hidden.cost3.title': 'Surcharge fonctionnelle \u2014 ',
        'home.problem.hidden.cost3.description':
          'Vous payez des milliers de fonctionnalit\u00E9s que vous n\u2019utilisez jamais, tandis que celles dont vous avez besoin sont derri\u00E8re des offres enterprise.',
        'home.problem.hidden.cost4.title': 'Souverainet\u00E9 des donn\u00E9es \u2014 ',
        'home.problem.hidden.cost4.description':
          'Vos donn\u00E9es m\u00E9tier sont sur des serveurs que vous ne contr\u00F4lez pas, dans des juridictions que vous n\u2019avez pas choisies.',
        'home.problem.hidden.cost5.title': 'Taxe d\u2019int\u00E9gration \u2014 ',
        'home.problem.hidden.cost5.description':
          'Connecter des outils SaaS n\u00E9cessite des middlewares, des APIs custom et une maintenance constante.',

        // ── Home: Solution Overview ─────────────────────────────────────────
        'home.solution.title': 'Une config. Une application compl\u00E8te.',
        'home.solution.description':
          'Sovrium transforme un simple fichier de configuration en une application m\u00E9tier compl\u00E8te \u2014 authentification, base de donn\u00E9es, API, pages et panneau d\u2019administration inclus.',
        'home.solution.code.alsoWorks': 'Fonctionne aussi avec des configs YAML et JSON :',
        'home.solution.howItWorks.title': 'Comment \u00E7a marche',
        'home.solution.howItWorks.step1.title': 'Configurer',
        'home.solution.howItWorks.step1.description':
          'D\u00E9finissez votre sch\u00E9ma d\u2019application en TypeScript, YAML ou JSON.',
        'home.solution.howItWorks.step2.title': 'D\u00E9ployer',
        'home.solution.howItWorks.step2.description':
          'Ex\u00E9cutez sur votre serveur, votre cloud, votre portable.',
        'home.solution.howItWorks.step3.title': 'Poss\u00E9der',
        'home.solution.howItWorks.step3.description':
          'Acc\u00E8s complet au code source, contr\u00F4le total des donn\u00E9es.',
        'home.solution.howItWorks.step4.title': '\u00C9voluer',
        'home.solution.howItWorks.step4.description':
          'Ajoutez des fonctionnalit\u00E9s en mettant \u00E0 jour votre config. Sans douleur de migration.',

        // ── Home: Core Principles ───────────────────────────────────────────
        'home.principles.title': 'Principes fondateurs',
        'home.principles.sovereignty.title': 'Souverainet\u00E9 num\u00E9rique',
        'home.principles.sovereignty.point1':
          '\u2705 Auto-h\u00E9berg\u00E9 sur votre infrastructure',
        'home.principles.sovereignty.point2':
          '\u2705 Propri\u00E9t\u00E9 et portabilit\u00E9 totale des donn\u00E9es',
        'home.principles.sovereignty.point3':
          '\u2705 Source disponible avec feuille de route open-source',
        'home.principles.sovereignty.point4':
          '\u2705 Pas de t\u00E9l\u00E9m\u00E9trie, pas de tracking, pas de collecte de donn\u00E9es',
        'home.principles.configuration.title': 'La configuration plut\u00F4t que le code',
        'home.principles.configuration.point1': '\u2705 Configuration en TypeScript, YAML ou JSON',
        'home.principles.configuration.point2':
          '\u2705 Typage s\u00FBr avec compl\u00E9tion IDE compl\u00E8te',
        'home.principles.configuration.point3': '\u2705 Pas de boilerplate, pas de scaffolding',
        'home.principles.configuration.point4':
          '\u2705 De la config \u00E0 l\u2019app en quelques secondes',
        'home.principles.dependencies.title': 'D\u00E9pendances minimales',
        'home.principles.dependencies.point1':
          '\u2705 Un seul binaire, une seule d\u00E9pendance : Bun',
        'home.principles.dependencies.point2':
          '\u2705 Pas de Docker requis pour le d\u00E9veloppement',
        'home.principles.dependencies.point3':
          '\u2705 PostgreSQL pour les donn\u00E9es de production',
        'home.principles.dependencies.point4':
          '\u2705 Pas de SDKs fournisseur, pas de d\u00E9pendance cloud',
        'home.principles.business.title': 'Orient\u00E9 m\u00E9tier',
        'home.principles.business.point1': '\u2705 Con\u00E7u pour les vrais workflows m\u00E9tier',
        'home.principles.business.point2':
          '\u2705 Authentification, r\u00F4les et permissions inclus',
        'home.principles.business.point3': '\u2705 API-first : chaque table obtient une API REST',
        'home.principles.business.point4':
          '\u2705 Multi-langue et th\u00E8mes pr\u00EAts \u00E0 l\u2019emploi',

        // ── Home: Comparison ────────────────────────────────────────────────
        'home.comparison.title': 'Pourquoi ne pas simplement utiliser du SaaS ?',
        'home.comparison.stat1': '90% moins cher que les outils SaaS \u00E9quivalents',
        'home.comparison.stat2': '100% de propri\u00E9t\u00E9 des donn\u00E9es, pour toujours',
        'home.comparison.table.title': 'Sovrium vs SaaS traditionnel',
        'home.comparison.table.header.aspect': 'Aspect',
        'home.comparison.table.row1.aspect': 'Propri\u00E9t\u00E9 des donn\u00E9es',
        'home.comparison.table.row1.sovrium': '\u2705 100% les v\u00F4tres',
        'home.comparison.table.row1.saas': '\u274C Propri\u00E9t\u00E9 du fournisseur',
        'home.comparison.table.row2.aspect': 'Code source',
        'home.comparison.table.row2.sovrium': '\u2705 Acc\u00E8s complet',
        'home.comparison.table.row2.saas': '\u274C Code ferm\u00E9',
        'home.comparison.table.row3.aspect': 'Co\u00FBt mensuel',
        'home.comparison.table.row3.sovrium': '\u2705 Co\u00FBts serveur uniquement',
        'home.comparison.table.row3.saas': '\u274C 50\u2013500+ \u20AC/utilisateur/mois',
        'home.comparison.table.row4.aspect': 'D\u00E9pendance fournisseur',
        'home.comparison.table.row4.sovrium': '\u2705 Z\u00E9ro',
        'home.comparison.table.row4.saas': '\u274C \u00C9lev\u00E9e',
        'home.comparison.table.row5.aspect': 'Personnalisation',
        'home.comparison.table.row5.sovrium': '\u2705 Illimit\u00E9e',
        'home.comparison.table.row5.saas': '\u26A0\uFE0F Limit\u00E9e',
        'home.comparison.table.row6.aspect': 'Contr\u00F4le de version',
        'home.comparison.table.row6.sovrium': '\u2705 Natif Git',
        'home.comparison.table.row6.saas': '\u26A0\uFE0F Limit\u00E9/Aucun',
        'home.comparison.table.row7.aspect': 'Confidentialit\u00E9',
        'home.comparison.table.row7.sovrium': '\u2705 Vos serveurs',
        'home.comparison.table.row7.saas': '\u274C Tiers',

        // ── Home: Use Cases ─────────────────────────────────────────────────
        'home.useCases.title': 'Con\u00E7u pour le travail r\u00E9el',
        'home.useCases.internal.title': 'Outils internes',
        'home.useCases.internal.description':
          'CRM, gestion de projets, suivi d\u2019inventaire \u2014 con\u00E7us sp\u00E9cifiquement pour le fonctionnement de votre \u00E9quipe.',
        'home.useCases.portals.title': 'Portails clients',
        'home.useCases.portals.description':
          'Tableaux de bord s\u00E9curis\u00E9s pour que vos clients consultent des rapports, soumettent des demandes et suivent leur progression.',
        'home.useCases.business.title': 'Applications m\u00E9tier',
        'home.useCases.business.description':
          'Applications personnalis\u00E9es pour des workflows que le SaaS standard ne peut pas g\u00E9rer.',
        'home.useCases.api.title': 'Backends API',
        'home.useCases.api.description':
          'APIs REST avec authentification, validation et base de donn\u00E9es \u2014 z\u00E9ro boilerplate.',
        'home.useCases.static.title': 'Sites statiques',
        'home.useCases.static.description':
          'Pages marketing, sites de documentation et landing pages avec support i18n.',
        'home.useCases.mvp.title': 'MVPs & Prototypes',
        'home.useCases.mvp.description':
          'De l\u2019id\u00E9e au produit fonctionnel en heures, pas en semaines. It\u00E9rez par changements de config.',

        // ── Home: Platform Features ─────────────────────────────────────────
        'home.features.title': 'Tout ce dont vous avez besoin',
        'home.features.subtitle':
          'Une plateforme compl\u00E8te, pas un \u00E9ni\u00E8me framework \u00E0 apprendre.',
        'home.features.auth.title': '\uD83D\uDD10 Authentification',
        'home.features.auth.point1': '\u2022 Email/mot de passe & OAuth social',
        'home.features.auth.point2': '\u2022 Acc\u00E8s par r\u00F4le (admin, membre, lecteur)',
        'home.features.auth.point3': '\u2022 Gestion des sessions',
        'home.features.auth.point4': '\u2022 Authentification \u00E0 deux facteurs',
        'home.features.auth.point5': '\u2022 Support des passkeys',
        'home.features.auth.point6': '\u2022 Champs utilisateur personnalis\u00E9s',
        'home.features.tables.title': '\uD83D\uDDC2\uFE0F Tables & Donn\u00E9es',
        'home.features.tables.point1': '\u2022 15+ types de champs (texte, email, nombre, \u2026)',
        'home.features.tables.point2': '\u2022 API CRUD automatique',
        'home.features.tables.point3': '\u2022 Relations et lookups',
        'home.features.tables.point4': '\u2022 Tri, filtrage, pagination',
        'home.features.tables.point5': '\u2022 Champs formule',
        'home.features.tables.point6': '\u2022 Import/export',
        'home.features.api.title': '\uD83D\uDD0C API Records',
        'home.features.api.point1': '\u2022 Endpoints REST auto-g\u00E9n\u00E9r\u00E9s',
        'home.features.api.point2': '\u2022 Documentation OpenAPI',
        'home.features.api.point3': '\u2022 SDK client typ\u00E9',
        'home.features.api.point4': '\u2022 Filtrage et tri',
        'home.features.api.point5': '\u2022 Op\u00E9rations en masse',
        'home.features.api.point6': '\u2022 Support des webhooks',
        'home.features.pages.title': '\uD83D\uDCBB Pages & UI',
        'home.features.pages.point1': '\u2022 Pages React rendues c\u00F4t\u00E9 serveur',
        'home.features.pages.point2': '\u2022 Biblioth\u00E8que de composants incluse',
        'home.features.pages.point3': '\u2022 Responsive par d\u00E9faut',
        'home.features.pages.point4': '\u2022 Layouts personnalis\u00E9s',
        'home.features.pages.point5': '\u2022 Constructeur de formulaires',
        'home.features.pages.point6': '\u2022 Syst\u00E8me de navigation',
        'home.features.theming.title': '\uD83C\uDFA8 Th\u00E8mes & i18n',
        'home.features.theming.point1': '\u2022 Sch\u00E9mas de couleurs personnalis\u00E9s',
        'home.features.theming.point2': '\u2022 Syst\u00E8me typographique',
        'home.features.theming.point3': '\u2022 Support du mode sombre',
        'home.features.theming.point4': '\u2022 Multi-langue (i18n)',
        'home.features.theming.point5': '\u2022 Th\u00E9matisation par variables CSS',
        'home.features.theming.point6': '\u2022 Design coh\u00E9rent avec votre marque',
        'home.features.admin.title': '\u2699\uFE0F Admin & Op\u00E9rations',
        'home.features.admin.point1': '\u2022 Tableau de bord admin',
        'home.features.admin.point2': '\u2022 Gestion des utilisateurs',
        'home.features.admin.point3': '\u2022 Journaux d\u2019activit\u00E9',
        'home.features.admin.point4': '\u2022 Studio base de donn\u00E9es',
        'home.features.admin.point5': '\u2022 Outils CLI',
        'home.features.admin.point6': '\u2022 Monitoring de sant\u00E9',

        // ── Home: Tech Stack ────────────────────────────────────────────────
        'home.techStack.title': 'Stack moderne. Sans compromis.',
        'home.techStack.subtitle':
          'Construit sur des technologies \u00E9prouv\u00E9es choisies pour la performance, la fiabilit\u00E9 et l\u2019exp\u00E9rience d\u00E9veloppeur.',

        // ── Home: Getting Started ───────────────────────────────────────────
        'home.gettingStarted.title': 'D\u00E9marrez en quelques minutes',
        'home.gettingStarted.step1.title': 'Installer',
        'home.gettingStarted.step2.title': 'Configurer',
        'home.gettingStarted.step2.description':
          'D\u00E9finissez votre sch\u00E9ma d\u2019app dans un fichier de config',
        'home.gettingStarted.step3.title': 'Lancer',
        'home.gettingStarted.step4.title': 'Personnaliser',
        'home.gettingStarted.step4.description':
          'Ajoutez des tables, pages, auth \u2014 le tout par configuration',
        'home.gettingStarted.status.title': 'Acc\u00E8s anticipé',
        'home.gettingStarted.status.description':
          'Sovrium est en d\u00E9veloppement actif. Mettez une \u00E9toile au repo et suivez la construction de l\u2019avenir des applications auto-h\u00E9berg\u00E9es.',
        'home.gettingStarted.status.cta': '\u00C9toiler sur GitHub',

        // ── Home: Footer ────────────────────────────────────────────────────
        'home.footer.cta.title': 'Pr\u00EAt \u00E0 ma\u00EEtriser votre logiciel ?',
        'home.footer.cta.docs': 'Lire la doc',
        'home.footer.cta.github': 'Voir sur GitHub',
        'home.footer.privacy': 'Politique de confidentialit\u00E9',
        'home.footer.privacy.href': '/fr/privacy-policy',
        'home.footer.terms': 'Conditions d\u2019utilisation',
        'home.footer.terms.href': '/fr/terms-of-service',
        'home.footer.license': 'Licence',
        'home.footer.trademark': 'Marque d\u00E9pos\u00E9e',
        'home.footer.partners': 'Partenaires',
        'home.footer.partners.href': '/fr/partners',
        'home.footer.copyright':
          '\u00A9 2025-2026 ESSENTIAL SERVICES. Sovrium est une marque d\u2019ESSENTIAL SERVICES.',

        // ════════════════════════════════════════════════════════════════════
        //  PARTNERS PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Partners: Meta ──────────────────────────────────────────────────
        'partners.meta.title': 'Sovrium Partners - Solutions logicielles sur mesure',
        'partners.meta.description':
          'ESSENTIAL SERVICES con\u00E7oit des solutions logicielles sur mesure avec Sovrium. 50+ clients, 200+ outils cr\u00E9\u00E9s, 10 000+ heures \u00E9conomis\u00E9es.',
        'partners.meta.og.title': 'Sovrium Partners - Solutions logicielles sur mesure',
        'partners.meta.og.description':
          'Des solutions sur mesure pour vos d\u00E9fis logiciels. Construites sur Sovrium, d\u00E9ploy\u00E9es sur votre infrastructure.',
        'partners.meta.twitter.title': 'Sovrium Partners - Solutions logicielles sur mesure',
        'partners.meta.twitter.description':
          'Des solutions sur mesure pour vos d\u00E9fis logiciels. Construites avec Sovrium.',

        // ── Partners: Hero ──────────────────────────────────────────────────
        'partners.hero.title': 'Des solutions sur mesure pour vos d\u00E9fis logiciels',
        'partners.hero.subtitle':
          'Nous concevons, construisons et maintenons des outils internes sur mesure sur votre infrastructure. Aucun vendor lock-in, aucune facture surprise \u2014 juste du logiciel qui fonctionne pour votre \u00E9quipe.',
        'partners.hero.cta.primary': 'Rejoindre la liste d\u2019attente',
        'partners.hero.cta.secondary': 'Notre m\u00E9thodologie',

        // ── Partners: Trusted By ────────────────────────────────────────────
        'partners.trust.title': 'Ils nous font confiance',

        // ── Partners: Stats ─────────────────────────────────────────────────
        'partners.stats.title': 'Un parcours \u00E9prouv\u00E9',
        'partners.stats.clients.stat': '50+',
        'partners.stats.clients.title': 'Clients accompagn\u00E9s',
        'partners.stats.clients.description':
          'Startups, PME et grands groupes nous font confiance pour optimiser leurs op\u00E9rations avec des outils sur mesure.',
        'partners.stats.tools.stat': '200+',
        'partners.stats.tools.title': 'Outils construits',
        'partners.stats.tools.description':
          'Des tableaux de bord internes aux applications m\u00E9tier compl\u00E8tes, adapt\u00E9s aux workflows de chaque client.',
        'partners.stats.hours.stat': '10 000+',
        'partners.stats.hours.title': 'Heures \u00E9conomis\u00E9es',
        'partners.stats.hours.description':
          'En automatisant les t\u00E2ches r\u00E9p\u00E9titives et en consolidant les outils \u00E9parpill\u00E9s en plateformes coh\u00E9rentes.',

        // ── Partners: Process (5 steps) ─────────────────────────────────────
        'partners.process.title': 'Notre processus',
        'partners.process.subtitle':
          'Une approche en 5 \u00E9tapes \u00E9prouv\u00E9e pour livrer un logiciel parfaitement adapt\u00E9 \u00E0 vos besoins.',
        'partners.process.step1.title': '\u00C9couter',
        'partners.process.step1.description':
          'Comprendre vos workflows, points de friction et objectifs lors de sessions de d\u00E9couverte approfondies.',
        'partners.process.step2.title': 'Conseiller',
        'partners.process.step2.description':
          'Concevoir l\u2019architecture de solution optimale en fonction de vos contraintes et objectifs sp\u00E9cifiques.',
        'partners.process.step3.title': 'D\u00E9velopper',
        'partners.process.step3.description':
          'Construire avec Sovrium sur votre infrastructure. Code propre, test\u00E9, d\u00E9ploy\u00E9 selon vos conditions.',
        'partners.process.step4.title': 'Ajuster',
        'partners.process.step4.description':
          'It\u00E9rer en fonction de l\u2019usage r\u00E9el et des retours. Nous affinons jusqu\u2019\u00E0 ce que ce soit parfait.',
        'partners.process.step5.title': 'Maintenir',
        'partners.process.step5.description':
          'Support continu et \u00E9volution au fil de vos besoins. Nous restons \u00E0 vos c\u00F4t\u00E9s sur le long terme.',

        // ── Partners: Methodology (10 principles — exact LTF Engine wording)
        'partners.methodology.title': 'Notre m\u00E9thodologie',
        'partners.methodology.subtitle': '10 principes qui guident chaque projet que nous livrons.',
        'partners.methodology.1.title':
          '\u2699\uFE0F Nous automatisons les processus existants et d\u00E9veloppons exclusivement des outils internes',
        'partners.methodology.1.description':
          'Nous \u00E9coutons vos besoins et analysons vos processus actuels pour identifier les t\u00E2ches r\u00E9p\u00E9titives pouvant \u00EAtre automatis\u00E9es.',
        'partners.methodology.2.title':
          '\uD83D\uDCAC Nous sommes disponibles pour r\u00E9pondre \u00E0 vos questions, besoins et support technique',
        'partners.methodology.2.description':
          'Notre \u00E9quipe est l\u00E0 pour comprendre vos besoins sp\u00E9cifiques et vous accompagner dans vos projets.',
        'partners.methodology.3.title':
          '\uD83E\uDD47 Nous utilisons le meilleur des mondes Code et No Code',
        'partners.methodology.3.description':
          'Nous combinons les avantages des technologies de codage traditionnelles et des solutions No Code pour vous fournir des outils sur mesure.',
        'partners.methodology.4.title':
          '\uD83D\uDCBB Nous travaillons \u00E0 distance et de mani\u00E8re asynchrone, en utilisant la visioconf\u00E9rence lorsque n\u00E9cessaire',
        'partners.methodology.4.description':
          'Notre approche du travail \u00E0 distance repose sur une communication claire et efficace.',
        'partners.methodology.5.title':
          '\u23F1\uFE0F Vous payez le temps que nous consacrons \u00E0 toutes vos demandes',
        'partners.methodology.5.description':
          'Notre syst\u00E8me de facturation est transparent et bas\u00E9 sur le temps r\u00E9ellement pass\u00E9 sur vos projets.',
        'partners.methodology.6.title': '\u274C Nous ne faisons pas de devis',
        'partners.methodology.6.description':
          'Nous pr\u00E9f\u00E9rons une approche pragmatique bas\u00E9e sur l\u2019action plut\u00F4t que sur des pr\u00E9dictions approximatives.',
        'partners.methodology.7.title':
          '\uD83D\uDC8E Nous prenons le temps de faire un travail de qualit\u00E9, en nous concentrant sur ce qui compte',
        'partners.methodology.7.description':
          'Notre engagement envers la qualit\u00E9 guide chaque aspect de notre travail.',
        'partners.methodology.8.title':
          '\uD83C\uDFE1 Vous \u00EAtes propri\u00E9taire de tout ce que nous d\u00E9veloppons pour vous',
        'partners.methodology.8.description':
          'Tout le code, les applications et les solutions d\u00E9velopp\u00E9s dans le cadre de nos services vous appartiennent enti\u00E8rement.',
        'partners.methodology.9.title':
          '\uD83D\uDD4A\uFE0F Vous n\u2019\u00EAtes engag\u00E9 \u00E0 rien',
        'partners.methodology.9.description':
          'Notre approche flexible vous permet de travailler avec nous selon vos besoins, sans engagement contractuel \u00E0 long terme.',
        'partners.methodology.10.title': '\u2764\uFE0F Nous prenons soin de vous',
        'partners.methodology.10.description':
          'Votre satisfaction est notre priorit\u00E9. Nous ne livrons pas seulement un projet : nous nous engageons \u00E0 vous accompagner \u00E0 chaque \u00E9tape.',

        // ── Partners: Testimonials (exact LTF Engine quotes) ────────────────
        'partners.testimonials.title': 'Ce que disent nos clients',
        'partners.testimonials.1.quote':
          'Un travail tr\u00E8s satisfaisant, c\u2019est une exp\u00E9rience tr\u00E8s positive et enrichissante. L\u2019\u00E9quipe La Tech Force nous a aid\u00E9s \u00E0 monter rapidement en comp\u00E9tence.',
        'partners.testimonials.1.author': 'Marco PERONE',
        'partners.testimonials.1.role': 'Co-fondateur chez CAPITAL PV',
        'partners.testimonials.2.quote':
          'Un accompagnement excellent, une grande r\u00E9activit\u00E9 et disponibilit\u00E9 de l\u2019\u00E9quipe, des livrables de grande qualit\u00E9, des suggestions proactives.',
        'partners.testimonials.2.author': 'Simon SALLANDRE',
        'partners.testimonials.2.role': 'Directeur des op\u00E9rations chez AGORASTORE',
        'partners.testimonials.3.quote':
          '\u00C9quipe comp\u00E9tente & travail efficace. J\u2019ai beaucoup appris et d\u00E9velopp\u00E9 une meilleure compr\u00E9hension de la logique d\u2019automatisation.',
        'partners.testimonials.3.author': 'Mbemba DANSOKO',
        'partners.testimonials.3.role': 'Co-fondateur chez ACTIVPRENEUR',
        'partners.testimonials.4.quote':
          'Une tr\u00E8s belle collaboration, nous avons pu faire un bond de g\u00E9ant et un accompagnement sur plusieurs domaines m\u00E9tiers.',
        'partners.testimonials.4.author': 'Meryem BENMOUAZ',
        'partners.testimonials.4.role': 'Co-fondatrice chez LINTENDANCE',

        // ── Partners: Waitlist CTA ──────────────────────────────────────────
        'partners.waitlist.title': 'Boostez votre \u00E9quipe',
        'partners.waitlist.description':
          'Nous travaillons avec un nombre limit\u00E9 de clients pour garantir la qualit\u00E9. Rejoignez notre liste d\u2019attente pour \u00EAtre inform\u00E9 d\u00E8s qu\u2019une place se lib\u00E8re.',
        'partners.waitlist.cta': 'Rejoindre la liste d\u2019attente',

        // ── Partners: Footer ────────────────────────────────────────────────
        'partners.footer.privacy': 'Politique de confidentialit\u00E9',
        'partners.footer.privacy.href': '/fr/privacy-policy',
        'partners.footer.terms': 'Conditions d\u2019utilisation',
        'partners.footer.terms.href': '/fr/terms-of-service',
        'partners.footer.license': 'Licence',
        'partners.footer.trademark': 'Marque d\u00E9pos\u00E9e',
        'partners.footer.sovrium.href': 'https://sovrium.com/fr/',
        'partners.footer.copyright':
          '\u00A9 2025-2026 ESSENTIAL SERVICES. Sovrium est une marque d\u2019ESSENTIAL SERVICES.',
      },
    },
  },
  blocks: [],
  pages: [home, termsOfService, privacyPolicy, partners],
}
