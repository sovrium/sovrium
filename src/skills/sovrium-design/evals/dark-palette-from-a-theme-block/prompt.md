---
name: dark-palette-from-a-theme-block
max_turns: 25
---

I copied this from an older Sovrium example into ~/apps/clinic/app.yaml and validate fails. Fix it, and add a dark palette where the coral stays coral but backgrounds go dark:

```yaml
theme:
  colors:
    primary: '#1b2a4a'
    coral: '#ff6f59'
    background: '#ffffff'
    surface: 'var(--color-background)'
```
