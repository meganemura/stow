# Overlay identity

`stow` uses the `origin` remote's two `owner/repo` path segments. `--repo OWNER/REPO` selects an identity when the remote does not provide one.
The skill files stay in the user's home directory. An existing skill name is an error because replacement could discard local edits.

The `agents` array in `~/.stow/config.json` selects host discovery paths.
Codex and Cursor use `.agents/skills`; Claude Code uses `.claude/skills`.
`stow` creates one symlink per skill in each selected path and adds exact Git `info/exclude` patterns.
The host owns skill discovery and command completion.

`adopt` handles a skill that an agent created in the checkout.
It copies the skill to the overlay before replacing the original directory with a link.
It refuses tracked skills because local Git exclusions affect untracked files.

`sync` reconciles the current checkout with the agent setting.
It removes links that point directly to a skill in the selected overlay when those links are no longer required.
`remove` checks both host paths even when the setting selects one or neither.
Both operations preserve unrelated host skills.
