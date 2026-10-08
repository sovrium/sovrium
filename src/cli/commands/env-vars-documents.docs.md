# Environment Variables: Document Rendering

> Turning an HTML template into a PDF or an image needs a real browser, and Sovrium does not ship one. You point it at a Chrome you already have — on the machine, or as a sidecar container — or at a Gotenberg server. With none of them, HTML rendering is off and every such step fails with `renderer_unavailable`, which names the variables below. Everything else keeps working: SVG images, Word documents and PDF merging need no browser.

## Choosing the renderer

| Variable               | Default                                    | Purpose                                                                                                                    |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `RENDERER_PROVIDER`    | `webview` when a Chrome is found, else off | `webview` (drive Chrome directly), `gotenberg`, or `off`. `puppeteer` is reserved and not available yet                    |
| `RENDERER_CHROME_PATH` | auto-detected                              | A Chrome, Chromium, Edge or `chrome-headless-shell` executable that Sovrium starts on the first render                     |
| `RENDERER_CDP_URL`     | unset                                      | `http://host:port` (or `ws://…`) of a Chrome already running with remote debugging. Cannot be combined with the path above |
| `RENDERER_URL`         | `OFFICE_URL` when set                      | Gotenberg base URL, used when `RENDERER_PROVIDER=gotenberg`. Needs the full `gotenberg/gotenberg:8` image                  |
| `RENDERER_NO_SANDBOX`  | unset — the sandbox stays on               | `1` starts the Chrome that Sovrium spawns without Chrome's own sandbox, for a host where it cannot create one (see below)  |

When neither `RENDERER_CHROME_PATH` nor `RENDERER_CDP_URL` is set, Sovrium looks for an installed Google Chrome, Chromium or Microsoft Edge in the usual places for the operating system. It never attaches to the browser you browse with: a found browser is always started as a fresh, private instance. On a Mac this means the desktop app renders documents only when Chrome or Edge is installed — Safari's engine cannot print PDFs under the protections below.

Chrome normally runs each page inside a sandbox of its own. On Linux, a user without root and without user namespaces cannot create it — a systemd unit with `RestrictNamespaces=yes`, most containers — and Chrome stops as soon as it starts: the render fails with `render_failed`, and the message names `RENDERER_NO_SANDBOX`. Setting it to `1` starts Chrome without that sandbox. Templates still render with scripts off and no network of their own, so a template cannot use the browser to reach the host; what you give up is the second wall, against a flaw in Chrome itself. When templates or their data come from people you do not trust, prefer a Chrome running as its own service on an isolated network (`RENDERER_CDP_URL`, below). Run as root, Chrome refuses to start with its sandbox, so there Sovrium always starts it without one.

A sidecar name such as `http://renderer:9222` works: Sovrium resolves the name to an address first, because Chrome refuses connections addressed to anything but an IP or `localhost`.

## Limits

| Variable                    | Default    | Purpose                                                                                                 |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `RENDERER_TIMEOUT_MS`       | `30000`    | Longest one render may take, in ms; past it the page is closed and the step fails with `render_timeout` |
| `RENDERER_MAX_PAGES`        | `200`      | A PDF with more pages is refused with `render_limit_exceeded`, and nothing is stored                    |
| `RENDERER_MAX_OUTPUT_BYTES` | `52428800` | A PDF or image larger than this (50 MB) is refused the same way                                         |
| `RENDERER_CONCURRENCY`      | `2`        | Renders in progress at once; the others wait their turn                                                 |

The browser starts on the first render, not when Sovrium starts, so an install that never renders a document pays nothing for it.

Merging PDFs (`pdf/merge`) needs no browser but is held to the same page and size limits, counted over the pages taken from every input, and reads at most 100 inputs; each refusal names the limit it hit.

## What a template can and cannot do

Every render opens a fresh, empty page and closes it afterwards. JavaScript never runs in it. The page cannot reach the network or the disk on its own: every image, stylesheet or font it asks for is answered by Sovrium, from the files given to the step or inline `data:` URLs, and anything else is refused. A step that sets `allowRemoteAssets: true` lets Sovrium fetch remote `http`/`https` files for the page, through the same outbound protections as any other outgoing request — private and local addresses stay refused unless the instance allows them.

With `RENDERER_PROVIDER=gotenberg` the same rules hold inside the document — no script, no network access — but Gotenberg cannot hand its requests to Sovrium, so `allowRemoteAssets` is refused there, and an image needs an explicit height. Inline remote files as `data:` URLs instead.

## Running Chrome next to Sovrium

```yaml
services:
  sovrium:
    environment:
      RENDERER_PROVIDER: webview
      RENDERER_CDP_URL: http://renderer:9222
    networks: [default, render]
  renderer:
    image: chromedp/headless-shell:latest # pin by digest
    networks: [render]
    read_only: true
    tmpfs: [/tmp]
    shm_size: 512m
networks:
  render:
    internal: true # the browser has no route to the internet
```

## Converting Office files

Converting a Word, Excel or PowerPoint file to PDF (`document/convert`) needs an office engine. On a server, run Gotenberg's LibreOffice image beside Sovrium; on the desktop, point Sovrium at a LibreOffice you installed. With neither, conversion is off and such a step fails with `office_unavailable`.

| Variable              | Default                   | Purpose                                                                                         |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `OFFICE_PROVIDER`     | unset — conversion is off | `gotenberg` or `soffice`                                                                        |
| `OFFICE_URL`          | unset                     | Gotenberg base URL (`gotenberg/gotenberg:8-libreoffice`), used when `OFFICE_PROVIDER=gotenberg` |
| `OFFICE_SOFFICE_PATH` | auto-detected             | A LibreOffice `soffice` executable, used when `OFFICE_PROVIDER=soffice`                         |
| `OFFICE_TIMEOUT_MS`   | `120000`                  | Longest one conversion may take; past it the step fails with `render_timeout`                   |
| `OFFICE_CONCURRENCY`  | `2`                       | Conversions in progress at once; the others wait their turn                                     |

When `OFFICE_PROVIDER=soffice` and `OFFICE_SOFFICE_PATH` is unset, Sovrium looks for `soffice` on the `PATH`, then in the usual install places (`/Applications/LibreOffice.app` on macOS, `/usr/bin`, `/usr/local/bin`, `/opt/homebrew/bin`); with none found, a conversion fails with `office_unavailable` naming `OFFICE_SOFFICE_PATH`.

Before a file reaches the converter, Sovrium gives it a fixed name of its own — the name it was stored under never reaches the converter or the disk — and removes the links a Word, Excel, PowerPoint or OpenDocument file could use to fetch something; web and mail links stay. RTF files are not accepted, since they cannot be cleaned that way.

Run the converter on a network with no outbound route, so a document that slipped through still reaches nothing. `OFFICE_PROVIDER=soffice` cannot offer that: LibreOffice then runs on the Sovrium host, with the host's network. Use it for files you trust — your own templates, documents your team made — and the Gotenberg sidecar on an isolated network for files anyone else can supply.
