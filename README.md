# stow

`stow` stores personal skills for a Git checkout outside that checkout.
Keep these skills in your own GitHub repository and use its checkout as the storage directory.
Each target repository gets its own `<owner>/<repo>/` directory there.
`stow` reads this identity from the target's GitHub-style `origin` URL.
Use `--repo OWNER/REPO` when the remote is missing or has a different identity.

This Bun TypeScript CLI connects personal skills to Claude Code, Codex, and Cursor through their project skill discovery paths.
Each skill must have a `<name>/SKILL.md` file. The file must declare a matching `name` and a `description` in YAML frontmatter.
A skill may also contain `references/`.

Do not commit overlay contents or host links into the other checkout.
The overlay belongs to the user and stays in the separate skills checkout.

## Set up a personal skills repository

Install Bun 1.4.2 or later, then install the CLI:

```sh
bun add --global @meganemura/stow
stow --help
```

Create your own GitHub repository for your skills, then clone it locally.
Use this layout to keep skills specific to each target repository:

```text
private-skills/
  skills/
    alice/
      project/
        my-skill/
          SKILL.md
          references/
    bob/
      another-project/
        another-skill/
          SKILL.md
```

Create the configuration before you create any skill storage directories:

```sh
stow init --skills-dir ~/src/private-skills/skills --agents codex,claude-code,cursor
```

You can run `init` from any directory. It creates `~/.stow/config.json` with these settings:

```json
{
  "agents": ["codex", "claude-code", "cursor"],
  "skillsDir": "~/src/private-skills/skills"
}
```

`skillsDir` accepts absolute paths and `~/` paths.
`stow init` with no options creates a config you can edit before you use stow.
It creates no skill storage directories and preserves an existing config.
To change an existing setting, edit `~/.stow/config.json`.
Relative paths start at `~/.stow/`, not at the current checkout.
If you omit `skillsDir`, it defaults to `~/.stow/skills`.
You can symlink that default directory to your skills checkout instead:

```sh
mkdir -p ~/.stow
ln -s ~/src/private-skills/skills ~/.stow/skills
```

Use this command when `~/.stow/skills` does not already exist.
If it contains skills, first move them into the skills checkout.
Keeping the same symlink path lets existing host links reach the moved skills.

For one skills repository per target, link the target's overlay directory:

```text
project-skills/
  skills/
    my-skill/
      SKILL.md
```

```sh
mkdir -p ~/.stow/skills/alice
ln -s ~/src/project-skills/skills ~/.stow/skills/alice/project
```

In this layout, omit `skillsDir` and keep each dedicated checkout outside the target checkout.
The `alice/project` directory link selects that target's skills repository.

## Configure host discovery

| Agent | Discovery path in the checkout | Invocation |
| --- | --- | --- |
| Codex | `.agents/skills/<name>` | `$name` or `/skills` |
| Claude Code | `.claude/skills/<name>` | `/name` |
| Cursor | `.agents/skills/<name>` | `/name` |

Codex and Cursor share one discovery path.
Without the config file, `stow` stores skills but creates no host links.
The host must scan a linked skill before it appears in its command menu.
An open host session may need to refresh its skill list after a new link appears.

## Use

`stow --help` includes the setup, workflow, commands, and skill format.

Run `bun link` in this repository to make `stow` available as a local command.
Then run it from the target Git checkout with an `origin` remote.

To keep a generated skill private, adopt it from a configured host discovery path:

```sh
stow adopt .agents/skills/my-skill
stow list
stow remove my-skill
```

`adopt` copies the skill to the overlay, then replaces the original directory with a symlink.
With `skillsDir`, the copied files go directly into your skills repository checkout.
It creates links at the other configured host paths too.
It adds exact Git `info/exclude` patterns for the links, so normal `git status` and `git add` omit them.
It refuses tracked skills because Git exclusions apply only to untracked files.
Git can still add an ignored link with `git add -f`.

To use a skill from another directory, or restore links in another checkout:

```sh
stow add /path/to/my-skill
stow add /path/to/another-skill --link
stow
```

`add` copies a skill to the overlay and creates the configured host links.
`add --link` links the source into the overlay instead of copying it.
Both `add` and `adopt` refuse an existing overlay entry or a conflicting host skill.
With no command, `stow` runs `sync` to update links for the current checkout.
Run `stow sync` after you change the agent setting.
These commands keep unrelated host skills intact.

Edit a linked skill in either checkout; both paths reach the same files.
Commit and push skill changes from the skills repository with your usual Git workflow.
`stow` changes files locally. It does not clone, commit, pull, or push that repository.
After you pull new skills on another machine, run `stow` in the target checkout to create its host links.

`remove` deletes the overlay entry and checks both host paths, regardless of the current agent setting.
When the overlay is a Git checkout, the deletion appears in that skills repository's Git status.
It removes links that point to that overlay entry and the exclusions added by stow.
It preserves the source directory of an overlay symlink.
Other checkouts of the same repository can retain broken links; run `stow sync` there to remove them.

`path` prints the overlay path. `path --mkdir` creates it first.
`open` creates the overlay and prints its path.
`init` creates the user config and prints its path.
`list` prints the skill names. `--repo OWNER/REPO` works with commands that select a target repository.

Run the tests with `bun test`.

The package name is `@meganemura/stow`; its CLI command is `stow`.
The npm package contains TypeScript source and uses Bun at runtime.
If you install it with npm, install Bun separately before you run `stow`.

## Host discovery contract

`stow` resolves the repository identity and links each overlay skill into the selected host's normal project skill discovery path.
The host discovers each `<name>/SKILL.md` there as a project-local skill and supplies its command completion.
Agents should read skills under `stow path` for this repository.
The host should refresh discovery when the checkout or overlay changes.
