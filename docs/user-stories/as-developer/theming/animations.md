# Animations

> **Feature Area**: Theming - Animations & Transitions
> **Schema**: `src/domain/models/app/theme/animations/`
> **E2E Specs**: `specs/app/theme/animations/`

---

## Overview

Sovrium provides a comprehensive animation system for creating smooth, performant UI transitions. Animations can be defined as keyframes and applied to elements. The system supports configurable timing functions, durations, delays, and iteration counts.

---

## US-ANIMATIONS-001: Configure Keyframe Animations

**As a** developer,
**I want to** define keyframe animations,
**so that** I can create custom motion effects for UI elements.

### Configuration

```yaml
theme:
  animations:
    fadeIn:
      keyframes:
        from:
          opacity: '0'
        to:
          opacity: '1'
      duration: 300ms
      timing: ease-out
    slideInRight:
      keyframes:
        from:
          transform: 'translateX(100%)'
          opacity: '0'
        to:
          transform: 'translateX(0)'
          opacity: '1'
      duration: 400ms
      timing: ease-out
    bounce:
      keyframes:
        '0%, 100%':
          transform: 'translateY(0)'
        '50%':
          transform: 'translateY(-20px)'
      duration: 600ms
      timing: ease-in-out
      iteration: infinite
```

### Acceptance Criteria

| ID     | Criterion                                       | E2E Spec                   |
| ------ | ----------------------------------------------- | -------------------------- |
| AC-001 | Keyframe animation is generated                 | `APP-THEME-ANIMATIONS-001` |
| AC-002 | Animation duration is applied                   | `APP-THEME-ANIMATIONS-002` |
| AC-003 | Animation timing function is applied            | `APP-THEME-ANIMATIONS-003` |
| AC-004 | Animation delay is supported                    | `APP-THEME-ANIMATIONS-004` |
| AC-005 | Infinite iteration is supported                 | `APP-THEME-ANIMATIONS-005` |
| AC-006 | Custom iteration count is supported             | `APP-THEME-ANIMATIONS-006` |
| AC-007 | Animation direction is configurable             | `APP-THEME-ANIMATIONS-007` |
| AC-008 | Animation fill mode is configurable             | `APP-THEME-ANIMATIONS-008` |
| AC-009 | Multiple keyframe stops are supported           | `APP-THEME-ANIMATIONS-009` |
| AC-010 | Percentage keyframe stops work                  | `APP-THEME-ANIMATIONS-010` |
| AC-011 | From/to syntax works                            | `APP-THEME-ANIMATIONS-011` |
| AC-012 | Animation generates utility class               | `APP-THEME-ANIMATIONS-012` |
| AC-013 | Invalid keyframe returns validation error       | `APP-THEME-ANIMATIONS-013` |
| AC-014 | Animation name must be unique                   | `APP-THEME-ANIMATIONS-014` |
| AC-015 | Animation supports transform property           | `APP-THEME-ANIMATIONS-015` |
| AC-016 | Animation supports opacity property             | `APP-THEME-ANIMATIONS-016` |
| AC-017 | Animation supports scale property               | `APP-THEME-ANIMATIONS-017` |
| AC-018 | Animation supports rotate property              | `APP-THEME-ANIMATIONS-018` |
| AC-019 | Animation is paused when prefers-reduced-motion | `APP-THEME-ANIMATIONS-019` |
| AC-020 | Animation generates CSS variables               | `APP-THEME-ANIMATIONS-020` |
| AC-021 | Default timing functions are available          | `APP-THEME-ANIMATIONS-021` |
| AC-022 | Cubic-bezier timing is supported                | `APP-THEME-ANIMATIONS-022` |
| AC-023 | Spring-based timing is supported                | `APP-THEME-ANIMATIONS-023` |

### Implementation References

- **Schema**: `src/domain/models/app/theme/animations.ts`
- **E2E Spec**: `specs/app/theme/animations/animations.spec.ts`

---

## Regression Tests

| Spec ID                           | Workflow                               | Status |
| --------------------------------- | -------------------------------------- | ------ |
| `APP-THEME-ANIMATIONS-REGRESSION` | Developer creates smooth UI animations | `[x]`  |

---

## Coverage Summary

| User Story        | Title      | Spec Count            | Status   |
| ----------------- | ---------- | --------------------- | -------- |
| US-ANIMATIONS-001 | Animations | 23                    | Complete |
| **Total**         |            | **23 + 1 regression** |          |
