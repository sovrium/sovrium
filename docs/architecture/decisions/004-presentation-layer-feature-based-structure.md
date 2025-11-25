# ADR-001: Presentation Layer Feature-Based Structure

**Status**: Accepted
**Date**: 2025-11-10
**Decision Makers**: Development Team, Claude Code
**Context**: Folder structure refactoring after ESLint cleanup (41 warnings → 0)

---

## Context and Problem Statement

After completing a major ESLint refactoring that reduced complexity from 41 warnings to 0, the `src/presentation/` directory contained 52 utility files scattered across 4 different `utils/` directories:

- `src/presentation/utils/` (20 files, 1,398 lines) - Mixed concerns
- `src/presentation/components/sections/utils/` (20 files, 2,042 lines) - Largest concentration
- `src/presentation/components/pages/utils/` (10 files, 875 lines) - Page building blocks
- `src/presentation/components/metadata/utils/` (2 files, ~150 lines) - Too small for separate directory

**Issues identified**:

1. **Poor discoverability**: Related files scattered across multiple `utils/` directories
2. **Cognitive overload**: `sections/utils/` had 20 files with mixed concerns (props, styling, rendering, translations)
3. **Deep nesting**: 3-4 directory levels making navigation difficult
4. **Lack of cohesion**: Generic `utils/` name doesn't convey purpose
5. **Duplication**: `animation-composer.ts` existed in both `/utils/` and `/sections/utils/`
6. **Unclear abstractions**: High-level rendering next to low-level string utilities

## Decision Drivers

1. **Maintainability**: Code should be easy to find and understand
2. **Scalability**: Structure should accommodate future growth without requiring another restructuring
3. **Developer Experience**: Reduce cognitive load when navigating codebase
4. **Separation of Concerns**: Group related functionality together
5. **Layer Architecture Compliance**: Maintain Presentation → Application → Domain ← Infrastructure dependency direction

## Considered Options

### Option 1: Keep Current Structure (Minimal Changes)

**Approach**: Only fix duplication and consolidate `animation-composer.ts`

**Pros**:

- Minimal disruption
- No breaking changes
- Quick to implement

**Cons**:

- Doesn't address root cause (poor organization)
- Technical debt continues to accumulate
- Developer experience remains poor
- Hard to scale as codebase grows

**Verdict**: ❌ Not recommended - Kicks the can down the road

### Option 2: Flatten Everything

**Approach**: Remove all subdirectories, put all 146 files directly in `presentation/`

**Pros**:

- Simple structure
- No deep nesting
- Easy imports

**Cons**:

- Cognitive overload (146 files in one directory)
- No logical grouping
- Difficult to navigate
- Violates separation of concerns

**Verdict**: ❌ Not recommended - Trades one problem for another

### Option 3: Component-Centric Organization

**Approach**: Organize by component type (pages/, sections/, metadata/) with utils/ under each

**Structure**:

```
components/
├── pages/
│   ├── components/
│   └── utils/
├── sections/
│   ├── components/
│   └── utils/
└── metadata/
    ├── components/
    └── utils/
```

**Pros**:

- Co-locates component-specific utilities
- Clear component boundaries
- Good for component-focused development

**Cons**:

- Duplicates cross-cutting concerns (theming, styling)
- Doesn't address presentation-level utilities
- Still has deep nesting issues

**Verdict**: ⚠️ Partial solution - Good for component-specific code, but doesn't solve presentation-level organization

### Option 4: Feature-Based Organization (SELECTED)

**Approach**: Feature-based at presentation level, component-centric within components/

**Structure**:

```
src/presentation/
├── rendering/          # High-level page rendering
├── styling/            # Styling utilities (cn, colors, variants, animation)
├── theming/            # Theme system (generators, orchestration)
├── translations/       # Translation resolution
├── utilities/          # Generic low-level utilities
├── scripts/            # Client-side script utilities
├── components/
│   ├── ui/             # shadcn/ui components (unchanged)
│   ├── layout/         # Layout components (unchanged)
│   ├── languages/      # Language switcher (unchanged)
│   ├── metadata/       # Metadata builders (utils promoted)
│   ├── pages/          # Page components (utils promoted)
│   └── sections/       # Section rendering
│       ├── blocks/     # Block system
│       ├── props/      # Props building
│       ├── rendering/  # Component rendering
│       ├── styling/    # Component styling
│       └── translations/ # Component translations
```

**Pros**:

- Best of both worlds (feature-based + component-centric)
- Clear separation of concerns
- Scalable and maintainable
- Logical grouping at all levels
- Reduces directory nesting (4 → 2-3 levels)
- 5-7 files per directory (optimal cognitive load)

**Cons**:

- More upfront work to migrate
- Requires team buy-in
- Breaking changes during migration

**Verdict**: ✅ **SELECTED** - Balances short-term cost with long-term benefits

## Decision Outcome

