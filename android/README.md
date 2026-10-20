# Beautifood POS for Sunmi (Android)

A thin Android app for Sunmi terminals (V2 Pro handheld, T2 and D2 desktops, P2…): the Beautifood staff console full screen, with the device's **built-in receipt printer**, **cash drawer** and **barcode scanner** reachable from the page.

Browsers can't reach a Sunmi's own printer; this app can. Everything else (the till, the menu, the queue, receipts and their designs) is the same web app, so there is nothing to keep in sync.

## What it does

- Opens `beautifoodUrl` + `beautifoodStartPath` (the till, `/m/pos`) full screen and keeps the screen on.
- Stays on that one site. Links elsewhere (maps, phone numbers) open in the system apps.
- Exposes `window.BeautifoodNative` to the page, and only while it shows that site:
  - `info()` returns the device and its printer: available, paper width (58/80 mm), model, status.
  - `write(id, base64)` prints ESC/POS bytes: the same image receipt, cut and drawer kick the till sends any printer. The answer comes back through `window.__beautifoodNative.done(id, ok, error)` once the paper is out, or with the printer's reason (out of paper, cover open…). A drawer kick (`ESC p`) is done with Sunmi's own `openDrawer`.
  - Scans from the built-in scanner arrive as a `beautifood:scan` event; the staff console types them into the focused field.
- In the till, **Built-in printer** is then the printer, chosen automatically, with the device's paper width.

## Build

```sh
cd android
./gradlew assembleDebug          # app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest lintDebug
```

Needs JDK 17+ and the Android SDK (platform 35). To point it at another Beautifood: `./gradlew assembleRelease -PbeautifoodUrl=https://your.domain`.

CI (`.github/workflows/android.yml`) builds, tests and lints on every change under `android/` and attaches the APKs to the run. Releases are signed when these repository secrets are set: `ANDROID_KEYSTORE_B64` (the keystore, base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## Install on a Sunmi

1. Download the APK from the latest **Android POS app** run on GitHub Actions (or build it).
2. On the device: allow installs from unknown sources for your file manager, open the APK, install. (Or publish it to your devices through the Sunmi partner app store.)
3. Open **Beautifood POS**, sign in, open the till: the printer chip says **Built-in printer**. **Test print** prints a sample receipt in your design.
