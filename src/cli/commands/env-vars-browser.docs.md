# Environment Variables: Browser Automation

> A `browser/run` step drives a real browser, and Sovrium does not ship one. On a server, browser automation is off until you turn it on and point Sovrium at a Chrome — on the machine, or running as a separate service. The desktop app turns it on by itself and uses an installed Chrome or Edge, or, on a Mac without one, the system's WebKit. With no browser, a browser step fails with `browser_unavailable`, naming the variable to set.

## Choosing the browser

| Variable              | Default                                         | Purpose                                                                                                                                              |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BROWSER_PROVIDER`    | `off` on a server, `webview` in the desktop app | `webview` lets automations drive a browser; `off` refuses every browser step with `browser_unavailable`                                              |
| `BROWSER_BACKEND`     | `auto`                                          | `chrome`, `webkit` or `auto`. `webkit` is allowed only in the desktop app on a Mac; anywhere else it refuses the boot with `browser_backend_refused` |
| `BROWSER_CHROME_PATH` | auto-detected                                   | A Chrome, Chromium, Edge or `chrome-headless-shell` executable that Sovrium starts on the first browser step                                         |
| `BROWSER_CDP_URL`     | unset                                           | `http://host:port` (or `ws://…`) of a Chrome already running with remote debugging. Cannot be combined with the path above                           |
| `BROWSER_NO_SANDBOX`  | unset — the sandbox stays on                    | `1` starts the Chrome that Sovrium spawns without Chrome's own sandbox, for a host where it cannot create one                                        |

With `BROWSER_BACKEND=auto`, a server uses Chrome — `BROWSER_CDP_URL`, else `BROWSER_CHROME_PATH`, else an installed Chrome, Chromium or Edge — and the desktop app prefers an installed Chrome or Edge, because only Chrome holds every request a page makes to the hosts an action lists. On WebKit, the addresses a run opens are checked, but not the files a page loads.

When Chrome stops as soon as it starts — on Linux, usually its sandbox failing for a user without root or user namespaces — the step fails with `browser_launch_failed`, and the message names `BROWSER_NO_SANDBOX`. Setting it to `1` starts Chrome without that sandbox; prefer a Chrome running as its own service (`BROWSER_CDP_URL`) when the sites the browser visits are not ones you trust.

## One Chrome for documents and automations

Sovrium runs one Chrome per process, and the document renderer uses it too. Whichever starts it first decides how it is started for both, so the app refuses to start — `browser_config_conflict`, naming both variables — when the two would disagree:

- `BROWSER_CHROME_PATH` and `RENDERER_CHROME_PATH` name different executables;
- `BROWSER_CDP_URL` and `RENDERER_CDP_URL` name different browsers;
- `BROWSER_NO_SANDBOX` and `RENDERER_NO_SANDBOX` disagree while both use Chrome;
- `BROWSER_CHROME_PATH` and `BROWSER_CDP_URL` are both set;
- `BROWSER_CONCURRENCY` is above `1` with Chrome, whose sessions share one cookie jar.

## Limits

| Variable                          | Default  | Purpose                                                                                                                        |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `BROWSER_STEP_TIMEOUT_MS`         | `15000`  | Longest one step waits for its element or its page, in ms. A step's `timeoutMs` or the action's `timeouts.stepMs` overrides it |
| `BROWSER_RUN_TIMEOUT_MS`          | `300000` | Longest a whole browser run may take, in ms, a wait for a confirmation excluded; past it the browser is closed                 |
| `BROWSER_CONCURRENCY`             | `1`      | Browser runs in progress at once; the others wait their turn. Must be `1` with Chrome                                          |
| `BROWSER_HOLD_MAX_MS`             | `600000` | Longest a run waiting for a person's confirmation keeps its browser open; a `confirm.timeout` above it refuses the boot        |
| `BROWSER_ARTIFACT_RETENTION_DAYS` | `30`     | Days a run's screenshots are kept, counted from the run's start                                                                |

An invalid value refuses the boot, with a message saying what each `BROWSER_*` variable accepts: the timeouts are positive whole numbers of milliseconds up to `2147483647`, `BROWSER_CONCURRENCY` and `BROWSER_ARTIFACT_RETENTION_DAYS` positive whole numbers, `BROWSER_CDP_URL` an `http(s)` or `ws(s)` address, and `BROWSER_NO_SANDBOX` one of `1`, `true`, `0` or `false`. The conflicts above are checked only while the browser is on. Nothing is started until the first browser step runs, so an install that never uses a browser pays nothing for it.

## Private networks

A browser step reaches only the hosts its action lists in `allowedHosts`, and never a private-network or loopback address unless the instance allows private outbound calls with `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`. A Chrome running as a separate service should also sit on a network with no route to private ranges, since a name can resolve to a private address after Sovrium checked it.

## Running Chrome next to Sovrium

```yaml
services:
  sovrium:
    environment:
      BROWSER_PROVIDER: webview
      BROWSER_CDP_URL: http://browser:9222
    networks: [default, browse]
  browser:
    image: chromedp/headless-shell:latest # pin by digest
    networks: [browse]
    read_only: true
    tmpfs: [/tmp]
    shm_size: 512m
    mem_limit: 1g
```

Unlike the document renderer's Chrome, this one needs internet access to reach the sites it drives; block its route to private ranges on the host instead. A renderer pointed at the same Chrome (`RENDERER_CDP_URL` equal to `BROWSER_CDP_URL`) shares that access. Sovrium cannot pass switches to a Chrome it did not start: give that one `--webrtc-ip-handling-policy=disable_non_proxied_udp` and `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`, which a Chrome Sovrium starts always gets, so WebRTC cannot read the host's addresses. Pages never get WebRTC or WebTransport themselves: Sovrium takes both away in every page it drives, on a Chrome it started or one it connects to.
