# Stepper

> The `stepper` component — one task split into ordered steps, each step's body any component.

One task split into ordered steps. `steps[i]` names the step that shows `children[i]`, exactly as a tab set's `panels[i]` names its panel, so a step's body is any component — a form, a picker, a block.

<!-- sovrium:options type:stepper -->

The rail runs across the top, or down the side with `orientation: vertical`; past five steps, and on a phone, it compacts to "Step 2 of 4" over a progress bar. With `linear` (the default) Continue is the only way forward and a step is left only once its body is valid — a step whose body is a form waits for that form's validation. A step marked `optional` adds a Skip. The current step is kept in the address as `?step=<id>`, so a reload lands where the reader was and Back walks the steps. The last step's button reads `finishLabel` ("Finish" by default) and runs `onFinish`.

On the rail a step already done and the current step are both filled in the primary colour — the done one showing a check, the current one its number — and a step still to come stays plain, its number on the page background. The rule between two steps turns to the primary colour once the reader has passed it. Back and Skip are outline buttons; Continue and the finish button are the default button. The rail is an ordered list with the current step marked `aria-current="step"`, and moving to a step puts focus on its heading. There is no shadcn/ui counterpart: the stepper is drawn in shadcn/ui's colour roles and Button, and each part carries a `data-slot` name — `stepper`, `stepper-list`, `stepper-item`, `stepper-indicator`, `stepper-title`, `stepper-description`, `stepper-separator`, `stepper-content` and `stepper-actions`.
