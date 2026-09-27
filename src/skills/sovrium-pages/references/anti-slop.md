# Anti-slop: the defaults to refuse

Generated interfaces converge on the same handful of choices, because each is the most likely
continuation of "make it look modern". Visitors now recognise the pattern and read it as
"nobody designed this". This file lists those tells, why each fails, and what to reach for
instead. The alternative is almost always type, rhythm and copy, not a different ornament.

## Contents

- [How to use this list](#how-to-use-this-list)
- [Visual tells](#visual-tells)
- [Layout tells](#layout-tells)
- [Type tells](#type-tells)
- [Copy tells](#copy-tells)
- [Motion](#motion)
- [When the page still feels unfinished](#when-the-page-still-feels-unfinished)

## How to use this list

- Scan the plan (`design-plan.md`) against this list before building, and the rendered page after.
- A tell the app's own `design` block asks for is not a tell. If the author's principles call for a gradient, the gradient stays. This list governs the agent's defaults, not the author's choices.
- Removing a tell is a refine-mode change; it does not license a redesign.

## Visual tells

| Refuse                                                                    | Why it fails                                                               | Do instead                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Purple-to-blue (or any two-hue) gradients on backgrounds, buttons or text | The single most recognised generated look; colour that means nothing       | A flat surface from the app's colour roles; spend colour only where it carries meaning |
| Glassmorphism: frosted translucent panels over blurred backgrounds        | Low contrast, expensive to render, legibility depends on what is behind    | Opaque surfaces with a clear border or a one-step surface change                       |
| Cards nested inside cards                                                 | Borders multiply, spacing doubles, hierarchy flattens                      | One container level; group inside it with spacing and headings                         |
| Grey text on a coloured fill                                              | Fails contrast and looks washed out                                        | The foreground colour the role is paired with                                          |
| A rounded icon tile above every heading                                   | Decoration standing in for hierarchy; every section looks the same         | Let the heading carry the section; use an icon only where it helps recognition         |
| Uniform large radii on everything                                         | Nothing reads as more or less important; everything looks like a toy       | The app's radius ladder: small on controls, larger only on surfaces that need it       |
| Dark glows, neon outlines and coloured shadows                            | Ornament that fails in light mode and on print                             | The app's elevation tokens; in dark mode, a lighter surface                            |
| Dark-only themes                                                          | Harder to read for most people in most conditions; hides contrast problems | Light default, dark as a checked alternative (`states-and-forms.md`)                   |
| Stock 3D blobs and abstract gradient art                                  | Filler imagery that says nothing about the product                         | A real screenshot, a real record, or no image                                          |
| Emoji in headings and buttons                                             | Consumer register; inconsistent rendering across platforms                 | Words; an icon from the app's one icon set if an icon is needed                        |

## Layout tells

| Refuse                                                                                                 | Why it fails                                                                     | Do instead                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The template: hero, then three feature cards with icons, then testimonials, then a call-to-action band | The layout every generator produces; it signals "template" before a word is read | Start from the visitor's one job; show the product doing it; order sections by what the visitor needs next |
| Centring everything                                                                                    | Long centred text is hard to read; every block competes equally                  | Left-align body text and forms; centre only short, isolated elements                                       |
| Equal-weight grids of identical cards                                                                  | No entry point; the eye has nowhere to start                                     | Vary size and weight by importance; one lead item                                                          |
| Full-width everything                                                                                  | Lines far past a readable measure                                                | A readable max width for text; full width only for media and data                                          |
| Decorative sections that exist to fill the page                                                        | Scrolling cost with no information                                               | Delete the section                                                                                         |
| Sticky headers that cover focused content                                                              | Keyboard users lose the focused element                                          | Reserve scroll padding for the header, or do not make it sticky                                            |

## Type tells

| Refuse                                                              | Why it fails                               | Do instead                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Inter, Arial or the system default for everything, chosen by nobody | The absence of a decision                  | The families in the app's `design.typeScale`; if none is declared, the platform default as-is |
| Three or more families                                              | Noise; weakens the hierarchy               | One or two families (`design-plan.md`)                                                        |
| Hierarchy by size alone, with huge headings                         | Shouting; wastes the first screen          | Weight and colour role first, then size, on the app's scale                                   |
| All-caps labels and tracking everywhere                             | Slower to read; loses word shapes          | Sentence case; caps only for short metadata if the app's scale defines it                     |
| Off-scale sizes on one component                                    | Breaks the rhythm the scale exists to keep | A step from the scale                                                                         |

## Copy tells

| Refuse                                                                         | Why it fails                                                  | Do instead                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| "Unlock", "seamless", "powerful", "supercharge", "revolutionise", "effortless" | Hype words that every generated page uses; they claim nothing | A specific benefit with a number or an example                                     |
| "Welcome to <app>!" as the main heading                                        | Wastes the most valuable line                                 | What the visitor can do here, in their words                                       |
| Title Case Headings                                                            | Harder to scan; reads as marketing                            | Sentence case                                                                      |
| Exclamation marks and celebration on success                                   | Undercuts trust in a work tool                                | A plain confirmation (`copy.md`)                                                   |
| "Lorem ipsum" or invented statistics and testimonials                          | Fabricated proof; ships by accident                           | Real content from the app, or a clearly marked placeholder the author must replace |

## Motion

Motion explains a change of state. It is never decoration. "No motion" is a valid and often the
best answer.

- Animate only to show where something came from or went: a panel opening, a row inserted, an item removed.
- Enter and exit with an ease-out curve: fast start, gentle stop. Avoid ease-in for anything the visitor triggered; it feels sluggish.
- Keep interface transitions under 300 ms; small elements (a tooltip, a menu) nearer 150 ms.
- Animate only `transform` and `opacity`. Animating width, height, top or left causes layout work and jank.
- No bounce, elastic or spring overshoot on work surfaces; it reads as playful and slows repeated use.
- No motion on page load for its own sake; content appears, it does not perform.
- Respect `prefers-reduced-motion`: replace movement with an instant change or a short fade.
- Never animate something the visitor does hundreds of times a day (typing, selecting a row).
- Use the app's motion tokens (`design.motion`) for durations and easings, never literal values: `sovrium docs theming/animations`.

## When the page still feels unfinished

The urge is to add a gradient, a shadow or an illustration. Resist it and work through these, in
order:

1. **Hierarchy**: is there exactly one primary element and one primary action? Demote the rest.
2. **Type**: are the five roles mapped to the scale, with weight doing most of the work?
3. **Rhythm**: is space between groups clearly larger than space within them, all on the ladder?
4. **Alignment**: do edges line up on a few shared vertical lines?
5. **Copy**: is every heading specific, every button a verb, every state a next action?
6. **Content**: is the page showing real content, or describing content that is not there?

If all six hold and it still feels unfinished, it is usually finished. Restraint executed well
reads as calm; the agent should not mistake calm for missing.
