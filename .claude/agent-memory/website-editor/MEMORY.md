# Website Editor Memory

## Website Structure
- Entry: `website/start.ts` (dev server), `website/build.ts` (static build)
- App config: `website/app.ts` (theme, languages, translations, pages)
- Pages: `website/pages/*.ts` (declarative component trees)
- Static assets: `website/assets/` (served via `publicDir`)
- Logos dir: `website/assets/logos/`
- Server runs on port 3000 (`bun website` or `bun run website/start.ts`)

## Brand Charter
- Color scheme: sovereignty-dark, sovereignty-darker, sovereignty-accent, sovereignty-teal
- Gradient: `from-sovereignty-accent to-sovereignty-teal` for accents
- Text: sovereignty-light, sovereignty-gray-300/400/500 for hierarchy
- Cards: sovereignty-gray-900 bg, sovereignty-gray-800 border, hover:sovereignty-accent border
- **Sections added (2026-02-20)**: Design Philosophy, Spacing & Whitespace, Transitions & Animation, Design Excellence Checklist
- Sidebar now has 11 links (added: design-philosophy, spacing, transitions)

## Apple Design Grade Standards (CRITICAL)
- **Every page must feel premium**: generous whitespace, clean typography, smooth transitions, purposeful color
- **Spacing**: 96-120px between sections (desktop), 48-64px (mobile); 32-48px heading-to-content gap
- **Transitions**: Links 150ms, Buttons 200ms, Cards 300ms, Navigation 300ms; always ease-out; max 400ms
- **Color restraint**: accent blue sparingly (CTAs/links only); never >2 accent colors per viewport
- **Typography hierarchy**: exactly 3-4 contrast levels per section (light, gray-300, gray-400, gray-500)
- **Anti-patterns**: no cluttered sections, no inconsistent border-radius, no decoration without purpose
- **Quality bar**: "A designer should find nothing to criticize"

## Component Conventions
- Pages are TypeScript exports of type `Page` from `@/index`
- Sections use declarative JSON component trees (type, props, children, content)
- i18n via `$t:key` references in content/props, translations in `app.ts`
- CSS compiled programmatically from `src/infrastructure/css/compiler.ts`

## customHTML SSR Incompatibility (CRITICAL)
- `customHTML` component type uses `DOMPurify.sanitize()` which is **browser-only**
- Using `customHTML` in website pages causes `TypeError: DOMPurify.sanitize is not a function` during SSR
- **NEVER use `customHTML` type in website pages** -- use native schema types instead
- For buttons with complex inner structure: use `button` type with `span` children
- For SVG-like elements: use CSS-styled `span` elements (e.g., hamburger bars with `bg-current`)

## Responsive Navbar
- Navbar shared via `website/pages/navbar.ts` (imported by all pages)
- Desktop: `hidden md:flex` on nav links container
- Mobile: hamburger button (`button` type, `id="mobile-menu-btn"`) with Lucide `menu`/`x` icons
- Mobile menu: `div` with `id="mobile-menu"`, absolute overlay (not in-flow), animated via `maxHeight`
- Section has `relative`, mobile menu has `absolute top-full left-0 w-full z-50` to overlay content
- Scripts: `mobileMenuScript` + `langSwitchScript` in every page's `scripts.inlineScripts`
- Icon toggle: JS swaps `display:none/block` between `#mobile-menu-icon` and `#mobile-close-icon`

## Base Button Style Override (RESOLVED 2026-02-23)
- **FIXED**: Bare `button` type selector was REMOVED from `@layer components` in `component-layer-generators.ts`
- Now only `.btn` class selector exists in components layer (no global `<button>` styling)
- `COMPONENT_TYPE_CLASS_MAP` in `style-processor.ts` maps `button` -> `btn` so button-type components auto-get `.btn` class
- For non-CTA buttons: add `bg-transparent hover:bg-<color> p-0` to override `.btn` base styles
- Utilities (`@layer utilities`) always beat components (`@layer components`) in Tailwind v4 cascade
- The `.btn` class provides: `inline-flex items-center justify-center rounded-md px-4 py-2 font-medium transition-colors bg-blue-600 text-white`

## Animation Name Gotcha (CRITICAL)
- `parseStyle()` in `src/presentation/styling/parse-style.ts` converts camelCase animation names to kebab-case via `normalizeAnimationValue()`
- `generateKeyframes()` in `src/infrastructure/css/styles/animation-styles-generator.ts` uses config key AS-IS
- FIX: Use all-lowercase single-word names (e.g., `marqueescroll` not `marqueeScroll`) so kebab-case conversion has no effect
- camelCase names like `marqueeScroll` become `marquee-scroll` in inline styles but stay `marqueeScroll` in CSS = MISMATCH

## Partners Page
- 10 client logos in marquee (infinite scroll) layout
- Logos: escp, tablecana, th1, maitrescuisiniers, agorastore, dunseulgeste, capitalpv, lebeausourire, 1492, edl
- Animation: `marqueescroll` keyframes in `app.ts` theme.animations (enabled:false = keyframes only)
- Marquee: duplicated logos array, CSS mask-image gradient for fade edges, 35s linear infinite
