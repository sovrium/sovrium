# `public/` — static-asset directory

Files dropped here are served by `sovrium start` at their path relative to
this directory: `public/logo.png` -> `/logo.png`. Same set is copied into the
static output by `sovrium build`.

## Three rules an author should know

1. **Anchored to this `app.yaml`** — `./public` is resolved against the
   directory containing `app.yaml`, NOT the shell's current working directory.
   `cd elsewhere && sovrium start ./app.yaml` still serves the same files.
   Override with `--publicDir <path>` or `SOVRIUM_PUBLIC_DIR=<path>`.
   Disable entirely with `--no-publicDir` or `SOVRIUM_PUBLIC_DIR=none`.

2. **Secret-file blocklist** — these path shapes return 404 even when the
   file exists under `public/`, so an accidental commit cannot leak secrets:
   - `.env`, `.env.local`, `.env.production`, any `.env.*`
   - `.git/**`, `node_modules/**`, `.sovrium/**` (runtime data dir)
   - `CLAUDE.md` (LLM operator instructions)
   - `*.key`, `*.pem` (SSH / TLS private material)
   - `*.sql`, `*.sqlite`, `*.sqlite-journal` (database dumps + files)

   Symlinks whose realpath escapes this directory also return 404.

3. **Routing precedence** — incoming requests are resolved in this order:
   1. Dynamic SSR page (a route registered by your `pages:` config)
   2. Built-in SEO route (`/sitemap.xml`, `/robots.txt` — generated live)
   3. File under `public/` (this directory)
   4. 404

   A `public/sitemap.xml` is silently shadowed by the generated route — see
   CLI-SERVE-STATIC-015. Drop SEO overrides into your `pages:` config instead.

## Suggestions

- Add `logo.svg`, `favicon.ico`, `og-image.png`, `manifest.webmanifest`,
  product downloads, and any other binary assets you want served at the root.
- Keep `index.html` out unless you really mean to override the framework
  page at `/` — that's a fall-through, not a default, and it loses to any
  page declared in your config.
