# Releasing macOS builds

## Create and push a version tag

1. Update `package.json` to the target version.
2. Commit the version bump.
3. Create and push the tag:

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
```

The GitHub Actions workflow triggers on tags that match `v*.*.*`.

## Required secrets for signing/notarization

If you want signed and notarized builds, add these secrets in
GitHub repo settings (Settings -> Secrets and variables -> Actions):

- `CSC_LINK`: Base64-encoded signing certificate (.p12) or a URL to it.
- `CSC_KEY_PASSWORD`: Password for the signing certificate.
- `APPLE_ID`: Apple ID email used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password for the Apple ID.
- `APPLE_TEAM_ID`: Apple Developer Team ID.

`GH_TOKEN` is provided by GitHub Actions via `secrets.GITHUB_TOKEN`.

## Test building locally on macOS

```sh
npm ci
npm run build:desktop:local
```

For local signing/notarization, export the same environment variables
listed above before running the build.