**Chosen option**: Feature-Based Organization (Option 4)

### Implementation Summary

**Phase 1: Preparation**

- Audited `animation-composer.ts` duplication (found duplicate in `sections/utils/`)
- Created new directory structure with placeholder `index.ts` files
- Documented comprehensive import mapping (`.github/IMPORT_MAPPING.md`)

**Phase 2: File Movement** (8 levels, dependency order)

1. **Level 1**: String utilities → `utilities/`
2. **Level 2**: Styling utilities → `styling/`
3. **Level 3**: Theme system → `theming/`
4. **Level 4**: High-level rendering → `rendering/`
5. **Level 5**: Translations and scripts → `translations/`, `scripts/`
6. **Level 6**: Restructure `sections/utils/` → 5 feature directories
7. **Level 7**: Promote `pages/utils/` and `metadata/utils/` to parent
8. **Level 8**: Delete empty `utils/` directories

**Phase 3: Import Updates**

- Updated 78+ files with new import paths
- Fixed relative imports within sections/ directories
- Used automated script (`scripts/update-imports.sh`) for bulk replacements

**Phase 4: Validation**

- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors, 4 warnings (acceptable - promoted components)
- ✅ Unit Tests: 1,393/1,393 passing

**Phase 5: Documentation**

- Created ADR (this document)
- Updated import mapping reference

### Positive Consequences

1. **Improved Discoverability**: Feature-based organization makes files easy to find
   - Styling-related files in `styling/`
   - Theme-related files in `theming/`
   - Translation-related files in `translations/`

2. **Better Separation of Concerns**: Clear boundaries between features
   - Low-level utilities (`utilities/`) separated from high-level rendering (`rendering/`)
   - Component-specific logic grouped by concern (props, styling, rendering)

3. **Scalability**: Structure can accommodate future features without restructuring
   - New features get their own directories (e.g., `forms/`, `validation/`, `routing/`)
   - Each feature directory can grow independently

4. **Reduced Cognitive Load**: 5-7 files per directory (optimal)
   - `styling/`: 8 files (cn, colors, styles, variants, animation)
   - `theming/generators/`: 7 files (animation, border-radius, color, shadow, spacing, theme, typography)
   - `sections/props/`: 5 files (builder, config, component-props, element-props, component-builder)

5. **Clean Imports**: Barrel exports for feature directories
   - `from '@/presentation/theming'` instead of `from '@/presentation/utils/theme-generators/theme-generator'`

6. **Eliminated Duplication**: Consolidated `animation-composer.ts`

7. **Maintained Git History**: Used `git mv` to preserve file history

### Negative Consequences

1. **Breaking Changes**: All imports updated (78+ files modified)
   - Mitigated by automated script and comprehensive validation
   - Migration guide provided (`.github/IMPORT_MAPPING.md`)

2. **Team Coordination Required**: Concurrent work could cause merge conflicts
   - Performed during low-activity period
   - Clear commit message documents all changes

3. **Initial Complexity**: More directories to navigate initially
   - Mitigated by clear naming and logical grouping
   - Improved over time as developers learn the structure

## Pros and Cons of the Options

| Criteria                  | Option 1: Minimal | Option 2: Flatten | Option 3: Component-Centric | Option 4: Feature-Based (SELECTED) |
| ------------------------- | ----------------- | ----------------- | --------------------------- | ---------------------------------- |
| Discoverability           | ❌ Poor           | ⚠️ Medium         | ✅ Good                     | ✅ Excellent                       |
| Scalability               | ❌ Poor           | ❌ Poor           | ⚠️ Medium                   | ✅ Excellent                       |
| Cognitive Load            | ❌ High           | ❌ Very High      | ⚠️ Medium                   | ✅ Low                             |
| Separation of Concerns    | ❌ Poor           | ❌ None           | ⚠️ Partial                  | ✅ Excellent                       |
| Migration Effort          | ✅ Low            | ⚠️ Medium         | ⚠️ Medium                   | ❌ High                            |
| Long-term Maintainability | ❌ Poor           | ❌ Poor           | ⚠️ Medium                   | ✅ Excellent                       |

## Links

- **Import Mapping**: `.github/IMPORT_MAPPING.md`
- **Migration Script**: `scripts/update-imports.sh`
- **Commit**: b56396a9 (refactor: reorganize presentation layer with feature-based structure)

## Follow-up Actions

1. **Monitor Developer Feedback**: Collect feedback from team on new structure
2. **Update Onboarding Docs**: Add navigation guide for new structure
3. **Consider Barrel Exports**: Evaluate if barrel exports should be expanded for cleaner imports
4. **Address ESLint Warnings**: Refactor `PageBodyScripts.tsx` and `PageHead.tsx` to reduce complexity (separate ADR)

---

**Decision Date**: 2025-11-10
**Status**: Accepted
**Supersedes**: N/A (initial structure decision)
**Superseded By**: N/A
