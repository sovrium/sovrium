# Accessibility gates

These are gates, not suggestions: a page that fails one is not done. They follow WCAG 2.2 at
level AA (W3C Recommendation, 2024-12-12) and the WAI-ARIA Authoring Practices Guide (APG)
keyboard patterns. Sovrium's interactive components are built on headless primitives that implement ARIA roles; the
agent's job is to configure them so the result still passes, and to verify it by using the page.

## Contents

- [Contrast](#contrast)
- [Focus](#focus)
- [Targets](#targets)
- [Forms and input](#forms-and-input)
- [Structure and names](#structure-and-names)
- [Keyboard behaviour by pattern](#keyboard-behaviour-by-pattern)
- [Motion and time](#motion-and-time)
- [Interact, do not only screenshot](#interact-do-not-only-screenshot)
- [Gate checklist](#gate-checklist)

## Contrast

- Body text and labels: at least **4.5:1** against their background (WCAG 1.4.3).
- Large text (roughly 24 px regular, or 18.66 px bold, and above): at least **3:1**.
- Non-text elements the visitor needs to perceive — input borders, focus indicators, icons that carry meaning, chart marks, the selected state of a control — at least **3:1** against adjacent colours (WCAG 1.4.11).
- Check both schemes. A pair that passes in light often fails in dark.
- Placeholder text and disabled-looking hints are still text; if the visitor needs to read them, they meet 4.5:1.
- Never convey meaning by colour alone: pair it with text, an icon or a pattern.
- Author-declared data colours render as fills with a derived foreground; the agent still checks that a chip reads against its surface.

## Focus

- Every interactive element shows a visible focus indicator when reached by keyboard (WCAG 2.4.7). Never remove the focus outline without replacing it.
- The focused element is never entirely hidden by other content — sticky headers, footers, cookie banners, chat launchers (WCAG 2.4.11). Reserve scroll padding for sticky chrome.
- Focus order follows reading order. Do not reorder visually with layout tricks that leave the DOM order different.
- Opening a dialog moves focus into it; closing it returns focus to the control that opened it.
- After a failed form submit, focus moves to the error summary or the first invalid field.

## Targets

- Pointer targets are at least **24 × 24 CSS px**, or have enough spacing that a 24 px circle around each does not overlap another (WCAG 2.5.8, the AA minimum).
- Aim for **44–48 px** on touch-primary surfaces and primary actions; 48 dp is Material's comfortable touch target.
- Inline links inside a sentence are exempt from the size rule, but not from being distinguishable.
- Icon-only buttons still meet the target size; the icon may be smaller than its hit area.

## Forms and input

- Every input has a visible label, and instructions where the format is not obvious (WCAG 3.3.2). A placeholder is not a label.
- Inputs that collect personal data carry the right `autocomplete` value (name, email, tel, street-address, postal-code, current-password, new-password, one-time-code and so on) so browsers and assistive technology can fill them (WCAG 1.3.5).
- Do not ask for information the visitor already gave in the same flow; carry it forward or let them select it (WCAG 3.3.7, redundant entry).
- Sign-in does not depend on a cognitive test — no transcribing codes by hand, no puzzles — unless an alternative exists; allow paste and password managers (WCAG 3.3.8, accessible authentication).
- Error messages identify the field and describe the problem in text (see `states-and-forms.md`).
- Required state is exposed to assistive technology, not only drawn as an asterisk.

## Structure and names

- One `h1` per page; headings nested without skipped levels.
- Landmarks: one main region, navigation marked as navigation, and a way to skip repeated navigation.
- Every image that conveys information has alternative text that says what it shows; decorative images have empty alternative text.
- Every icon-only control has an accessible name that says what it does ("Close", "Delete row"), not what it looks like.
- Link text makes sense out of context; several links with the same text go to the same place.
- Tables use header cells for their headers, and a caption or a heading that names them.
- The page declares its language, and passages in another language declare theirs.

## Keyboard behaviour by pattern

Each interactive component implements one APG pattern. Verify the keys the pattern promises, on
the rendered page:

| Pattern        | Typical Sovrium components                                             | Keys to verify                                                                                              |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Dialog (modal) | `dialog`, `drawer`                                                     | Focus moves in; Tab cycles inside; Escape closes; focus returns to the trigger                              |
| Alert dialog   | `alert-dialog`                                                         | As dialog; focus starts on the least destructive action; the dialog cannot be dismissed by clicking outside |
| Menu button    | `dropdown-menu`, `context-menu`, `menubar`                             | Enter, Space or Down opens; arrows move; Escape closes and returns focus; typing a letter jumps             |
| Tabs           | `tabs`                                                                 | Arrows move between tabs; Tab moves into the panel; Home and End reach the ends                             |
| Combobox       | `select` with search, `command-palette`, `record-picker`, date pickers | Typing filters; arrows move the active option; Enter selects; Escape closes without selecting               |
| Listbox        | `select`, `reorderable-list`                                           | Arrows move; Space or Enter selects; multi-select supports Shift and Ctrl/Cmd modifiers where offered       |
| Grid           | `table` with cell navigation, `calendar`                               | Arrows move cell to cell; Enter edits or activates; Escape leaves edit mode; Tab leaves the grid            |
| Disclosure     | `accordion`, collapsible sections                                      | Enter or Space toggles; the expanded state is announced                                                     |
| Radio group    | `radio-group`, `toggle-group`                                          | Tab enters the group once; arrows move the choice                                                           |
| Tooltip        | `tooltip`, `hover-card`                                                | Appears on focus as well as hover; Escape dismisses; never holds the only copy of essential information     |

Component options and behaviour: `sovrium docs components/overlay-components`,
`sovrium docs components/navigation-components`, `sovrium docs form-controls/form-controls`,
`sovrium docs data-components/data-components-grid-editing`.

## Motion and time

- Honour `prefers-reduced-motion` (see `anti-slop.md`).
- Nothing flashes more than three times per second.
- A toast that carries information the visitor must act on stays until dismissed; auto-dismiss is for confirmations only.
- A session timeout warns before it expires and offers to extend.

## Interact, do not only screenshot

Judging accessibility or usability from a static screenshot is unreliable, for people and more
so for models. The agent verifies by using the page:

- Tab through the whole page from the address bar; record where focus goes and whether it is always visible.
- Open and close every overlay with the keyboard only.
- Trigger every empty and error state (clear data, submit an empty form, search for nonsense).
- Read the accessibility tree (a browser MCP snapshot) for names, roles and states, not only the pixels.
- Check at 200 % zoom and at the narrowest width that nothing is cut off or overlaps.

## Gate checklist

- [ ] Text contrast ≥ 4.5:1 (large ≥ 3:1), in light and dark.
- [ ] Non-text contrast ≥ 3:1 for borders, focus rings, meaningful icons, chart marks.
- [ ] Visible focus on every interactive element; never hidden behind sticky chrome.
- [ ] Targets ≥ 24 × 24 px (≥ 44 px for primary touch actions).
- [ ] Every input: visible label, instructions where needed, correct `autocomplete`.
- [ ] No redundant entry; sign-in allows paste and password managers.
- [ ] One `h1`, no skipped heading levels, landmarks present.
- [ ] Every meaningful image and icon-only control has an accessible name.
- [ ] Each interactive component passes the keys its APG pattern promises.
- [ ] Reduced-motion preference respected.
