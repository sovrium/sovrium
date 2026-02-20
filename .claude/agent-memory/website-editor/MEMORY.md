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

## Component Conventions
- Pages are TypeScript exports of type `Page` from `@/index`
- Sections use declarative JSON component trees (type, props, children, content)
- i18n via `$t:key` references in content/props, translations in `app.ts`
- CSS compiled programmatically from `src/infrastructure/css/compiler.ts`

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
