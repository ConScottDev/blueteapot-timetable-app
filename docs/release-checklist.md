# Release checklist

## Preflight checks

- Run `node scripts/preflight.js`.
- Confirm the workflow is green for macOS and Windows on the tag.

## Tagging a release

- Update `package.json` version and commit.
- Create and push a tag:

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
```

## Required GitHub secrets (macOS signing/notarization)

Add these secrets in GitHub repo settings (Settings -> Secrets and variables -> Actions):

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

`GH_TOKEN` is provided by GitHub Actions via `secrets.GITHUB_TOKEN`.

## Local test commands

Desktop:

```sh
npm ci
npm run build:desktop:local
```

iOS:

```sh
npm run ios:sync
npm run ios:open
```
