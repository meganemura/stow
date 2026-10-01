# Overlay identity

`stow` uses the `origin` remote's two `owner/repo` path segments. `--repo OWNER/REPO` selects an identity when the remote does not provide one.
The skill files stay under `skillsDir`, which defaults to `~/.stow/skills`.
An existing skill name is an error because replacement could discard local edits.

## Storage in a skills repository

`init` creates the user configuration before any repository-specific storage directory.
It accepts `--skills-dir` and `--agents` and works outside a Git checkout.
With no options, it creates an editable config with the default storage path and an empty agent list.
An existing configuration stays intact. The user edits that file to change settings.
`open` and `path --mkdir` create the selected repository's storage directory after configuration.

The user can keep `skills/<owner>/<repo>/<name>/SKILL.md` in a separate GitHub repository.
`skillsDir` points to that checkout's `skills` directory.
It accepts absolute paths, home paths, and paths relative to `~/.stow`.
Local configuration holds the checkout path, so the skills repository can move between machines.
The user commits and pushes skills with Git; stow only changes the local files.

Directory symlinks support the same layout without a storage setting.
Link `~/.stow/skills` to a shared skills checkout, or link one `<owner>/<repo>` directory to a dedicated checkout.
Host links still refer to the selected overlay directory.

## Setup through an agent

`agent-instructions` prints a workflow for the coding agent that receives its output.
It includes local config state and works before initialization or outside a Git checkout.
It reports an invalid config with repair instructions instead of stopping the guide.
The command itself reads files. The agent performs initialization and asks about skill creation.
The agent identifies its host from the session and preserves existing agents and storage settings.
It explains storage before it creates or moves a skill and waits for the user's choice.
This keeps setup available through one command without a separately installed stow skill.

## Runtime and distribution

Development and tests use Bun. Bun builds one JavaScript file for Node before package creation.
The npm binary points to that file and uses a Node shebang.
This lets Node.js 20+ users run stow with npm or npx without installing Bun.
Users can run the same package with Bun through `bunx --bun`.
The implementation uses Node standard modules so both runtimes share the same CLI behavior.
Runtime performance is not guaranteed; Git subprocesses and filesystem work also affect command time.

## Host discovery paths

The `agents` array in `~/.stow/config.json` selects host discovery paths.
All supported hosts except Claude Code use `.agents/skills`; Claude Code uses `.claude/skills`.
The host catalog also lists native or legacy paths that `adopt` accepts for each configured host.
Skills adopted from those paths move to the shared output path, and the original directory is removed.
This uses each host's shared discovery support and avoids duplicate links.
`stow` creates one symlink per skill in each selected path and adds exact Git `info/exclude` patterns.
The host owns skill discovery and command completion.

`adopt` handles a skill that an agent created in the checkout.
It copies the skill to the overlay before removing the source and creating output links.
It refuses tracked skills because local Git exclusions affect untracked files.

`sync` reconciles the current checkout with the agent setting.
It removes links that point directly to a skill in the selected overlay when those links are no longer required.
`remove` checks all known host paths, including native and legacy paths, regardless of the setting.
Both operations preserve unrelated host skills.
