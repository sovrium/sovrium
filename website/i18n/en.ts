/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const en: Record<string, string> = {
  // ════════════════════════════════════════════════════════════════════
  //  GLOBAL BADGE
  // ════════════════════════════════════════════════════════════════════
  'badge.text': 'Built with Sovrium',

  // ════════════════════════════════════════════════════════════════════
  //  GLOBAL NAVIGATION
  // ════════════════════════════════════════════════════════════════════
  'nav.partner': 'Services',
  'nav.partner.href': '/en/partner',
  'nav.about': 'About',
  'nav.about.href': '/en/about',
  'nav.cta': 'Get Started',
  'nav.cta.href': '/en/docs',
  'nav.lang.label': 'FR',
  'nav.lang.code': 'fr',

  // ════════════════════════════════════════════════════════════════════
  //  GLOBAL FOOTER
  // ════════════════════════════════════════════════════════════════════
  'footer.description':
    'A self-hosted, configuration-driven platform that puts you back in control of your software.',
  'footer.col.product': 'Product',
  'footer.col.product.docs': 'Documentation',
  'footer.col.product.docs.href': '/en/docs',
  'footer.col.product.github': 'GitHub',
  'footer.col.product.license': 'License',
  'footer.col.company': 'Company',
  'footer.col.company.about': 'About',
  'footer.col.company.about.href': '/en/about',
  'footer.col.company.partners': 'Services',
  'footer.col.company.partners.href': '/en/partner',
  'footer.col.company.trademark': 'Trademark',
  'footer.col.legal': 'Legal',
  'footer.col.legal.privacy': 'Privacy Policy',
  'footer.col.legal.privacy.href': '/en/privacy-policy',
  'footer.col.legal.terms': 'Terms of Service',
  'footer.col.legal.terms.href': '/en/terms-of-service',
  'footer.col.legal.dataDeletion': 'Data Deletion',
  'footer.col.legal.dataDeletion.href': '/en/data-deletion',
  'footer.social.github': 'GitHub',
  'footer.social.github.href': 'https://github.com/sovrium/sovrium',
  'footer.social.twitter': 'Twitter',
  'footer.social.twitter.href': 'https://x.com/sovrium',
  'footer.copyright':
    '\u00A9 2025-2026 ESSENTIAL SERVICES. Sovrium\u00AE is a registered trademark of ESSENTIAL SERVICES.',

  // ════════════════════════════════════════════════════════════════════
  //  HOME PAGE
  // ════════════════════════════════════════════════════════════════════

  // ── Home: Meta ──────────────────────────────────────────────────────
  'home.meta.title': 'Sovrium \u2014 Build Apps with Configuration, Not Code',
  'home.meta.description':
    'Build complete business applications with a single configuration file. The open-source, self-hosted SaaS alternative \u2014 no vendor lock-in.',
  'home.meta.og.title': 'Sovrium \u2014 Build Apps with Configuration, Not Code',
  'home.meta.og.description':
    'Open-source, configuration-driven application platform. The self-hosted SaaS alternative with no vendor lock-in.',
  'home.meta.twitter.title': 'Sovrium \u2014 Build Apps with Configuration, Not Code',
  'home.meta.twitter.description':
    'Open-source, configuration-driven application platform. The self-hosted SaaS alternative with no vendor lock-in.',

  // ── Home: Hero ──────────────────────────────────────────────────────
  'home.hero.title': 'Build complete apps with a single config file',
  'home.hero.subtitle': 'Open-source. Self-hosted. Configuration-driven.',
  'home.hero.description':
    'Define your tables, auth, pages, and theme in one file. Sovrium turns it into a full-stack application you own and control.',
  'home.hero.cta.primary': 'Get Started',
  'home.hero.cta.secondary': 'View on GitHub',

  // ── Home: Problem Statement ─────────────────────────────────────────
  'home.problem.title': 'The SaaS Trap',
  'home.problem.stat1.value': '$10K+',
  'home.problem.stat1.label': 'Average annual SaaS spend per employee',
  'home.problem.stat1.source': 'Source: Productiv SaaS Trends 2024',
  'home.problem.stat2.value': '0%',
  'home.problem.stat2.label': 'Data portability guarantee on most SaaS platforms',
  'home.problem.stat3.value': '73%',
  'home.problem.stat3.label': 'Companies worried about vendor lock-in',
  'home.problem.stat3.source': 'Source: Flexera 2024 State of ITAM Report',
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
  'home.solution.howItWorks.step2.description': 'Run on your server, your cloud, your laptop.',
  'home.solution.howItWorks.step3.title': 'Own',
  'home.solution.howItWorks.step3.description': 'Full source code access, full data control.',
  'home.solution.howItWorks.step4.title': 'Evolve',
  'home.solution.howItWorks.step4.description':
    'Add features by updating your config. No migration pain.',

  // ── Home: Comparison ────────────────────────────────────────────────
  'home.comparison.title': 'Why Not Just Use SaaS?',
  'home.comparison.stat1': 'Significant cost savings vs equivalent SaaS tools',
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
  'home.comparison.table.row8.aspect': 'Managed Hosting',
  'home.comparison.table.row8.sovrium': '\u26A0\uFE0F You manage infrastructure',
  'home.comparison.table.row8.saas': '\u2705 Fully managed for you',

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
  'home.features.auth.point3': '\u2022 Two-factor authentication',
  'home.features.auth.point4': '\u2022 Session management & passkeys',
  'home.features.tables.title': '\uD83D\uDDC2\uFE0F Tables & Data',
  'home.features.tables.point1': '\u2022 41 field types (text, email, integer, \u2026)',
  'home.features.tables.point2': '\u2022 Automatic CRUD API',
  'home.features.tables.point3': '\u2022 Relations, lookups & formula fields',
  'home.features.tables.point4': '\u2022 Sorting, filtering, pagination',
  'home.features.api.title': '\uD83D\uDD0C Records API',
  'home.features.api.point1': '\u2022 Auto-generated REST endpoints',
  'home.features.api.point2': '\u2022 OpenAPI documentation',
  'home.features.api.point3': '\u2022 Type-safe client SDK',
  'home.features.api.point4': '\u2022 Filtering, sorting & bulk operations',
  'home.features.pages.title': '\uD83D\uDCBB Pages & UI',
  'home.features.pages.point1': '\u2022 Server-rendered React pages',
  'home.features.pages.point2': '\u2022 62 component types included',
  'home.features.pages.point3': '\u2022 Responsive by default',
  'home.features.pages.point4': '\u2022 Custom layouts & navigation',
  'home.features.theming.title': '\uD83C\uDFA8 Theming & i18n',
  'home.features.theming.point1': '\u2022 Custom color schemes & typography',
  'home.features.theming.point2': '\u2022 Dark mode support',
  'home.features.theming.point3': '\u2022 Multi-language (i18n)',
  'home.features.theming.point4': '\u2022 CSS variable theming',

  // ── Home: Tech Stack ────────────────────────────────────────────────
  'home.techStack.title': 'Modern Stack. No Compromises.',
  'home.techStack.subtitle':
    'Written in TypeScript, built on battle-tested technologies chosen for performance, reliability, and developer experience.',

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
  'home.gettingStarted.status.cta': 'Read the Quickstart',
  'home.gettingStarted.status.cta.href': '/en/docs',
  'home.gettingStarted.status.cta.secondary': 'Star on GitHub',

  // ════════════════════════════════════════════════════════════════════
  //  PARTNER PAGE
  // ════════════════════════════════════════════════════════════════════

  // ── Partners: Meta ──────────────────────────────────────────────────
  'partner.meta.title': 'Sovrium Partners - Custom Software Solutions',
  'partner.meta.description':
    'ESSENTIAL SERVICES builds tailor-made software solutions with Sovrium. 50+ clients served, 200+ tools built, 10,000+ hours saved.',
  'partner.meta.og.title': 'Sovrium Partners - Custom Software Solutions',
  'partner.meta.og.description':
    'Tailor-made solutions to your software challenges. Built on Sovrium, deployed on your infrastructure.',
  'partner.meta.twitter.title': 'Sovrium Partners - Custom Software Solutions',
  'partner.meta.twitter.description':
    'Tailor-made solutions to your software challenges. Built with Sovrium.',

  // ── Partners: Hero ──────────────────────────────────────────────────
  'partner.hero.title': 'Tailor-made solutions to your software challenges',
  'partner.hero.subtitle':
    'We design, build, and maintain custom internal tools, AI-powered solutions, and automated workflows on your infrastructure. No vendor lock-in, no surprise bills \u2014 just software that works for your team.',
  'partner.hero.cta.primary': 'Get in Touch',
  'partner.hero.cta.secondary': 'Our Methodology',

  // ── Partners: Trusted By ────────────────────────────────────────────
  'partner.trust.title': 'Trusted By',

  // ── Partners: Stats ─────────────────────────────────────────────────
  'partner.stats.title': 'Proven Track Record',
  'partner.stats.clients.stat': '50+',
  'partner.stats.clients.title': 'Clients Served',
  'partner.stats.clients.description':
    'Startups, SMEs, and enterprises trust us to streamline their operations with custom-built tools.',
  'partner.stats.tools.stat': '200+',
  'partner.stats.tools.title': 'Tools Built',
  'partner.stats.tools.description':
    'From internal dashboards to full business applications, tailored to each client\u2019s unique workflows.',
  'partner.stats.hours.stat': '10,000+',
  'partner.stats.hours.title': 'Hours Saved',
  'partner.stats.hours.description':
    'Automating repetitive tasks and consolidating scattered tools into cohesive platforms.',

  // ── Partners: Process (5 steps) ─────────────────────────────────────
  'partner.process.title': 'Our Process',
  'partner.process.subtitle':
    'A proven 5-step approach to deliver software that fits your needs perfectly.',
  'partner.process.step1.title': 'Listen',
  'partner.process.step1.description':
    'Understand your workflows, pain points, and goals through in-depth discovery sessions.',
  'partner.process.step2.title': 'Advise',
  'partner.process.step2.description':
    'Design the optimal solution architecture based on your specific constraints and objectives.',
  'partner.process.step3.title': 'Develop',
  'partner.process.step3.description':
    'Build with Sovrium on your infrastructure. Clean code, tested, deployed on your terms.',
  'partner.process.step4.title': 'Adjust',
  'partner.process.step4.description':
    'Iterate based on real usage and feedback. We refine until it fits perfectly.',
  'partner.process.step5.title': 'Maintain',
  'partner.process.step5.description':
    'Ongoing support and evolution as your needs grow. We stay with you for the long run.',

  // ── Partners: Methodology (13 principles) ──────────────────────────
  'partner.methodology.title': 'Our Methodology',
  'partner.methodology.subtitle': '5 principles that guide every project we deliver.',
  'partner.methodology.1.title':
    '\u2699\uFE0F We automate processes, build internal tools, and leverage AI to amplify your team',
  'partner.methodology.1.description':
    'We analyze your workflows to identify repetitive tasks, design end-to-end automations, and integrate AI where it accelerates delivery.',
  'partner.methodology.2.title':
    '\uD83D\uDCAC We are available to answer your questions, needs, and technical support',
  'partner.methodology.2.description':
    'Our team is here to understand your specific needs and support you in your projects.',
  'partner.methodology.3.title': '\uD83E\uDD47 We use the best of Code, No Code, and AI',
  'partner.methodology.3.description':
    'We combine traditional code, No Code platforms, and AI-powered tools to deliver the right solution for each use case.',
  'partner.methodology.4.title':
    '\uD83D\uDCBB We work remotely and asynchronously, using video conferencing when necessary',
  'partner.methodology.4.description':
    'Our remote work approach is based on clear and effective communication.',
  'partner.methodology.5.title': '\u23F1\uFE0F You pay for the time we spend on all your requests',
  'partner.methodology.5.description':
    'Our billing system is transparent and based on actual time spent on your projects.',

  // ── Partners: Testimonials (exact LTF Engine quotes) ────────────────
  'partner.testimonials.title': 'What Our Clients Say',
  'partner.testimonials.disclaimer': 'What our consulting clients say',
  'partner.testimonials.1.quote':
    'Very satisfying work, it\u2019s a very positive and enriching experience. The team helped us quickly gain expertise.',
  'partner.testimonials.1.author': 'Marco PERONE',
  'partner.testimonials.1.role': 'Co-founder at CAPITAL PV',
  'partner.testimonials.2.quote':
    'Excellent support, great responsiveness and availability of the team, high quality deliverables, proactive suggestions.',
  'partner.testimonials.2.author': 'Simon SALLANDRE',
  'partner.testimonials.2.role': 'Operations Director at AGORASTORE',
  'partner.testimonials.3.quote':
    'Competent team & effective work. I learned a lot and developed a better understanding of automation logic.',
  'partner.testimonials.3.author': 'Mbemba DANSOKO',
  'partner.testimonials.3.role': 'Co-founder at ACTIVPRENEUR',
  'partner.testimonials.4.quote':
    'A great collaboration, we were able to make a giant leap and support across multiple business areas.',
  'partner.testimonials.4.author': 'Meryem BENMOUAZ',
  'partner.testimonials.4.role': 'Co-founder at LINTENDANCE',

  // ── Partners: Waitlist CTA ──────────────────────────────────────────
  'partner.waitlist.title': 'Supercharge Your Team',
  'partner.waitlist.description':
    'We work with a limited number of clients to ensure quality. Join our waitlist to be the first to know when a spot opens.',
  'partner.waitlist.cta': 'Contact Us',
  'partner.waitlist.email': 'hello@sovrium.com',
  'partner.waitlist.email.href': 'mailto:hello@sovrium.com',
  'partner.waitlist.email.label': 'Or email us directly:',

  // ════════════════════════════════════════════════════════════════════
  //  ABOUT PAGE
  // ════════════════════════════════════════════════════════════════════

  // ── Company: Meta ──────────────────────────────────────────────────
  'about.meta.title': 'Sovrium \u2014 Company',
  'about.meta.description':
    'Learn about the vision, values, and team behind Sovrium. Building digital sovereignty for every organization.',
  'about.meta.og.title': 'Sovrium \u2014 Company',
  'about.meta.og.description':
    'The vision, values, and team behind Sovrium. Digital sovereignty for every organization.',
  'about.meta.twitter.title': 'Sovrium \u2014 Company',
  'about.meta.twitter.description':
    'The vision, values, and team behind Sovrium. Digital sovereignty for every organization.',

  // ── Company: Hero ──────────────────────────────────────────────────
  'about.hero.eyebrow': 'ESSENTIAL SERVICES',
  'about.hero.title': 'Building digital sovereignty',
  'about.hero.subtitle':
    'We believe every organization deserves to own its software, its data, and its future. Sovrium is the platform that makes it possible.',
  'about.hero.tagline': '\u201COwn your data. Own your tools. Own your future.\u201D',

  // ── Company: Mission ───────────────────────────────────────────────
  'about.mission.title': 'Our Mission',
  'about.mission.description':
    'Modern organizations are drowning in SaaS dependencies \u2014 paying monthly fees, losing data control, and adapting their business to vendor limitations. We are building the alternative.',
  'about.mission.statement':
    'To make every organization sovereign in their information systems \u2014 free from SaaS lock-in, in complete control of their data, and empowered to build business applications through configuration-as-code.',

  // ── Company: Values ────────────────────────────────────────────────
  'about.values.title': 'Our Values',
  'about.values.subtitle':
    'The principles that guide every decision we make, from code architecture to community engagement.',
  'about.values.sovereignty.icon': '\uD83D\uDEE1\uFE0F',
  'about.values.sovereignty.title': 'Digital Sovereignty',
  'about.values.sovereignty.description':
    'Organizations should own their information systems, not rent them. Your data, your infrastructure, your rules.',
  'about.values.transparency.icon': '\uD83D\uDD0D',
  'about.values.transparency.title': 'Radical Transparency',
  'about.values.transparency.description':
    'Source-available code, open roadmap, honest communication. No hidden agendas, no surprise pricing, no vendor lock-in.',
  'about.values.simplicity.icon': '\u2728',
  'about.values.simplicity.title': 'Elegant Simplicity',
  'about.values.simplicity.description':
    'Complex problems deserve simple solutions. One config file, one command, one platform \u2014 no unnecessary complexity.',
  'about.values.ownership.icon': '\uD83C\uDFE1',
  'about.values.ownership.title': 'True Ownership',
  'about.values.ownership.description':
    'Everything we build for you belongs to you. Full source access, full data portability, zero lock-in.',
  // ── Company: Principles ────────────────────────────────────────────
  'about.principles.title': 'How We Build',
  'about.principles.subtitle': 'Five core principles shape the technical decisions behind Sovrium.',
  'about.principles.configOverCode.title': 'Configuration Over Coding',
  'about.principles.configOverCode.description':
    'Business applications should be configured, not programmed. TypeScript, YAML, or JSON \u2014 choose your format, get a complete app in seconds.',
  'about.principles.minimalDeps.title': 'Minimal Dependencies',
  'about.principles.minimalDeps.description':
    'One runtime (Bun), one database (PostgreSQL), zero vendor SDKs. Reduce your dependency surface to only essential infrastructure.',
  'about.principles.businessFocus.title': 'Business Focus',
  'about.principles.businessFocus.description':
    'Engineers should focus on business logic, not infrastructure. Sovrium handles auth, database, API, and UI out of the box.',
  'about.principles.configReuse.title': 'Configuration Reusability',
  'about.principles.configReuse.description':
    'Configuration templates become organizational assets. Build CRM, project tools, and portals from composable, version-controlled configs.',

  // ── Company: Team ──────────────────────────────────────────────────
  'about.team.title': 'The Team',
  'about.team.subtitle':
    'Sovrium is built by ESSENTIAL SERVICES, a company dedicated to giving organizations control over their software.',
  'about.team.founder.name': 'Thomas Jeanneau',
  'about.team.founder.role': 'Founder & CEO',

  // ── Company: CTA ───────────────────────────────────────────────────
  'about.cta.title': 'Join the Movement',
  'about.cta.description':
    'Sovrium is open source and actively developed. Star the repo, contribute code, or build with us.',
  'about.cta.github': 'View on GitHub',
  'about.cta.partner': 'Work With Us',
  'about.cta.partner.href': '/en/partner',

  // ── Company: Origin Story ─────────────────────────────────────────
  'about.origin.title': 'Why Sovrium Exists',
  'about.origin.description':
    'After 8 years building automation tools and internal software for 50+ clients across France and Europe, I saw the same pattern everywhere: organizations trapped in SaaS subscriptions they couldn\u2019t leave, paying for features they didn\u2019t need, with data they couldn\u2019t fully control.',
  'about.origin.paragraph2':
    'I started Sovrium to prove that a better model exists \u2014 one where a single configuration file replaces dozens of SaaS subscriptions, and where you own every line of code and every byte of data.',
  'about.origin.signature': '\u2014 Thomas Jeanneau, Founder',

  // ════════════════════════════════════════════════════════════════════
  //  TERMS OF SERVICE PAGE
  // ════════════════════════════════════════════════════════════════════

  // ── Terms: Meta ───────────────────────────────────────────────────
  'terms.meta.title': 'Terms of Service - Sovrium',
  'terms.meta.description':
    'Terms of service and license information for Sovrium, the self-hosted configuration-driven platform.',
  'terms.meta.og.title': 'Terms of Service - Sovrium',
  'terms.meta.og.description':
    'Terms of service and license information for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',
  'terms.meta.twitter.title': 'Terms of Service - Sovrium',
  'terms.meta.twitter.description':
    'Terms of service and license information for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',

  // ── Terms: Header ─────────────────────────────────────────────────
  'terms.header.title': 'Terms of Service',
  'terms.header.lastUpdated': 'Last Updated: February 20, 2026',

  // ── Terms: 1. Agreement ───────────────────────────────────────────
  'terms.s1.title': '1. Agreement to Terms',
  'terms.s1.p1':
    'By accessing or using the Sovrium software, website, or any related services (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms") and all applicable laws and regulations. If you do not agree with these Terms, you may not use our Services.',

  // ── Terms: 2. Software License ────────────────────────────────────
  'terms.s2.title': '2. Software License',
  'terms.s2.p1':
    'Sovrium is licensed under the Business Source License 1.1 (BSL 1.1). The full license terms are available in the LICENSE.md file in the source repository.',
  'terms.s2.permitted.title': '2.1 Permitted Uses',
  'terms.s2.permitted.intro': 'You may use Sovrium for:',
  'terms.s2.permitted.item1': '\u2713 Internal business use within your organization',
  'terms.s2.permitted.item2': '\u2713 Personal projects and development',
  'terms.s2.permitted.item3': '\u2713 Educational and academic purposes',
  'terms.s2.permitted.item4': '\u2713 Non-competing client deployments',
  'terms.s2.permitted.item5':
    '\u2713 Creating applications for your own use or your direct clients',
  'terms.s2.prohibited.title': '2.2 Prohibited Uses',
  'terms.s2.prohibited.intro': 'Without a commercial license, you may NOT:',
  'terms.s2.prohibited.item1':
    '\u274C Offer Sovrium as a commercial hosted or managed service to third parties',
  'terms.s2.prohibited.item2': '\u274C Create a competitive SaaS offering based on Sovrium',
  'terms.s2.prohibited.item3':
    '\u274C Resell, sublicense, or distribute Sovrium as a commercial product',
  'terms.s2.prohibited.item4': '\u274C Remove or modify copyright notices or license terms',
  'terms.s2.changeDate.title': '2.3 Change Date',
  'terms.s2.changeDate.p1':
    'On January 1, 2029, the BSL 1.1 license will automatically convert to Apache License 2.0, making Sovrium fully open source.',
  'terms.s2.commercial.title': '2.4 Commercial Licensing',
  'terms.s2.commercial.p1':
    'For commercial hosting, managed services, or competitive use cases, please contact license@sovrium.com to obtain a commercial license.',

  // ── Terms: 3. Trademark ───────────────────────────────────────────
  'terms.s3.title': '3. Trademark and Branding',
  'terms.s3.p1':
    'Sovrium\u00AE is a registered trademark of ESSENTIAL SERVICES, registered with the Institut National de la Propri\u00E9t\u00E9 Industrielle (INPI) in France under registration number FR5200287.',
  'terms.s3.p2': 'The trademark registration can be verified on the INPI public registry:',
  'terms.s3.mayIntro': 'You may:',
  'terms.s3.may1': '\u2713 State that your application is "Powered by Sovrium"',
  'terms.s3.may2': '\u2713 Use the Sovrium name in factual statements about the software',
  'terms.s3.may3': '\u2713 Include Sovrium in technical documentation',
  'terms.s3.mayNotIntro': 'You may NOT:',
  'terms.s3.mayNot1': '\u274C Use Sovrium in your product name without permission',
  'terms.s3.mayNot2': '\u274C Imply endorsement by ESSENTIAL SERVICES',
  'terms.s3.mayNot3': '\u274C Modify the Sovrium logo without authorization',
  'terms.s3.guidelinesNote':
    'For detailed trademark guidelines, see TRADEMARK.md in the source repository.',

  // ── Terms: 4. Warranty ────────────────────────────────────────────
  'terms.s4.title': '4. Warranty Disclaimer',
  'terms.s4.p1':
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.',
  'terms.s4.p2': 'ESSENTIAL SERVICES does not warrant that:',
  'terms.s4.item1': '\u2022 The software will meet your requirements',
  'terms.s4.item2': '\u2022 The software will be uninterrupted or error-free',
  'terms.s4.item3': '\u2022 Any defects will be corrected',
  'terms.s4.item4': '\u2022 The software is free of vulnerabilities',

  // ── Terms: 5. Liability ───────────────────────────────────────────
  'terms.s5.title': '5. Limitation of Liability',
  'terms.s5.p1':
    'IN NO EVENT SHALL ESSENTIAL SERVICES, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, OR OTHER INTANGIBLE LOSSES.',
  'terms.s5.p2':
    'This limitation applies even if ESSENTIAL SERVICES has been advised of the possibility of such damages.',

  // ── Terms: 6. Indemnification ─────────────────────────────────────
  'terms.s6.title': '6. Indemnification',
  'terms.s6.p1':
    'You agree to indemnify and hold harmless ESSENTIAL SERVICES from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:',
  'terms.s6.item1': '\u2022 Your use of the software',
  'terms.s6.item2': '\u2022 Your violation of these Terms',
  'terms.s6.item3': '\u2022 Your violation of any third-party rights',
  'terms.s6.item4': '\u2022 Your applications built with Sovrium',

  // ── Terms: 7. Modifications ───────────────────────────────────────
  'terms.s7.title': '7. Modifications to Terms',
  'terms.s7.p1':
    'We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting to the website. Your continued use of the Services after changes constitutes acceptance of the modified Terms.',

  // ── Terms: 8. Termination ─────────────────────────────────────────
  'terms.s8.title': '8. Termination',
  'terms.s8.p1':
    'We may terminate or suspend your access to the Services immediately, without prior notice, for any reason, including:',
  'terms.s8.item1': '\u2022 Breach of these Terms',
  'terms.s8.item2': '\u2022 Violation of the BSL 1.1 license',
  'terms.s8.item3': '\u2022 Unauthorized commercial use',
  'terms.s8.item4': '\u2022 Harmful or malicious use',

  // ── Terms: 9. Governing Law ───────────────────────────────────────
  'terms.s9.title': '9. Governing Law',
  'terms.s9.p1':
    'These Terms shall be governed by and construed in accordance with the laws of France, without regard to its conflict of law provisions. Any disputes shall be resolved in the courts of France.',

  // ── Terms: 10. Severability ───────────────────────────────────────
  'terms.s10.title': '10. Severability',
  'terms.s10.p1':
    'If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.',

  // ── Terms: 11. Entire Agreement ───────────────────────────────────
  'terms.s11.title': '11. Entire Agreement',
  'terms.s11.p1':
    'These Terms, together with the BSL 1.1 license and any commercial license agreements, constitute the entire agreement between you and ESSENTIAL SERVICES regarding the use of Sovrium.',

  // ── Terms: 12. User Data ──────────────────────────────────────────
  'terms.s12.title': '12. User Data and Privacy',
  'terms.s12.p1':
    'Your use of Sovrium may involve the collection, processing, and storage of personal data. Our handling of personal data is governed by our Privacy Policy, available at sovrium.com/privacy-policy.',
  'terms.s12.p2':
    'For self-hosted installations, the organization operating the Sovrium instance is the data controller and is responsible for compliance with applicable data protection laws (e.g., GDPR). ESSENTIAL SERVICES does not access, process, or store data from self-hosted installations.',
  'terms.s12.p3':
    'You may request the deletion of your personal data in accordance with our Data Deletion policy at sovrium.com/data-deletion.',

  // ── Terms: 13. Contact ────────────────────────────────────────────
  'terms.s13.title': '13. Contact Information',
  'terms.s13.intro': 'For questions about these Terms or licensing:',
  'terms.s13.item1': '\u2022 License inquiries: license@sovrium.com',
  'terms.s13.item2': '\u2022 General questions: GitHub Issues',
  'terms.s13.item3': '\u2022 Company: ESSENTIAL SERVICES, SAS au capital de 10 000 \u20AC',
  'terms.s13.item4': '\u2022 RCS Paris \u2014 SIREN: 834 241 481',
  'terms.s13.item5': '\u2022 SIRET: 834 241 481 00029',
  'terms.s13.item6': '\u2022 TVA: FR04834241481',
  'terms.s13.item7': '\u2022 Address: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
  'terms.s13.item8': '\u2022 President: Thomas Jeanneau',
  'terms.s13.item9': '\u2022 Website: sovrium.com',

  // ── Terms: Notice ─────────────────────────────────────────────────
  'terms.notice.title': '\u26A0\uFE0F Important Notice',
  'terms.notice.p1':
    'By downloading, installing, or using Sovrium, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and the Business Source License 1.1.',

  // ════════════════════════════════════════════════════════════════════
  //  PRIVACY POLICY PAGE
  // ════════════════════════════════════════════════════════════════════

  // ── Privacy: Meta ─────────────────────────────────────────────────
  'privacy.meta.title': 'Privacy Policy - Sovrium',
  'privacy.meta.description':
    'Privacy policy for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',
  'privacy.meta.og.title': 'Privacy Policy - Sovrium',
  'privacy.meta.og.description':
    'Privacy policy for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',
  'privacy.meta.twitter.title': 'Privacy Policy - Sovrium',
  'privacy.meta.twitter.description':
    'Privacy policy for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',

  // ── Privacy: Header ───────────────────────────────────────────────
  'privacy.header.title': 'Privacy Policy',
  'privacy.header.lastUpdated': 'Last Updated: February 20, 2026',

  // ── Privacy: 1. Introduction ──────────────────────────────────────
  'privacy.s1.title': '1. Introduction',
  'privacy.s1.p1':
    'ESSENTIAL SERVICES ("we", "us", "our") respects your privacy. This Privacy Policy explains how we collect, use, and protect information related to sovrium.com (the "Website") and the Sovrium software (the "Software").',
  'privacy.s1.p2':
    'Sovrium is designed with digital sovereignty in mind. As a self-hosted platform, we believe your data should remain under your control.',

  // ── Privacy: 2. Data Collection ───────────────────────────────────
  'privacy.s2.title': '2. Data Collection',
  'privacy.s2.analytics.title': '2.1 Website Analytics',
  'privacy.s2.analytics.p1':
    'We may use privacy-respecting analytics services (such as Plausible Analytics) to understand website traffic and usage patterns. These services:',
  'privacy.s2.analytics.item1': '\u2022 Do not use cookies',
  'privacy.s2.analytics.item2': '\u2022 Do not collect personal data',
  'privacy.s2.analytics.item3': '\u2022 Do not track users across sites',
  'privacy.s2.analytics.item4': '\u2022 Are fully GDPR compliant',
  'privacy.s2.cookies.title': '2.2 Cookies',
  'privacy.s2.cookies.p1':
    'The sovrium.com website does not use cookies. We do not set any first-party or third-party cookies. No cookie consent banner is necessary because no cookies are used.',
  'privacy.s2.selfHosted.title': '2.3 Self-Hosted Software',
  'privacy.s2.selfHosted.p1':
    'Sovrium is self-hosted software that runs on your infrastructure. We do not:',
  'privacy.s2.selfHosted.item1': '\u2022 Collect data from your Sovrium installations',
  'privacy.s2.selfHosted.item2': '\u2022 Store or process your application data',
  'privacy.s2.selfHosted.item3': '\u2022 Have access to your configurations',
  'privacy.s2.selfHosted.item4': '\u2022 Monitor your usage or deployments',
  'privacy.s2.selfHosted.note':
    'You are the data controller for all data processed by your Sovrium installation.',
  'privacy.s2.github.title': '2.4 GitHub and Open Source',
  'privacy.s2.github.p1':
    'When you interact with our GitHub repository (issues, pull requests, discussions), GitHub collects data according to their privacy policy. We may see public information you share on GitHub.',
  'privacy.s2.facebook.title': '2.5 Facebook and Social Login',
  'privacy.s2.facebook.p1':
    'Sovrium-powered applications may integrate Facebook Login (or other social authentication providers) as an optional sign-in method. When a user authenticates via Facebook Login, the following data may be received by the Sovrium application:',
  'privacy.s2.facebook.item1': '\u2022 Name and profile picture',
  'privacy.s2.facebook.item2': '\u2022 Email address',
  'privacy.s2.facebook.item3': '\u2022 Facebook user ID',
  'privacy.s2.facebook.legal':
    'Legal basis: This data is processed under GDPR Art. 6(1)(b) (performance of a contract) when you choose to sign in via Facebook Login, and Art. 6(1)(a) (consent) as you explicitly authorize the data sharing through Facebook\u2019s authorization dialog.',
  'privacy.s2.facebook.purpose':
    'This data is used solely for the purpose of authenticating your identity and creating your user account within the Sovrium-powered application. For self-hosted installations, this data is stored on the infrastructure controlled by the organization operating the application. ESSENTIAL SERVICES does not have access to this data unless it directly operates the application.',
  'privacy.s2.facebook.deletion':
    'You may request deletion of your data at any time. See our Data Deletion page at sovrium.com/data-deletion for detailed instructions.',

  // ── Privacy: 3. Use of Information ────────────────────────────────
  'privacy.s3.title': '3. Use of Information',
  'privacy.s3.p1': 'Any analytics data we collect is used solely to:',
  'privacy.s3.item1': '\u2022 Improve our website and documentation',
  'privacy.s3.item2': '\u2022 Understand which features interest users',
  'privacy.s3.item3': '\u2022 Fix technical issues with the website',
  'privacy.s3.item4': '\u2022 Plan development priorities',
  'privacy.s3.retention.title': '3.1 Data Retention',
  'privacy.s3.retention.item1':
    '\u2022 Website analytics: Aggregated and anonymized. No personal data is retained.',
  'privacy.s3.retention.item2':
    '\u2022 Facebook Login data (for ESSENTIAL SERVICES-operated applications): Retained as long as your user account is active. Deleted within 30 days of a valid deletion request.',
  'privacy.s3.retention.item3':
    '\u2022 Self-hosted installations: Data retention is determined by the organization operating the Sovrium instance.',

  // ── Privacy: 4. Third-Party Services ──────────────────────────────
  'privacy.s4.title': '4. Third-Party Services',
  'privacy.s4.p1': 'Our website may link to or interact with third-party services:',
  'privacy.s4.item1': '\u2022 GitHub (for source code and issues)',
  'privacy.s4.item2': '\u2022 Google Fonts (for typography)',
  'privacy.s4.item3':
    '\u2022 Facebook/Meta (for social authentication in Sovrium-powered applications)',
  'privacy.s4.item4': '\u2022 CDN services (for faster content delivery)',
  'privacy.s4.note':
    'These services have their own privacy policies and data practices. We encourage you to review their policies, in particular the Meta Privacy Policy at https://www.facebook.com/privacy/policy/.',
  'privacy.s4.sharing.title': '4.1 Data Sharing',
  'privacy.s4.sharing.p1':
    'ESSENTIAL SERVICES does not sell, rent, or trade your personal data to third parties. We do not share your personal data with third parties for their marketing purposes. Data may only be shared with third parties in the following limited circumstances:',
  'privacy.s4.sharing.item1':
    '\u2022 With your explicit consent (e.g., when you authorize a social login)',
  'privacy.s4.sharing.item2':
    '\u2022 To comply with legal obligations or respond to lawful government requests',
  'privacy.s4.sharing.item3':
    '\u2022 To protect the rights, property, or safety of ESSENTIAL SERVICES, our users, or the public',

  // ── Privacy: 5. International Transfers ───────────────────────────
  'privacy.s5.title': '5. International Data Transfers',
  'privacy.s5.p1':
    'When you use Facebook Login or other social authentication providers, your data may be transferred to and processed in countries outside the European Economic Area (EEA), including the United States. These transfers are necessary for the performance of the authentication service and are conducted in accordance with applicable data protection laws.',
  'privacy.s5.p2':
    'Where data is transferred outside the EEA, we rely on appropriate safeguards such as the EU-US Data Privacy Framework, Standard Contractual Clauses (SCCs), or other lawful transfer mechanisms to ensure your data is adequately protected.',
  'privacy.s5.p3':
    'For self-hosted Sovrium installations, data transfers are determined by the organization operating the instance. ESSENTIAL SERVICES has no involvement in those transfers.',

  // ── Privacy: 6. Your Rights ───────────────────────────────────────
  'privacy.s6.title': '6. Your Rights',
  'privacy.s6.p1': 'Under GDPR and other privacy laws, you have the right to:',
  'privacy.s6.item1': '\u2022 Access any personal data we hold about you',
  'privacy.s6.item2': '\u2022 Request correction of inaccurate data',
  'privacy.s6.item3': '\u2022 Request deletion of your data',
  'privacy.s6.item4': '\u2022 Object to data processing',
  'privacy.s6.item5': '\u2022 Request data portability',
  'privacy.s6.contact': 'To exercise these rights, contact us at privacy@sovrium.com.',

  // ── Privacy: 7. Security ──────────────────────────────────────────
  'privacy.s7.title': '7. Security',
  'privacy.s7.p1':
    'We take reasonable measures to protect any information we collect. However, as we collect minimal data and the Sovrium software is self-hosted, your primary security responsibility lies with your own infrastructure and deployment practices.',

  // ── Privacy: 8. Children ──────────────────────────────────────────
  'privacy.s8.title': "8. Children's Privacy",
  'privacy.s8.p1':
    'Our website and software are not directed to children under 13. We do not knowingly collect personal information from children under 13.',

  // ── Privacy: 9. Changes ───────────────────────────────────────────
  'privacy.s9.title': '9. Changes to This Policy',
  'privacy.s9.p1':
    'We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Your continued use of the website after changes constitutes acceptance of the updated policy.',

  // ── Privacy: 10. Contact ──────────────────────────────────────────
  'privacy.s10.title': '10. Contact Information',
  'privacy.s10.intro': 'For privacy-related inquiries:',
  'privacy.s10.item1': '\u2022 Email: privacy@sovrium.com',
  'privacy.s10.item2': '\u2022 GitHub Issues: https://github.com/sovrium/sovrium/issues',
  'privacy.s10.item3': '\u2022 Company: ESSENTIAL SERVICES, SAS au capital de 10 000 \u20AC',
  'privacy.s10.item4': '\u2022 RCS Paris \u2014 SIREN: 834 241 481',
  'privacy.s10.item5': '\u2022 SIRET: 834 241 481 00029',
  'privacy.s10.item6': '\u2022 TVA: FR04834241481',
  'privacy.s10.item7': '\u2022 Address: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
  'privacy.s10.item8': '\u2022 President: Thomas Jeanneau',
  'privacy.s10.item9': '\u2022 Data Deletion: sovrium.com/data-deletion',

  // ── Privacy: 11. Data Protection ──────────────────────────────────
  'privacy.s11.title': '11. Data Protection',
  'privacy.s11.p1':
    'As a company committed to digital sovereignty, we practice data minimization. We collect the absolute minimum data necessary and encourage you to maintain control of your own data through self-hosting.',

  // ════════════════════════════════════════════════════════════════════
  //  DATA DELETION PAGE
  // ════════════════════════════════════════════════════════════════════

  // ── DataDeletion: Meta ────────────────────────────────────────────
  'dataDeletion.meta.title': 'Data Deletion Request - Sovrium',
  'dataDeletion.meta.description':
    'Instructions for requesting deletion of your data related to Sovrium software and services by ESSENTIAL SERVICES.',
  'dataDeletion.meta.og.title': 'Data Deletion Request - Sovrium',
  'dataDeletion.meta.og.description':
    'Instructions for requesting deletion of your data related to Sovrium software and services by ESSENTIAL SERVICES.',
  'dataDeletion.meta.twitter.title': 'Data Deletion Request - Sovrium',
  'dataDeletion.meta.twitter.description':
    'Instructions for requesting deletion of your data related to Sovrium software and services by ESSENTIAL SERVICES.',

  // ── DataDeletion: Header ──────────────────────────────────────────
  'dataDeletion.header.title': 'Data Deletion Request',
  'dataDeletion.header.lastUpdated': 'Last Updated: February 20, 2026',

  // ── DataDeletion: Intro ───────────────────────────────────────────
  'dataDeletion.intro.p1':
    'This page explains how to request the deletion of your personal data in connection with Sovrium software and services operated by ESSENTIAL SERVICES. Depending on how you interact with Sovrium, the process may differ.',

  // ── DataDeletion: 1. Self-Hosted ──────────────────────────────────
  'dataDeletion.s1.title': '1. Sovrium Software (Self-Hosted Installations)',
  'dataDeletion.s1.p1':
    'Sovrium is a self-hosted, configuration-driven application platform. When an organization deploys Sovrium on their own infrastructure, they are the data controller for all user data processed by that installation. ESSENTIAL SERVICES does not have access to data stored in self-hosted Sovrium instances.',
  'dataDeletion.s1.p2': 'If you are a user of a Sovrium-powered application:',
  'dataDeletion.s1.item1':
    '\u2022 Contact the administrator of the organization that operates the application',
  'dataDeletion.s1.item2':
    '\u2022 The organization is responsible for handling your data deletion request under applicable data protection laws (e.g., GDPR)',
  'dataDeletion.s1.item3':
    '\u2022 ESSENTIAL SERVICES cannot delete data from self-hosted installations as we do not have access to them',

  // ── DataDeletion: 2. Facebook Login ───────────────────────────────
  'dataDeletion.s2.title': '2. Facebook Login and Social Authentication',
  'dataDeletion.s2.p1':
    'Sovrium-powered applications may integrate Facebook Login as an authentication method. When you use Facebook Login to sign in to a Sovrium-powered application, certain data from your Facebook profile may be shared with that application.',
  'dataDeletion.s2.p2':
    'The following data types may be stored and are subject to deletion upon request:',
  'dataDeletion.s2.item1': '\u2022 Your name (as provided by Facebook)',
  'dataDeletion.s2.item2': '\u2022 Your email address',
  'dataDeletion.s2.item3': '\u2022 Your profile picture URL',
  'dataDeletion.s2.item4': '\u2022 Your Facebook user ID',
  'dataDeletion.s2.item5':
    '\u2022 Any application-specific data created during your use of the Sovrium-powered application',
  'dataDeletion.s2.deleteIntro': 'To delete your data associated with Facebook Login:',
  'dataDeletion.s2.step1.title': 'Step 1: Remove the app from Facebook',
  'dataDeletion.s2.step1.item1': '\u2022 Go to your Facebook Settings',
  'dataDeletion.s2.step1.item2':
    '\u2022 Navigate to Settings & Privacy > Settings > Apps and Websites',
  'dataDeletion.s2.step1.item3':
    '\u2022 Find the Sovrium-powered application and click "Remove" to revoke access',
  'dataDeletion.s2.step1.item4':
    '\u2022 Check the box to delete any data the app may have received from Facebook',
  'dataDeletion.s2.step2.title': 'Step 2: Contact the application administrator',
  'dataDeletion.s2.step2.item1':
    '\u2022 Contact the organization that operates the Sovrium-powered application',
  'dataDeletion.s2.step2.item2':
    '\u2022 Request deletion of all personal data stored in their Sovrium installation, including data received via Facebook Login',
  'dataDeletion.s2.step3.title': 'Step 3: For applications operated by ESSENTIAL SERVICES',
  'dataDeletion.s2.step3.p1':
    'If the application is directly operated by ESSENTIAL SERVICES, you can request data deletion by emailing privacy@sovrium.com with the subject line "Data Deletion Request". Please include the email address associated with your account.',

  // ── DataDeletion: 3. Website ──────────────────────────────────────
  'dataDeletion.s3.title': '3. sovrium.com Website',
  'dataDeletion.s3.p1':
    'The sovrium.com website collects minimal data. We do not use cookies, do not require user accounts, and do not collect personal information through our website. If you believe we hold any personal data about you from your interactions with our website, you may contact us at privacy@sovrium.com to request its deletion.',

  // ── DataDeletion: 4. Confirmation ─────────────────────────────────
  'dataDeletion.s4.title': '4. Data Deletion Confirmation',
  'dataDeletion.s4.p1':
    'When we receive a valid data deletion request for services operated by ESSENTIAL SERVICES:',
  'dataDeletion.s4.item1': '\u2022 We will process your request within 30 days of receipt',
  'dataDeletion.s4.item2': '\u2022 We will send you a confirmation once your data has been deleted',
  'dataDeletion.s4.item3':
    '\u2022 Some data may be retained if required by law or legitimate legal obligations',
  'dataDeletion.s4.item4':
    '\u2022 You will receive a confirmation code via email that you can use to verify the status of your deletion request',

  // ── DataDeletion: 5. Contact ──────────────────────────────────────
  'dataDeletion.s5.title': '5. Contact',
  'dataDeletion.s5.intro': 'For data deletion requests or questions about your data:',
  'dataDeletion.s5.item1': '\u2022 Email: privacy@sovrium.com',
  'dataDeletion.s5.item2': '\u2022 Company: ESSENTIAL SERVICES, SAS au capital de 10 000 \u20AC',
  'dataDeletion.s5.item3': '\u2022 RCS Paris \u2014 SIREN: 834 241 481',
  'dataDeletion.s5.item4': '\u2022 SIRET: 834 241 481 00029',
  'dataDeletion.s5.item5': '\u2022 TVA: FR04834241481',
  'dataDeletion.s5.item6': '\u2022 Address: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
  'dataDeletion.s5.item7': '\u2022 President: Thomas Jeanneau',

  // ════════════════════════════════════════════════════════════════════
  //  DOCS SCHEMA PAGE
  // ════════════════════════════════════════════════════════════════════

  // ── Docs: Navigation ──────────────────────────────────────────────
  'nav.docs': 'Docs',
  'nav.docs.href': '/en/docs',

  // ── Docs: Sidebar ─────────────────────────────────────────────────
  'docs.sidebar.toggle': 'Menu',
  'docs.sidebar.section.getStarted': 'Get Started',
  'docs.sidebar.section.appSchema': 'App Schema',
  'docs.sidebar.introduction': 'Introduction',
  'docs.sidebar.introduction.href': '/en/docs',
  'docs.sidebar.installation': 'Installation',
  'docs.sidebar.installation.href': '/en/docs/installation',
  'docs.sidebar.quickStart': 'Quick Start',
  'docs.sidebar.quickStart.href': '/en/docs/quick-start',
  'docs.sidebar.overview': 'Overview',
  'docs.sidebar.overview.href': '/en/docs/overview',
  'docs.sidebar.tables': 'Tables & Fields',
  'docs.sidebar.tables.href': '/en/docs/tables',
  'docs.sidebar.theme': 'Theme',
  'docs.sidebar.theme.href': '/en/docs/theme',
  'docs.sidebar.pages': 'Pages & Components',
  'docs.sidebar.pages.href': '/en/docs/pages',
  'docs.sidebar.auth': 'Authentication',
  'docs.sidebar.auth.href': '/en/docs/auth',
  'docs.sidebar.languages': 'Languages',
  'docs.sidebar.languages.href': '/en/docs/languages',
  'docs.sidebar.analytics': 'Analytics',
  'docs.sidebar.analytics.href': '/en/docs/analytics',
  'docs.sidebar.apiReference': 'API Reference',
  'docs.sidebar.apiReference.href': '/en/docs/api-reference',
  'docs.sidebar.resources': 'Resources',
  'docs.sidebar.resources.href': '/en/docs/resources',

  // ── Docs: Per-Page Meta ──────────────────────────────────────────
  'docs.introduction.meta.title': 'Introduction - Sovrium Docs',
  'docs.introduction.meta.description':
    'Learn what Sovrium is, why it exists, and how it lets you build complete applications from a single configuration file.',
  'docs.installation.meta.title': 'Installation - Sovrium Docs',
  'docs.installation.meta.description':
    'Install Sovrium via Bun and create your first configuration file in YAML or JSON.',
  'docs.quickStart.meta.title': 'Quick Start - Sovrium Docs',
  'docs.quickStart.meta.description':
    'Build your first Sovrium app in minutes using YAML or TypeScript. Install, configure, and start the server.',
  'docs.overview.meta.title': 'Schema Overview - Sovrium Docs',
  'docs.overview.meta.description':
    'Complete reference for the 10 root properties of the Sovrium app schema. Define data models, authentication, pages, themes, and analytics.',
  'docs.tables.meta.title': 'Tables & Fields - Sovrium Docs',
  'docs.tables.meta.description':
    'Define data models with 41 field types, relationships, and RBAC permissions in the Sovrium schema.',
  'docs.theme.meta.title': 'Theme - Sovrium Docs',
  'docs.theme.meta.description':
    'Customize colors, fonts, spacing, shadows, animations, and breakpoints in the Sovrium theme system.',
  'docs.pages.meta.title': 'Pages & Components - Sovrium Docs',
  'docs.pages.meta.description':
    'Build server-rendered pages with 62 component types, SEO metadata, and i18n support.',
  'docs.auth.meta.title': 'Authentication - Sovrium Docs',
  'docs.auth.meta.description':
    'Configure authentication strategies, roles, two-factor auth, and email templates.',
  'docs.languages.meta.title': 'Languages - Sovrium Docs',
  'docs.languages.meta.description':
    'Add multi-language support with the $t: translation syntax and locale configuration.',
  'docs.analytics.meta.title': 'Analytics - Sovrium Docs',
  'docs.analytics.meta.description':
    'Enable privacy-friendly, cookie-free analytics with configurable retention and session options.',
  'docs.apiReference.meta.title': 'API Reference - Sovrium Docs',
  'docs.apiReference.meta.description':
    'Interactive API documentation for Sovrium. Explore health, authentication, and admin endpoints.',
  'docs.apiReference.earlyPreview':
    'Early Preview \u2014 The API surface is evolving. Endpoints may change before v1.0.',
  'docs.apiReference.loading': 'Loading API reference\u2026',
  'docs.resources.meta.title': 'Resources - Sovrium Docs',
  'docs.resources.meta.description':
    'LLM references, JSON Schema, GitHub repository, and additional resources for the Sovrium schema.',

  // ── Docs: Get Started — Introduction ────────────────────────────
  'docs.introduction.header.title': 'Introduction',
  'docs.introduction.header.description':
    'Sovrium is an open-source, self-hosted platform that turns a single configuration file into a complete web application.',
  'docs.introduction.what.title': 'What is Sovrium?',
  'docs.introduction.what.description':
    'Sovrium is a configuration-driven application platform. You describe your application in a YAML or JSON file \u2014 data models, authentication, pages, themes, analytics \u2014 and Sovrium turns it into a running, full-stack web application.',
  'docs.introduction.what.detail':
    'No boilerplate code, no framework setup, no build pipeline. Just one file that declares what your app should be.',
  'docs.introduction.why.title': 'Why Sovrium?',
  'docs.introduction.why.description':
    'Most business applications share the same building blocks: data tables, user authentication, server-rendered pages, and a design system. Sovrium provides all of these out of the box, configured through a single schema.',
  'docs.introduction.why.point1.title': 'No vendor lock-in',
  'docs.introduction.why.point1.description':
    'Self-hosted on your infrastructure. Your data stays yours.',
  'docs.introduction.why.point2.title': 'Configuration over code',
  'docs.introduction.why.point2.description':
    'Declare what you need instead of writing boilerplate. 41 field types, 62 component types, built-in auth.',
  'docs.introduction.why.point3.title': 'Progressive complexity',
  'docs.introduction.why.point3.description':
    'Start with just a name. Add tables, theme, pages, auth, and analytics as your needs grow.',
  'docs.introduction.why.point4.title': 'Open source',
  'docs.introduction.why.point4.description':
    'Business Source License 1.1. Free for internal use. Becomes Apache 2.0 in 2029.',
  'docs.introduction.how.title': 'How it works',
  'docs.introduction.how.description':
    'Write a configuration file, run one command, and get a working application:',
  'docs.introduction.how.step1': 'Define your schema in YAML or JSON',
  'docs.introduction.how.step2': 'Run sovrium start app.yaml',
  'docs.introduction.how.step3': 'Get a full-stack app with data tables, auth, pages, and more',
  'docs.introduction.next.title': 'Next steps',
  'docs.introduction.next.description':
    'Ready to try it? Install Sovrium and build your first app in under 5 minutes.',

  // ── Docs: Get Started — Installation ────────────────────────────
  'docs.installation.header.title': 'Installation',
  'docs.installation.header.description':
    'Install Sovrium globally or as a project dependency using Bun.',
  'docs.installation.prerequisites.title': 'Prerequisites',
  'docs.installation.prerequisites.descriptionBefore': 'Sovrium requires ',
  'docs.installation.prerequisites.descriptionLink': 'Bun 1.0+',
  'docs.installation.prerequisites.descriptionAfter':
    '. A PostgreSQL database is optional, needed only for data persistence (tables, auth).',
  'docs.installation.global.title': 'Global installation',
  'docs.installation.global.description':
    'Install Sovrium globally to use the sovrium command from anywhere:',
  'docs.installation.project.title': 'Project dependency',
  'docs.installation.project.description': 'Or add Sovrium as a dependency in an existing project:',
  'docs.installation.verify.title': 'Verify installation',
  'docs.installation.verify.description':
    'Run the help command to check that Sovrium is installed correctly:',
  'docs.installation.config.title': 'Create a config file',
  'docs.installation.config.description':
    'Sovrium reads a YAML or JSON configuration file. Create an app.yaml with the simplest valid config:',
  'docs.installation.config.tip.title': 'YAML or JSON',
  'docs.installation.config.tip.body':
    'Sovrium supports both .yaml/.yml and .json files. YAML is recommended for readability.',
  'docs.installation.database.title': 'Database setup',
  'docs.installation.database.description':
    'If your app uses tables or auth, set the DATABASE_URL environment variable:',
  'docs.installation.database.tip.title': 'No database needed for static sites',
  'docs.installation.database.tip.body':
    'If you only use pages and theme (no tables or auth), Sovrium works without a database. Run sovrium build app.yaml to generate a static site.',

  // ── Docs: Get Started — Quick Start ─────────────────────────────
  'docs.quickStart.header.title': 'Quick Start',
  'docs.quickStart.header.description':
    'Build your first Sovrium app in minutes. From zero to a running application. Choose the approach that fits your workflow.',
  'docs.quickStart.chooseApproach': 'Choose your approach',
  'docs.quickStart.chooseApproach.description':
    'Sovrium supports two configuration formats. YAML is great for simplicity; TypeScript gives you full type safety and autocompletion.',

  // Option A: YAML + CLI
  'docs.quickStart.yaml.title': 'Option A \u2014 YAML + CLI',
  'docs.quickStart.yaml.description':
    'The simplest path. Install the Sovrium CLI, write a YAML config, and start the server:',
  'docs.quickStart.yaml.step1.title': 'Install the CLI',
  'docs.quickStart.yaml.step1.description':
    'Install Sovrium globally with Bun to get the sovrium command.',
  'docs.quickStart.yaml.step2.title': 'Create a config file',
  'docs.quickStart.yaml.step2.description':
    'Create an app.yaml with the simplest valid configuration \u2014 just a name.',
  'docs.quickStart.yaml.step3.title': 'Add data tables',
  'docs.quickStart.yaml.step3.description':
    'Define your data models with typed fields, options, and validation.',
  'docs.quickStart.yaml.step4.title': 'Start the server',
  'docs.quickStart.yaml.step4.description':
    'Run the dev server and visit http://localhost:3000 to see your app.',

  // Option B: TypeScript + Bun
  'docs.quickStart.ts.title': 'Option B \u2014 TypeScript + Bun',
  'docs.quickStart.ts.description':
    'The power-user path. Create a Bun project, add Sovrium as a dependency, and write type-safe code:',
  'docs.quickStart.ts.step1.title': 'Initialize a project',
  'docs.quickStart.ts.step1.description':
    'Scaffold a new Bun project with bun init and move into the directory.',
  'docs.quickStart.ts.step2.title': 'Add Sovrium',
  'docs.quickStart.ts.step2.description': 'Install Sovrium as a project dependency.',
  'docs.quickStart.ts.step3.title': 'Write your app',
  'docs.quickStart.ts.step3.description':
    'Open index.ts and import the start function with a minimal configuration.',
  'docs.quickStart.ts.step4.title': 'Add data tables',
  'docs.quickStart.ts.step4.description':
    'Extend the configuration with typed fields, options, and validation \u2014 with full autocompletion.',
  'docs.quickStart.ts.step5.title': 'Run your app',
  'docs.quickStart.ts.step5.description':
    'Execute index.ts with Bun. Visit http://localhost:3000 to see your app.',
  'docs.quickStart.ts.tip.title': 'Why TypeScript?',
  'docs.quickStart.ts.tip.body':
    'TypeScript gives you autocompletion for every property, compile-time validation of field types, and the full power of Bun as your runtime. Ideal for developers who prefer code over config files.',

  // Shared
  'docs.quickStart.tip.title': 'Add more as you go',
  'docs.quickStart.tip.body':
    'Start small with just tables. Then progressively add theme, auth, pages, and analytics as your needs grow.',
  'docs.quickStart.whatsNext.title': 'What\u2019s next?',
  'docs.quickStart.whatsNext.description':
    'Now that your app is running, explore the schema reference to add more capabilities:',
  'docs.quickStart.whatsNext.overview': 'Schema Overview \u2014 All 10 root properties explained',
  'docs.quickStart.whatsNext.tables': 'Tables & Fields \u2014 41 field types, permissions, indexes',
  'docs.quickStart.whatsNext.theme': 'Theme \u2014 Colors, fonts, spacing, and design tokens',
  'docs.quickStart.whatsNext.pages': 'Pages \u2014 62 component types for server-rendered pages',

  // ── Docs: App Schema — Overview ─────────────────────────────────
  'docs.overview.header.title': 'Schema Overview',
  'docs.overview.header.description':
    'The complete reference for the Sovrium app schema. A declarative configuration object with 10 root properties.',
  'docs.overview.title': 'Schema Structure',
  'docs.overview.description':
    'A Sovrium app is a declarative configuration object with 10 root properties. Only name is required \u2014 everything else is optional, enabling progressive complexity from a minimal app identifier to a full-stack application.',
  'docs.overview.footnote':
    'Configuration files can be written in YAML or JSON. Run sovrium start app.yaml to launch a dev server, or sovrium build app.yaml to generate a static site.',
  'docs.overview.tip.title': 'Progressive complexity',
  'docs.overview.tip.body':
    'Only name is required. Add tables, theme, pages, auth, and other sections as your app grows.',

  // ── Docs: App Schema — Root Properties ──────────────────────────
  'docs.rootProps.title': 'Root Properties',
  'docs.rootProps.description': 'The app schema has 10 root properties. Only name is required.',
  'docs.rootProps.name.description':
    'App identifier following npm naming conventions. Lowercase, max 214 chars, supports scoped format (@scope/name).',
  'docs.rootProps.version.description':
    'Semantic Versioning 2.0.0 string (e.g., 1.0.0, 2.0.0-beta.1). Supports pre-release and build metadata.',
  'docs.rootProps.description.description':
    'Single-line app description. No line breaks allowed. Unicode and emojis supported.',
  'docs.rootProps.tables.description':
    'Data models with 41 field types, relationships, indexes, permissions, and views.',
  'docs.rootProps.theme.description':
    'Design tokens: colors, fonts, spacing, shadows, animations, breakpoints, and border radius.',
  'docs.rootProps.pages.description':
    'Server-rendered pages with 62 component types, SEO metadata, and i18n support.',
  'docs.rootProps.auth.description':
    'Authentication strategies (email/password, magic link, OAuth), roles, and two-factor authentication.',
  'docs.rootProps.languages.description':
    'Multi-language support with $t: translation syntax, browser detection, and language persistence.',
  'docs.rootProps.components.description':
    'Reusable UI templates with $ref referencing and $variable substitution.',
  'docs.rootProps.analytics.description':
    'Privacy-friendly, cookie-free, first-party analytics. Set to true for defaults or configure with options.',

  // ── Docs: Section 4 — Tables & Fields ─────────────────────────────
  'docs.tables.title': 'Tables & Fields',
  'docs.tables.description':
    'Tables define your data models. Each table has an id, name, fields, and optional permissions, indexes, and views.',
  'docs.tables.structure.title': 'Table Structure',
  'docs.tables.structure.description':
    'Each table has an id, name, fields array, and optional permissions and indexes.',
  'docs.tables.baseFields.title': 'Base Field Properties',
  'docs.tables.baseFields.description':
    'Every field has these base properties: id (unique integer), name (identifier), type (one of 41 types), and optional required, unique, description, and defaultValue.',
  'docs.tables.baseFields.id': 'Unique integer identifier for the field within the table.',
  'docs.tables.baseFields.name':
    'Field name used as the column identifier. Follows naming conventions.',
  'docs.tables.baseFields.type':
    'One of the 41 available field types (e.g., single-line-text, integer, checkbox).',
  'docs.tables.baseFields.required':
    'Boolean. When true, the field must have a value for every record.',
  'docs.tables.baseFields.unique': 'Boolean. When true, no two records can have the same value.',
  'docs.tables.baseFields.descriptionProp':
    'Optional human-readable description shown as a tooltip in the UI.',
  'docs.tables.baseFields.defaultValue':
    'Default value assigned when a record is created without specifying this field.',
  'docs.tables.fieldTypes.title': '41 Field Types',
  'docs.tables.fieldTypes.description': 'Field types are organized into 9 categories:',
  'docs.tables.fieldTypes.text.description':
    'Fields for textual content \u2014 from short labels to rich formatted text and structured strings.',
  'docs.tables.fieldTypes.numeric.description':
    'Fields for numbers, currencies, percentages, ratings, and progress indicators.',
  'docs.tables.fieldTypes.selection.description':
    'Fields for choosing from predefined options \u2014 single or multi-select with colored labels.',
  'docs.tables.fieldTypes.text': 'Text Fields',
  'docs.tables.fieldTypes.numeric': 'Numeric Fields',
  'docs.tables.fieldTypes.selection': 'Selection Fields',
  'docs.tables.fieldTypes.dateTime': 'Date & Time Fields',
  'docs.tables.fieldTypes.user': 'User & Audit Fields',
  'docs.tables.fieldTypes.relational': 'Relational Fields',
  'docs.tables.fieldTypes.media': 'Attachment Fields',
  'docs.tables.fieldTypes.computed': 'Computed Fields',
  'docs.tables.fieldTypes.advanced': 'Advanced Fields',
  'docs.tables.permissions.title': 'Permissions (RBAC)',
  'docs.tables.permissions.description':
    'Table permissions use role-based access control. Each permission (create, read, update, delete, comment) accepts: "all" (public), "authenticated" (logged-in users), or an array of role names.',
  'docs.tables.permissions.tip.title': 'Three access levels',
  'docs.tables.permissions.tip.body':
    '"all" for public access, "authenticated" for any logged-in user, or an array of role names like [admin, member] for specific roles.',

  // ── Docs: Section 5 — Theme ───────────────────────────────────────
  'docs.theme.title': 'Theme',
  'docs.theme.description':
    'The theme property defines your design system with 7 optional token categories. All tokens generate CSS custom properties and Tailwind CSS utility classes.',
  'docs.theme.colors.title': 'colors',
  'docs.theme.colors.description':
    'Named color tokens as key-value pairs. Each becomes a CSS variable (--color-{name}) and Tailwind class (bg-{name}, text-{name}).',
  'docs.theme.fonts.title': 'fonts',
  'docs.theme.fonts.description':
    'Typography configuration for heading, body, and mono fonts. Supports family, fallback, weights, size, line height, and Google Fonts URL.',
  'docs.theme.spacing.title': 'spacing',
  'docs.theme.spacing.description':
    'Named spacing tokens as Tailwind class strings. Define container widths, section padding, gaps, and component spacing.',
  'docs.theme.shadows.title': 'shadows',
  'docs.theme.shadows.description':
    'Named shadow tokens as CSS box-shadow values. Each becomes a shadow-{name} utility.',
  'docs.theme.animations.title': 'animations',
  'docs.theme.animations.description':
    'Custom @keyframes animations with enabled flag, duration, timing function, iteration count, and keyframe definitions.',
  'docs.theme.breakpoints.title': 'breakpoints',
  'docs.theme.breakpoints.description':
    'Custom responsive breakpoints as pixel values. Each becomes a min-width media query for responsive utilities.',
  'docs.theme.borderRadius.title': 'borderRadius',
  'docs.theme.borderRadius.description':
    'Named border radius tokens as CSS values. Each becomes a rounded-{name} utility class.',
  'docs.theme.fonts.tip.title': 'Google Fonts',
  'docs.theme.fonts.tip.body':
    'Add a googleFontsUrl to automatically load custom fonts. The URL is injected as a <link> tag in the page head.',
  'docs.theme.advanced.title': 'Shadows, Animations & More',
  'docs.theme.advanced.description':
    'Additional design tokens for shadows, animations, responsive breakpoints, and border radius.',
  'docs.theme.fullExample.title': 'Full Example',
  'docs.theme.fullExample.description':
    'A complete theme configuration combining colors, fonts, spacing, and shadows.',
  'docs.theme.screenshot.alt': 'Sovrium app with custom theme applied',
  'docs.theme.screenshot.caption':
    'A CRM application rendered with custom theme colors, fonts, and spacing.',

  // ── Docs: Section 6 — Pages & Components ──────────────────────────
  'docs.pages.title': 'Pages & Components',
  'docs.pages.description':
    'Pages are server-rendered using a component tree system. Each page has a name, path, metadata (SEO, favicons), and sections containing nested components.',
  'docs.pages.structure.title': 'Page Structure',
  'docs.pages.structure.description':
    'Each page has a name, path, SEO metadata, and sections with nested components.',
  'docs.pages.componentTypes.title': '62 Component Types',
  'docs.pages.componentTypes.description':
    'Components form a recursive tree \u2014 each can have type, content, props, and children.',
  'docs.pages.componentTypes.layout': 'Layout',
  'docs.pages.componentTypes.typography': 'Typography & Text',
  'docs.pages.componentTypes.media': 'Media & Images',
  'docs.pages.componentTypes.interactive': 'Interactive & Navigation',
  'docs.pages.componentTypes.display': 'Cards & Display',
  'docs.pages.componentTypes.feedback': 'Feedback & Utilities',
  'docs.pages.componentTypes.layout.description':
    'Structural elements that control page layout, sections, and content flow.',
  'docs.pages.componentTypes.typography.description':
    'Text elements from headings to paragraphs, inline text, and code blocks.',
  'docs.pages.componentTypes.media.description':
    'Visual and multimedia elements for images, avatars, video, audio, and embeds.',
  'docs.pages.componentTypes.interactive.description':
    'Elements for user interaction including buttons, links, accordions, and navigation.',
  'docs.pages.interactions.title': 'Interactions',
  'docs.pages.interactions.description':
    'Components support 4 interaction types via the interactions property: hover (transform, opacity, scale, shadow changes), click (navigation, scroll, toggle), scroll (parallax, fade-in, sticky behavior), and entrance (animation on first view with delay and duration).',
  'docs.pages.interactions.hover.title': 'Hover',
  'docs.pages.interactions.hover.description':
    'Transform, opacity, scale, and shadow changes on mouse hover.',
  'docs.pages.interactions.click.title': 'Click',
  'docs.pages.interactions.click.description':
    'Navigate to a URL, scroll to an anchor, or toggle visibility.',
  'docs.pages.interactions.scroll.title': 'Scroll',
  'docs.pages.interactions.scroll.description':
    'Parallax effects, fade-in on scroll, and sticky positioning.',
  'docs.pages.interactions.entrance.title': 'Entrance',
  'docs.pages.interactions.entrance.description':
    'Animate when element first enters the viewport with configurable delay and duration.',
  'docs.pages.templates.title': 'Component Templates',
  'docs.pages.templates.description':
    'Define reusable components with $ref references and $variable substitution for DRY markup.',
  'docs.pages.screenshot.hero.alt': 'Hero section rendered by Sovrium',
  'docs.pages.screenshot.hero.caption':
    'A hero section with heading, description, and call-to-action buttons \u2014 all from YAML config.',
  'docs.pages.screenshot.features.alt': 'Features grid rendered by Sovrium',
  'docs.pages.screenshot.features.caption':
    'A 3-column features grid using section, grid, and card components with emoji icons.',

  // ── Docs: Section 7 — Authentication ──────────────────────────────
  'docs.auth.title': 'Authentication',
  'docs.auth.description':
    'Built-in authentication powered by Better Auth. Configure strategies, roles, two-factor authentication, and email templates.',
  'docs.auth.basic.title': 'Basic Setup',
  'docs.auth.basic.description':
    'Start with the simplest auth config \u2014 email and password with a default role.',
  'docs.auth.strategies.title': 'Strategies',
  'docs.auth.strategies.description':
    'email-password (default), magic-link (passwordless email), and OAuth providers (google, github, apple, microsoft, facebook, twitter, discord, spotify, twitch, gitlab, bitbucket, linkedin, dropbox).',
  'docs.auth.oauth.title': 'Adding OAuth',
  'docs.auth.oauth.description':
    'Add social login providers alongside email-password. Multiple strategies can coexist.',
  'docs.auth.oauth.warning.title': 'Environment variables required',
  'docs.auth.oauth.warning.body':
    'OAuth providers require AUTH_SECRET and provider-specific CLIENT_ID / CLIENT_SECRET environment variables.',
  'docs.auth.roles.title': 'Roles & Permissions',
  'docs.auth.roles.description':
    'Three built-in roles: admin, member, viewer. Define custom roles with name + description. Set defaultRole for new users. First user automatically becomes admin.',
  'docs.auth.roles.admin': 'Full access to all features, user management, and settings.',
  'docs.auth.roles.member': 'Can create, read, and update records. Cannot manage users.',
  'docs.auth.roles.viewer': 'Read-only access. Cannot create or modify records.',
  'docs.auth.twoFactor.title': 'Two-Factor Auth',
  'docs.auth.twoFactor.description':
    'Optional TOTP-based 2FA. Enable with twoFactor: true in the auth config. Users can set up authenticator apps.',
  'docs.auth.emails.title': 'Email Templates',
  'docs.auth.emails.description':
    'Customizable emails for verification, password reset, and magic link. Supports $name, $url, $email variable substitution in subject and body.',
  'docs.auth.emails.variables':
    'Available variables: $name (user name), $url (action link), $email (user email), $organizationName, $inviterName.',

  // ── Docs: Section 8 — Languages ───────────────────────────────────
  'docs.languages.title': 'Languages',
  'docs.languages.description':
    'Multi-language support with translation keys, browser language detection, and automatic URL-based language routing (/en/..., /fr/...). Reference translations in pages using the $t: prefix.',
  'docs.languages.defining.title': 'Defining Languages',
  'docs.languages.defining.description':
    'Set a default language and list supported languages with code, locale, label, and text direction.',
  'docs.languages.translations.title': 'Translation Keys',
  'docs.languages.translations.description':
    'Define key-value pairs for each language. Keys use dot notation for organization.',
  'docs.languages.usage.title': 'Using Translations',
  'docs.languages.usage.description':
    'Reference translations in any content or prop value with the $t: prefix.',
  'docs.languages.syntax.title': '$t: Translation Syntax',
  'docs.languages.syntax.description':
    'Use $t:key.path in any page content or prop value to reference a translation. Example: $t:hero.title resolves to "Welcome" in English and "Bienvenue" in French.',
  'docs.languages.adding.title': 'Adding a New Language',
  'docs.languages.adding.description':
    'Follow these steps to add a new language to your application.',
  'docs.languages.adding.step1.title': 'Add language entry',
  'docs.languages.adding.step1.description':
    'Add a new item to the supported array with code, locale, label, and direction.',
  'docs.languages.adding.step2.title': 'Add translations',
  'docs.languages.adding.step2.description':
    'Create a new translations section for the language code with all required keys.',
  'docs.languages.adding.step3.title': 'Test the language',
  'docs.languages.adding.step3.description':
    'Visit /[lang-code]/ in your browser to verify the new language renders correctly.',
  'docs.languages.screenshot.en.alt': 'English version of the app',
  'docs.languages.screenshot.en.caption': 'English \u2014 /en/',
  'docs.languages.screenshot.fr.alt': 'French version of the app',
  'docs.languages.screenshot.fr.caption': 'Fran\u00E7ais \u2014 /fr/',

  // ── Docs: Section 9 — Analytics ───────────────────────────────────
  'docs.analytics.title': 'Analytics',
  'docs.analytics.description':
    'Built-in, privacy-friendly analytics with no cookies, no external services, and full GDPR compliance. All data stays on your server.',
  'docs.analytics.quickEnable.title': 'Quick Enable',
  'docs.analytics.quickEnable.description':
    'Set analytics to true for sensible defaults \u2014 no configuration needed.',
  'docs.analytics.advanced.title': 'Advanced Configuration',
  'docs.analytics.advanced.description':
    'Fine-tune analytics behavior with retention, privacy, and session options.',
  'docs.analytics.props.retentionDays': 'Number of days to retain analytics data. Default: 90.',
  'docs.analytics.props.respectDoNotTrack':
    'When true, respects the browser Do Not Track setting. Default: true.',
  'docs.analytics.props.excludePaths':
    'Array of URL paths to exclude from tracking (e.g., /admin, /api).',
  'docs.analytics.props.sessionTimeout':
    'Session timeout in minutes. A new session starts after this idle period. Default: 30.',
  'docs.analytics.privacy.title': 'Privacy-first analytics',
  'docs.analytics.privacy.body':
    'Sovrium analytics are cookie-free, GDPR-compliant by default. All data stays on your server \u2014 no third-party services involved.',
  'docs.analytics.details':
    'When enabled, Sovrium injects a lightweight tracking script that records page views, sessions, referrers, and device information. Analytics data is collected at /api/analytics/collect and stored locally.',

  // ── Docs: Section 10 — Resources ──────────────────────────────────
  'docs.resources.title': 'Resources',
  'docs.resources.description': 'Additional references for working with the Sovrium schema.',
  'docs.resources.llmQuick.label': 'LLM Quick Reference',
  'docs.resources.llmQuick.description': 'Concise schema overview optimized for LLMs (~40 lines).',
  'docs.resources.llmFull.label': 'LLM Full Reference',
  'docs.resources.llmFull.description': 'Complete schema documentation for LLMs (~1700 lines).',
  'docs.resources.jsonSchema.label': 'JSON Schema',
  'docs.resources.jsonSchema.description':
    'Machine-readable JSON Schema (Draft-07) for validation and editor support.',
  'docs.resources.schemaExplorer.label': 'Schema Explorer',
  'docs.resources.schemaExplorer.description':
    'Interactive visual explorer for the Sovrium JSON Schema (json-schema.app).',
  'docs.resources.apiReference.label': 'API Reference',
  'docs.resources.apiReference.description':
    'Interactive documentation for all REST API endpoints (Scalar UI).',
  'docs.resources.github.label': 'GitHub Repository',
  'docs.resources.github.description': 'Source code, issues, and contribution guidelines.',
  'docs.resources.help.title': 'Need Help?',
  'docs.resources.help.description':
    'Found a bug, have a question, or want to request a feature? Open an issue on GitHub.',
  'docs.resources.help.link': 'Open an issue on GitHub \u2192',
}
