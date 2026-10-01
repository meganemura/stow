# Release through npm Trusted Publishing

The `Publish` workflow runs when a maintainer pushes a `v*` tag.
It tests the source with Bun and the distributed CLI with Node.
The tag must match the version in `package.json`.
The workflow uses npm OIDC authentication. It does not require an npm token secret.
The Actions use exact commit pins. Bun uses version `1.4.2`.

## Trusted publisher settings

Register these values for `@meganemura/stow` on npm:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Repository | `meganemura/stow` |
| Workflow filename | `publish.yml` |
| Environment | `publish` |
| Permission | Direct publish |

With an npm CLI that supports `npm trust`, the maintainer can register it with:

```sh
npm trust github @meganemura/stow --repo meganemura/stow --file publish.yml --environment publish --allow-publish
npm trust list @meganemura/stow
```

npm can require an additional account authentication step for these commands.
The GitHub `publish` environment accepts only `v*` tags.
The repository is private, so the workflow disables provenance.
GitHub limits required reviewers in private repositories by account plan.
The current environment uses a tag restriction, without a reviewer gate.

See the [npm trusted publisher documentation](https://docs.npmjs.com/trusted-publishers/).

## Publish a version

Prepare the version change and verify the package contents before publication.
Obtain the user's explicit approval immediately before the tag push that starts publication.

```sh
bun test
bun run build
STOW_TEST_RUNTIME="$(command -v node)" STOW_TEST_CLI="$PWD/dist/cli.js" bun test
npm pack --dry-run
git tag v0.1.1
git push origin v0.1.1
```

Use the version from `package.json` for each release tag.
Watch the `Publish` workflow and confirm the version on npm after it succeeds.
An existing npm version cannot be replaced. A failed rerun needs a version check before another publish attempt.
