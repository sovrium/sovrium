---
type: llm
weight: 2
criteria: |
  The answer (1) declares the coral as a named token in design.colors instead of repeating a hex value, (2) styles every button once with design.components.button (parts.root, and states.hover written WITHOUT a hover: prefix) instead of per-instance className, (3) styles the sidebar's current link through a states.current entry on the sidebar's link part rather than an arbitrary descendant selector, (4) removes or does not add the per-button className strings, and (5) runs sovrium validate and checks the result in the browser, including that keyboard focus stays visible.
---

The answer (1) declares the coral as a named token in design.colors instead of repeating a hex value, (2) styles every button once with design.components.button (parts.root, and states.hover written WITHOUT a hover: prefix) instead of per-instance className, (3) styles the sidebar's current link through a states.current entry on the sidebar's link part rather than an arbitrary descendant selector, (4) removes or does not add the per-button className strings, and (5) runs sovrium validate and checks the result in the browser, including that keyboard focus stays visible.
