# Stepper

> The `stepper` component — one task split into ordered steps, each step's body any component.

One task split into ordered steps. `steps[i]` names the step that shows `children[i]`, exactly as a tab set's `panels[i]` names its panel, so a step's body is any component — a form, a picker, a block.

<!-- sovrium:options type:stepper -->

The rail runs across the top, or down the side with `orientation: vertical`; past five steps, and on a phone, it compacts to "Step 2 of 4" over a progress bar. With `linear` (the default) Continue is the only way forward and a step is left only once its body is valid — a step whose body is a form waits for that form's validation. A step marked `optional` adds a Skip. The current step is kept in the address as `?step=<id>`, so a reload lands where the reader was and Back walks the steps. The last step's button reads `finishLabel` ("Finish" by default) and runs `onFinish`.

On the rail a step already done shows its number in a filled disc, the current step is bold with its number ringed, and a step still to come stays plain. The rail is an ordered list with the current step marked `aria-current="step"`, and moving to a step puts focus on its heading.
