# Release through npm Trusted Publishing

The `Publish` workflow runs when a push to `main` changes `package.json`.
Its `check` job reads the version from `package.json` and skips the run when the tag `v<version>` already exists, so a change that does not bump the version releases nothing.
The `publish` job tests the source with Bun and the distributed CLI with Node, then publishes.
After `npm publish` succeeds, the `release` job creates the tag `v<version>` and the GitHub release on the published commit, with that version's section of `CHANGELOG.md` as the notes.
Nobody pushes a release tag by hand.
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
The GitHub `publish` environment must allow deployments from the `main` branch.
This is an owner step in the environment's settings: under "Deployment branches and tags", allow `main` and remove the rule that allows only `v*` tags.
While that rule remains, the publish job cannot start, because the run comes from a push to `main`.
The environment requires approval from `meganemura` before the publish job starts.
Administrators cannot bypass this approval. The maintainer can approve their own workflow run.
The repository is public, so npm publishes provenance with the package.

See the [npm trusted publisher documentation](https://docs.npmjs.com/trusted-publishers/).

## Publish a version

Prepare the version change and verify the package contents before publication:

```sh
bun test
bun run build
STOW_TEST_RUNTIME="$(command -v node)" STOW_TEST_CLI="$PWD/dist/cli.js" bun test
npm pack --dry-run
```

1. In one commit, set the new version in `package.json` and turn the `## [Unreleased]` section of `CHANGELOG.md` into `## [<version>] - <date>`, with a new empty `## [Unreleased]` section above it. The `release` job extracts the section whose heading starts with `## [<version>]`, so keep that heading format.
2. Obtain the user's explicit approval immediately before the commit lands on `main`, because that push starts publication.
3. Land the commit on `main` through the `queue` branch. Do not push a tag.
4. Approve the `publish` environment on the `Publish` run.
5. Confirm the version on npm, the `v<version>` tag, and the GitHub release after the workflow succeeds.

An existing npm version cannot be replaced. A failed rerun needs a version check before another publish attempt.
