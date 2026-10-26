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
- **A folder you already have**, holding an `app.yaml`, `app.yml`, `app.json` or `app.ts`. When it holds more than one, the app opens the first in that order and runs that file.
- **An address** — a configuration published at an `https` URL. The address may not carry a user name or password. Sovrium downloads that one document and builds a new project around it, as `app.json` for a `.json` address and `app.yaml` otherwise. Nothing is run, a configuration written as TypeScript is refused outright, and where the file came from is recorded beside it. This is `sovrium init --from-url`, described in **Project Commands**.

A link can start the same way. The installer registers the app for `sovrium://` links on macOS, Windows and Linux, so clicking `sovrium://new?template=crm` in a browser, or `sovrium://new?url=https://…` for an address, opens the app, whether it was already running or not. The app always asks before it does anything, then lets you choose the folder. A link that asks for anything other than a new project, names a template it does not recognise, or points at an address that is not `https` or that carries a user name or password is refused with a message saying why.

A link can also open a **starter app**: `sovrium://new?bundle=https://…` points at an archive made by `sovrium bundle`, with its configuration, its files and usually some demo data. Here the order is different, because the app cannot tell you who published the archive without looking inside it. As soon as you click, Sovrium downloads it into a temporary folder and checks it, the way **Opening a Bundle** describes: one download of at most 25 MiB from the link's host, which therefore learns the link was opened. Nothing is added as a project and nothing from it runs yet. Then one dialog shows where it came from (and the address the link named, when a redirect led elsewhere), the app's name, its size and whether it includes demo data, and lets you choose the folder. It also shows the publisher: **verified** when the archive is signed with Sovrium's publisher key, which tells you who published it and that it has not changed since, and nothing about what the app does; **unverified** otherwise, with a stronger warning, because anyone could have made it. Either way the same checks applied. A bundle that fails a check is refused with the reason, and cannot be opened. If you cancel, the download is deleted. If you go ahead, the project is created from exactly the archive that was checked, its demo data, if any, is loaded, and an admin account, `admin@localhost.sovrium`, is created with a random password. The window shows that password **once**, with a button to copy it, and keeps it nowhere; `sovrium admin reset-password admin@localhost.sovrium` sets a new one if you lose it. If the demo data does not load, the project is still created, and the reason is shown next to the password. The address must be `https`, and a link whose address carries a user name or password is refused.

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

The app does not edit your configuration, and that is deliberate. Its settings page holds settings for Sovrium **on this machine** — which project is open, the port, whether the app opens in your browser instead of its own window, whether it checks for updates, whether your AI assistant may edit the configuration through its connection, the undo and reset controls, and the log. Nothing from the app's own config appears there: no table, no page, no field, no automation, no theme control.

You change the app by editing its configuration file — `app.yaml` in a project the app created — with whatever edits text: an editor, or the AI assistant you already use. Sovrium notices the save and reloads. Point an assistant at the folder once and it can read the configuration, check it, and look up what a setting accepts. Turn on **Let my AI edit** and it can also change the configuration through that connection, where Sovrium checks each edit before it is saved; the switch is off until you turn it on. For Claude Desktop, **Connect Claude Desktop** adds the project to that app's own settings file for you: it shows you the exact entry first, keeps a backup of the file, leaves every other server in it untouched, and asks again whenever the entry would change. Restart Claude Desktop afterwards. **Connect your AI to a project** is the walkthrough.

That settings file belongs to Claude Desktop, not to your app, and writing the entry into it does not edit your configuration.

When a save cannot be loaded, the app says so rather than leaving you to guess. Nothing stops, the previous version keeps serving, and the app shows what the engine could not read, with a button that copies those details for you to paste back to your assistant. Going back a version is one control away — see **Undo and Reset**.

## Updates

The app has its own updater, and because the engine ships inside it, the two are replaced together. `sovrium update` run against the engine inside the app declines and says so, rather than leaving the window and the engine on different versions.

**The app updates itself.** Each release publishes an update for macOS (Apple silicon and Intel), Windows and Linux, signed with Sovrium's update key. The public half of that key is built into the app, and the app installs an update only when its signature matches; one that does not is refused, and the version you have keeps running.

**The update check sends nothing about you.** It asks `sovrium.com/desktop/latest.json` for the current version number, which redirects to the update manifest attached to the latest release on GitHub; an update, when there is one, downloads from that same release. Nothing about you, your project or your configuration is sent. Switch the check off in settings and the app contacts nothing at all. The engine running your project makes no such request either way, with the check on or off.

## Next steps

- **Connect your AI to a project** — pointing an assistant at the folder.
- **Undo and Reset** — the history, and going back a version.
- **Troubleshooting: the Sovrium App** — the install warnings, and a window that opens on nothing.
- **Quick Start** — the same first app, from the command line.
