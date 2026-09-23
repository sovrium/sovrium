# Troubleshooting: the Sovrium App

> The warnings an operating system shows on a fresh download, a window that opens on nothing, and the two places to look when a change does not appear.

The engine's own failures are covered by **Troubleshooting: Startup & Config**. This page is about the window around it.

## Your operating system warns about the download

Each platform has its own way of saying "this came from the internet". The warning is about provenance, not about the file being broken, and getting past it is a different gesture on each one.

### macOS — "cannot be opened because the developer cannot be verified"

Gatekeeper blocks an application it cannot attribute to a registered developer. Open it once through the context menu rather than by double-clicking:

1. Open the `.dmg` and drag Sovrium to your Applications folder.
2. In Applications, **right-click** Sovrium and choose **Open**.
3. Confirm at the prompt.

The dialog that appears from a right-click **Open** carries a button the double-click dialog does not. You need it once; afterwards Sovrium opens normally. System Settings → Privacy & Security has an **Open Anyway** button that does the same thing if you have already tried and been refused.

### Windows — "Windows protected your PC"

SmartScreen shows a blue panel with one button. The second option is behind a link:

1. Click **More info**.
2. Click **Run anyway**.

The installer is per-user, so it asks for no administrator password. That is also why the install does not need an elevated prompt: nothing is written outside your own profile.

### Linux — the AppImage does not start

Two things stop an AppImage, and they look the same from the outside.

**It is not executable.** A downloaded file usually is not:

```bash
chmod +x Sovrium-linux-x64.AppImage
./Sovrium-linux-x64.AppImage
```

**FUSE 2 is missing.** An AppImage mounts itself, which needs libfuse2 — and a current distribution often ships only FUSE 3. Install the compatibility package your distribution provides (`libfuse2` or `libfuse2t64` on Debian and Ubuntu), or skip the mount entirely by extracting it:

```bash
./Sovrium-linux-x64.AppImage --appimage-extract
./squashfs-root/AppRun
```

The `.deb` avoids both problems and is the better choice on a Debian or Ubuntu machine.

## The window is blank, or shows nothing useful

On Linux the window is drawn by WebKitGTK, and some combinations of driver and desktop leave it blank while the app itself is running perfectly well. Turn on **Open in your browser instead of this window** in settings: the engine keeps running, and your app opens in your default browser instead. The app then stays out of the way and shows you the port it is on.

This is a display problem, not an application problem — the same project runs identically in either mode, and nothing about your configuration or your data is involved.

## The app opens but your project never starts

Look at the log first — **What Sovrium said**, in settings. It carries everything the engine has written since it started, and an engine that refused a configuration says why there.

Two failures show up as a window that opens on nothing:

- **The engine did not start at all.** The app retries three times before giving up, and the log holds whatever the engine managed to print.
- **The engine started but the window cannot reach it.** On macOS the engine listens on the IPv6 loopback `[::1]` rather than on `127.0.0.1`, so a browser or script pointed at the IPv4 address gets a refused connection while the app itself is fine. Use the address the app shows you rather than assembling one from the port.

## A change you made did not appear

Check, in this order:

1. **Did the save load?** A configuration Sovrium cannot read is refused, and the previous version keeps serving — so the app looks healthy while the file on disk is not the one running. The app says so, and shows what the engine could not read. **Check the configuration** in settings asks the same question on demand.
2. **Was it a change that needs a restart?** Some parts of a configuration are set up once at boot — the database schema, background jobs, credentials, connected services. Changing one of those replaces the process rather than swapping in place, which takes a moment longer. **CLI Overview** lists which keys those are.
3. **Is it the change you think it is?** Undo goes back one accepted version, and **Undo and Reset** says what is recorded and what is not.

## The window and the engine disagree about the version

They ship together, so a mismatch means an update reached one half only. Settings shows both numbers when they differ. Reinstalling puts them back in step; nothing in your project folder is touched by either the mismatch or the reinstall.

This is also what the **Connect your AI** screen means when it says the installed engine does not answer the command — the snippet it offers you would not work against an engine older than the verb.

## Next steps

- **The Sovrium App** — what the app is, and where your project lives.
- **Troubleshooting: Startup & Config** — the engine's own refusals.
- **Undo and Reset** — going back a version.
