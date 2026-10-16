# Printer Agent (Android)

An Android app that turns a phone into a print agent. It connects to the printer-spooler server, finds
ESC/POS network printers on the local Wi-Fi (TCP port 9100), and prints the jobs the server queues for
them. The UI is in Hebrew.

## Install on a phone (no build needed)

1. On the phone, open the repo's **Releases** page and download `app-release.apk` from the latest release.
2. Open the downloaded file. If Android asks, allow your browser or file app to install unknown apps.
3. If Play Protect warns about the app, tap **More details → Install anyway**.
4. The app appears as **סוכן הדפסה**.

## What the app needs to work

- **A running printer-spooler server** reachable from the phone, for example `http://192.168.1.20:5100`.
  Use the PC's Wi-Fi IP address; `localhost` only works over USB with `adb reverse tcp:5100 tcp:5100`.
- **An agent key** (`pa_...`) created in the server console, plus the **business name** (tenant) it
  belongs to. Copy the key rather than retyping it: the server stores only its hash, so a typo can't be
  recovered, only replaced with a new key.
- **The phone, the printers and the server on the same Wi-Fi network.** If the phone can't reach the
  server, check that the PC is actually on that Wi-Fi and that Windows Firewall allows port 5100.

## First-time setup in the app

1. Enter **כתובת המערכת** (server address), **מפתח זיהוי** (agent key) and **שם העסק** (business name),
   then tap **התחבר**.
2. Tap **חיפוש מדפסות** to scan the Wi-Fi and **+** to add a printer. Adding registers it with the server.
3. Tap a printer's row to print a test page. Tap its IP address to open the printer's own settings page,
   where you can pin its IP so it doesn't change.
4. To have the app reopen after the phone restarts, tap **אישור פתיחה אוטומטית** and allow
   **Display over other apps**. On Samsung, also set **Settings → Apps → סוכן הדפסה → Battery →
   Unrestricted**.

## Build from source

Requirements: Node 22.11 or newer, JDK 17, and the Android SDK. Follow the React Native
[environment setup guide](https://reactnative.dev/docs/set-up-your-environment) for Android.

```sh
npm install        # also applies the fixes in patches/
```

### Develop on a connected phone

Enable USB debugging on the phone, connect it, then run each command in its own terminal:

```sh
npm start          # Metro dev server; keep it running
npm run android    # builds, installs and opens the app
```

Saved changes to the JS code reload on the phone automatically. Run `npm run android` again only after
changing native code (anything under `android/`) or adding a package with native code.

### Build an installable APK

```sh
cd android
./gradlew assembleRelease    # Windows: .\gradlew.bat assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk` and runs without Metro.
Install it with `adb install -r <path>` or copy it to the phone.

The release build is signed with the shared debug key in `android/app/debug.keystore`. That is fine for
internal use; a real release key would be needed before publishing to the Play Store.

## Troubleshooting

- **`'gradlew.bat' is not recognized`** although the file exists: the shell has
  `NoDefaultCurrentDirectoryInExePath` set. Clear it in PowerShell with
  `Remove-Item Env:NoDefaultCurrentDirectoryInExePath` and run the command again.
- **Phone shows as `unauthorized` in `adb devices`**: unlock the phone and accept the
  **Allow USB debugging?** prompt.
- **"Unable to load script"** in a development build: Metro isn't reachable. Start `npm start` and run
  `adb reverse tcp:8081 tcp:8081`.
