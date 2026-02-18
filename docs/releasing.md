# Release workflow

## How it works

The release workflow runs when you push a tag that matches `v*.*.*`.
It builds and publishes macOS and Windows artifacts in parallel. Both
jobs use the same tag, and electron-builder uploads assets to the GitHub
Release for that tag. It is expected that both jobs upload assets to the
same release without conflict.

## Common failures and troubleshooting

- Missing tag: verify the tag matches `v*.*.*` and was pushed to origin.
- Missing publish permissions: ensure Actions has permission to publish
  releases and that `secrets.GITHUB_TOKEN` is available.
- macOS signing/notarization failures: confirm all required Apple
  secrets are set and valid (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).
- Windows build failures: re-run the job and check for native module
  build errors or missing system dependencies.
- npm install errors: delete lockfile or cache locally, then retry with
  `npm ci` to ensure dependency integrity.
