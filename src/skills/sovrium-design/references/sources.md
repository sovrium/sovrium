# Sources

The public sources this skill learned from, and the Sovrium decisions it states. Each entry: tag, title — organisation or author — URL — what was taken. URLs answered on 2026-10-24. Nothing is copied: every source keeps its own licence, and this skill is written in its own words from the Sovrium manual and schema. Sovrium's design decisions are not shipped as documents; each entry names the manual article where its consequences are stated.

## Contents

- Skills and authoring (S1–S4, S11)
- Design systems and tokens (S5–S7, S12)
- Accessibility and preferences (S8, S13, S15, S16, S19)
- Dark mode, voice and tone (S9, S10, S14, S17)
- Sovrium decisions (S18, S20–S22)

## Skills and authoring

- **S1 Agent Skills best practices** — Anthropic — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices. Taken: description as what plus when, a concise body, one level of references, a copyable checklist with a validate → fix loop, evals first.
- **S2 `frontend-design` skill** — Anthropic — https://github.com/anthropics/skills (Apache-2.0). Taken: ground the design in the subject's world, plan a compact token system before building, critique the plan against generic defaults and record what changed, spend boldness once, the brief wins, a quality floor of responsive, visible focus, reduced motion and contrast.
- **S3 `brand-guidelines` and `theme-factory` skills** — Anthropic — https://github.com/anthropics/skills. Taken: a brand expressed as a small named token set (a palette with roles, a pair of faces) applied consistently, rather than per artefact.
- **S4 Equipping agents for the real world with Agent Skills** — Anthropic engineering — https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills. Taken: progressive disclosure, a skill that names its neighbours.
- **S11 `web-design-guidelines` skill** — Vercel — https://github.com/vercel-labs/agent-skills (MIT). Taken: review rules phrased as checks with an id, the tells of generated interfaces.

## Design systems and tokens

- **S5 Theming** — shadcn/ui — https://ui.shadcn.com/docs/theming. Taken: colour roles as background and foreground pairs, the role names the shipped components read.
- **S6 Design Tokens Format Module 2025.10** — W3C Design Tokens Community Group — https://www.designtokens.org/tr/2025.10/format/. Taken: what a portable token is, types, and the reserved extensions field.
- **S7 Theme variables** — Tailwind CSS — https://tailwindcss.com/docs/theme. Taken: a token name becoming the suffix of a utility.
- **S12 OKLCH in CSS: why we moved from RGB and HSL** — Evil Martians — https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl. Taken: retuning a ramp by lightness without hue drift.

## Accessibility and preferences

- **S8 WCAG 2.2, Focus Visible and Focus Appearance** — W3C — https://www.w3.org/TR/WCAG22/. Cited by criterion (2.4.7, 2.4.13); wording not reproduced.
- **S13 WCAG 2.2, Contrast (Minimum) and Non-text Contrast** — W3C — https://www.w3.org/TR/WCAG22/. Cited by criterion (1.4.3, 1.4.11).
- **S15 prefers-reduced-motion** — MDN — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion. Taken: every movement has a reduced answer.
- **S16 Best practices for fonts** — web.dev — https://web.dev/articles/font-best-practices. Taken: a fallback stack so a late font swaps the face, not the layout; request only the weights used.
- **S19 prefers-color-scheme** — MDN — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme. Taken: following the system scheme by default, a stored choice winning.

## Dark mode, voice and tone

- **S9 Dark theme** — Material Design 2 — https://m2.material.io/design/color/dark-theme.html (CC BY 4.0). Taken: desaturated accents at night, elevation as a lighter surface, avoiding pure black.
- **S10 Utopia** — Clearleft — https://utopia.fyi/. Taken: type and space as related scales rather than one-off values.
- **S14 Voice and tone** — Mailchimp Content Style Guide — https://styleguide.mailchimp.com/voice-and-tone/. Paraphrased: a constant voice, a tone that shifts with the moment.
- **S17 The four dimensions of tone of voice** — Nielsen Norman Group — https://www.nngroup.com/articles/tone-of-voice-dimensions/. Paraphrased: tone as positions on a few named dimensions, the basis of the voice chart.

## Sovrium decisions

- **S18 shadcn/ui is the design system** — Sovrium. Not shipped; consequences in `sovrium docs components/components-overview` and `sovrium docs theming/design-components`.
- **S20 The `theme` key is removed; every token category is a direct key of `design`** — Sovrium. Not shipped; consequences in `sovrium docs theming/theme` and `sovrium docs theming/design`.
- **S21 A colour value is exactly one colour; `oklch()` is admitted, references are refused** — Sovrium. Not shipped; consequences in `sovrium docs theming/design-components`.
- **S22 Eco posture is the operator's, in the environment, never in the app schema** — Sovrium. Not shipped; consequences in `sovrium docs operations/ecoconception`.
