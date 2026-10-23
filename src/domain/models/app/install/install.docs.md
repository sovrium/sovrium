# Make the app installable

> Let members install your app on a phone's home screen, with a web app manifest generated from the app and, if you want one, an offline shell.

Declare `install` and Sovrium serves `/manifest.webmanifest`, built from your app rather than written by hand, so it never drifts from it: the name is your `displayName` (else `name`), the description your `description`, the icons the 192 and 512 pixel entries of the home page's favicon set (an SVG icon is accepted), the start address and scope `/`, and the theme colour your design's primary colour. Every page links it, and a phone's browser then offers to install the app and opens it without the address bar. An app that declares no favicon on any page lists the engine's neutral default icon, the 32 pixel `/favicon.ico` it serves; a favicon set with none of those icons gives an empty icon list. A page whose own favicon set links a hand-written manifest keeps that one. A static build (`sovrium build`) writes the same manifest into its output, and with `offline: true` the worker and its offline page too.

```yaml
displayName: Riverside Studio
install:
  shortName: Studio
  display: standalone
  offline: true
```

## Configuration

<!-- sovrium:options InstallSchema -->

## The offline shell

`offline: true` also registers a service worker at `/service-worker.js`, over the whole site. It caches the app's built scripts and styles and one offline page, and nothing else. When the network is gone, the installed app opens that page, which says it is offline, instead of the browser's error page.

It never caches an answer from `/api/`, a page's HTML, `/_admin` or the sign-in routes: nothing a signed-in member saw stays on a shared device, and deleting an account is not undone by a cache. Its cache is named after the Sovrium release serving the app and your app's `version` (`sovrium-shell-0.41.0+1.4.0`, or `sovrium-shell-0.41.0` when the app declares no `version`). Changing `version` replaces the cached assets on the next visit, and so does upgrading Sovrium alone: the next visit deletes the previous cache, so an asset copy an earlier release cached is never served offline. You do not need to declare a `version` for an engine upgrade to start from a clean cache.

Turning `offline` off while keeping `install` unregisters the worker on the next visit and deletes its cache. Removing `install` entirely does not: the pages then carry no install tag at all, so a worker already registered on a reader's device stays in place. To retire the offline shell, turn `offline` off and keep `install` for at least one release.

No page can take these addresses: a page path holds no `.`, so even a catch-all page never answers `/manifest.webmanifest` or `/service-worker.js`. Without `install`, neither is served and no page links a manifest.
