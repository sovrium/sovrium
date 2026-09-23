; Copyright (c) 2025-2026 ESSENTIAL SERVICES
;
; This source code is licensed under the Business Source License 1.1
; found in the LICENSE.md file in the root directory of this source tree.
;
; NSIS installer hooks for the Sovrium desktop shell.
; Referenced from tauri.conf.json as bundle.windows.nsis.installerHooks.
;
; ---------------------------------------------------------------------------
; Why this file exists
; ---------------------------------------------------------------------------
;
; Tauri's NSIS template stops the application it is replacing. It does not know
; about the SIDECAR — `sovrium.exe`, the engine, which lives beside `Sovrium.exe`
; inside the install directory and is a separate process with its own handle on
; its own file. Windows will not let an installer overwrite a running .exe, so an
; update installed while the engine is up fails to replace it, and the user is
; left with a new shell supervising the old engine. That is tauri-apps/tauri
; #15134, and it presents as an update that "worked" and changed nothing.
;
; The shell already stops the sidecar before it calls the installer
; (`updater.rs::install_now`). This hook is the backstop for every other path:
; a user who downloads the installer by hand, an update applied after a shell
; crash, an uninstall from Add/Remove Programs.
;
; ---------------------------------------------------------------------------
; Why PowerShell rather than taskkill, and why that is not fussiness
; ---------------------------------------------------------------------------
;
; `taskkill /F /IM sovrium.exe` would kill EVERY process of that name on the
; machine. `sovrium.exe` is also the ordinary Sovrium server binary: a developer
; may be running one from a terminal, against a production database, with no
; relationship to this install at all. An installer that terminates it has
; reached outside its own directory, and the failure is silent and remote from
; its cause.
;
; So the kill is scoped BY PATH to $INSTDIR. PowerShell is the one tool present
; on every supported Windows that can filter on a process's executable path;
; `wmic` could too, but it is removed in recent Windows releases.
;
; `$$_` is an escaped literal `$_` — a single `$` opens an NSIS variable.
;
; Failure is ignored, deliberately and on every path. This is a backstop: if
; PowerShell is absent, if the query returns nothing, if the process is already
; gone, the install must carry on. The one thing that must never happen is an
; installer that refuses to run because its optional cleanup did not.

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping any Sovrium engine inside $INSTDIR..."
  nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process -Name sovrium -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like \"$INSTDIR\*\" } | Stop-Process -Force -ErrorAction SilentlyContinue"'
  Pop $0
  ; Give the OS a moment to release the file handle. Stop-Process returns as
  ; soon as the termination is requested, not once the handle is closed, and
  ; the very next thing this installer does is overwrite that file.
  Sleep 500
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping any Sovrium engine inside $INSTDIR..."
  nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process -Name sovrium -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like \"$INSTDIR\*\" } | Stop-Process -Force -ErrorAction SilentlyContinue"'
  Pop $0
  Sleep 500
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
