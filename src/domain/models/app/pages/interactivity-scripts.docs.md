# Scripts

> A page's `scripts` block — external dependencies, inline snippets, client-side feature flags and config data — plus the sandboxed `customHTML` component.

Sovrium pages are server-rendered, then progressively enhanced. Most interactivity needs no JavaScript from you; the Interactions article covers the declarative half. When you do need your own, this is where it is declared.

```yaml
pages:
  - name: Dashboard
    path: /dashboard
    scripts:
      externalScripts:
        - { src: 'https://plausible.io/js/script.js', defer: true, position: head }
        - { src: 'https://cdn.example.com/widget.js', async: true, position: body-end }
      features: { betaPanel: true }
    components:
      - { type: text, element: h1, content: 'Dashboard' }
```

## The page `scripts` block

<!-- sovrium:options ScriptsSchema depth=1 -->

`scripts` is a **page** property. There is no app-wide scripts block: a script belonging on every page is declared on every page that needs it, which keeps the page config the single place you look to know what a page loads.

`external` is accepted as an alias of `externalScripts`, and both spellings feed one list. A `src` declared under each renders a single tag and keeps the attributes of its first declaration, `externalScripts` being read first.

**The inline key is `inlineScripts`, not `inline`.** Because an unknown key is dropped rather than rejected, a page declaring `inline:` validates cleanly and then ships no script at all.

## An external script

<!-- sovrium:options ExternalScriptSchema -->

`src` is the only required member. `position` places the tag at `head`, `body-start` or `body-end`.

## An inline script

<!-- sovrium:options InlineScriptSchema -->

`code` is the only required member. `async` wraps the code in an async IIFE, so it may use top-level `await`.

## Feature flags

`features` exposes named toggles to the client without shipping a second config channel. A feature is either a bare boolean or an object:

<!-- sovrium:options FeatureConfigSchema -->

```yaml
pages:
  - name: Dashboard
    path: /dashboard
    scripts:
      features:
        darkMode: true
        liveChat: { enabled: true, config: { provider: intercom, appId: abc123 } }
```

`config` is free-form, so it carries whatever the third-party widget needs without the schema having to know about it.

## `customHTML`

Embed raw HTML — inline or from a file — in a sandboxed context that can read the design's CSS custom properties but cannot reach the parent page's JavaScript. `content` holds an inline HTML string; `htmlSrc` names a file relative to the project root and takes precedence over `content`. An `htmlSrc` that cannot be read renders a clear error in place rather than failing the page.

```yaml
pages:
  - name: Embed
    path: /embed
    components:
      - type: customHTML
        content: '<div style="color: var(--color-primary)">Custom block</div>'
```

**The type literal is `customHTML`, exactly.** `custom-html` is not a component type and will not render.
