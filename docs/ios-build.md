# iOS build guide

## Prerequisites

- macOS with Xcode installed.
- Apple Developer account for signing and TestFlight.

## Build and sync commands

```sh
npm run ios:sync
```

To open the native project:

```sh
npm run ios:open
```

## Bundle identifier and signing team

1. Open the iOS project in Xcode.
2. Select the app target.
3. In the Signing & Capabilities tab, set the Bundle Identifier and
   choose your Team.

## Archive for TestFlight

1. In Xcode, select Product -> Archive.
2. In the Organizer window, validate the archive.
3. Distribute the archive to TestFlight.

## Push notifications (if used)

If the app uses push notifications, enable these capabilities in Xcode:

- Push Notifications
- Background Modes -> Remote notifications

Configure them in Xcode under the target's Signing & Capabilities tab.
