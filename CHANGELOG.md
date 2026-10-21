# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-10-21

### Changed

- A version bump in `package.json` that lands on `main` now publishes the package. The publish workflow creates the `v<version>` tag and the GitHub release after `npm publish` succeeds. See `docs/releasing.md`.

## [0.1.1] - 2026-10-03

### Added

- `stow agent-instructions` prints setup instructions for a coding agent, including how to install the CLI.

### Changed

- The package ships a Node CLI built to `dist/cli.js` and requires Node.js 20 or later instead of Bun.
- Releases publish from GitHub Actions through npm trusted publishing, with provenance, after an approval.

## [0.1.0] - 2026-10-01

### Added

- First release: a CLI that keeps personal skills for a Git checkout in a separate skills repository and links them into the project skill paths of configured agent hosts.
- `stow init` creates the user configuration before the skill storage.
