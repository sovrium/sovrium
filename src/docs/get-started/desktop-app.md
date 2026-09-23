# The Sovrium App

> A window around the engine: pick a starting point, get a project folder with one configuration file in it, and let the AI assistant you already use edit that file while the app reloads underneath.

The Sovrium app is the same engine this manual describes, with a window around it. It does one thing the command line does not: it takes care of running the server, so that editing the configuration is the only thing left to do.

Everything else here still applies. The configuration file the app creates is an ordinary Sovrium config — it runs unchanged under `sovrium start`, in Docker, on a server, and in CI, because nothing about being supervised by the app enters the file.

## Installing it

Download the installer for your platform from the [download page](https://sovrium.com/download) and open it.

| Platform | What you get                                                     |
| -------- | ---------------------------------------------------------------- |
| macOS    | A `.dmg` — one for Apple silicon and one for Intel               |
| Windows  | An installer that installs for the current user, not the machine |
| Linux    | An AppImage you can run directly, or a `.deb`                    |

The engine is inside the app. There is nothing else to install, and the `sovrium` command you may already have on your PATH is untouched — the app runs its own copy and the two do not interfere.

If your operating system warns you about the download the first time, **Troubleshooting: the Sovrium App** says what each warning is and how to get past it.

## The first run

The app opens on a list of starting points. Every one of them makes a folder on your machine with one configuration file in it, and Sovrium runs the app that file describes:

- **A template** — one of the bundled starting points, the same set `sovrium init --template` offers. You choose a folder name and where it should go.
- **A folder you already have**, holding an `app.yaml`.
- **An address** — a configuration published at an `https` URL. Sovrium downloads that one document and builds a new project around it. Nothing is run, a configuration written as TypeScript is refused outright, and where the file came from is recorded beside it. This is `sovrium init --from-url`, described in **Project Commands**.

Once a project is open the app starts the engine, waits until it answers, and shows your app in the window. The first run takes longer than the ones after it, because the database is created then.

## Where things live

Your project is a folder, and it is yours. The app never hides any of it:

```text
my-crm/
  app.yaml       # your configuration — the whole application
  .sovrium/      # the data directory: database, encryption key, lock, status
  public/        # static assets
```

The data directory sits **inside the project**, so two projects never share a database and moving the folder moves the app with it. It is the engine's own default — `./.sovrium` — and the `.gitignore` the scaffold writes keeps it out of version control.

There is a **Reveal project folder** action in the app for exactly this reason: the folder is the interface, and anything that can open a file can edit your app.

## Editing the configuration

The app does not edit your configuration, and that is deliberate. Its settings page holds settings for Sovrium **on this machine** — which project is open, the port, whether the app opens in your browser instead of its own window, whether it checks for updates, the undo and reset controls, and the log. Nothing from the app's own config appears there: no table, no page, no field, no automation, no theme control.

You change the app by editing `app.yaml`, with whatever edits text — an editor, or the AI assistant you already use. Sovrium notices the save and reloads. Point an assistant at the folder once and it can read the configuration, check it, and look up what a setting accepts; **Connect your AI to a project** is the walkthrough.

When a save cannot be loaded, the app says so rather than leaving you to guess. Nothing stops, the previous version keeps serving, and the app shows what the engine could not read, with a button that copies those details for you to paste back to your assistant. Going back a version is one control away — see **Undo and Reset**.

## Updates

The app has its own updater, and because the engine ships inside it, the two are replaced together. `sovrium update` run against the engine inside the app declines and says so, rather than leaving the window and the engine on different versions.

**On this first release the updater has nothing to fetch yet.** The signing key the update feed is served under does not exist, so no update manifest is published and the check finds nothing. Installing the next version is a download from the same page, once. After the key is in place the app updates itself and this paragraph goes away.

**The update check is a request to Sovrium's own infrastructure, and it is the only one the app makes.** It asks `sovrium.com/desktop/latest.json` for the current version number, and sends nothing about you, your project or your configuration. Switch it off in settings and the app contacts nothing at all. The engine running your project makes no such request either way, with the check on or off.

## Next steps

- **Connect your AI to a project** — pointing an assistant at the folder.
- **Undo and Reset** — the history, and going back a version.
- **Troubleshooting: the Sovrium App** — the install warnings, and a window that opens on nothing.
- **Quick Start** — the same first app, from the command line.
