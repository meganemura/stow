# stow

`stow` stores personal skills for a Git checkout outside that checkout. Each repository gets an overlay at `~/.stow/skills/<owner>/<repo>/`. `stow` reads `<owner>/<repo>` from a GitHub-style `origin` URL. Use `--repo OWNER/REPO` when the remote is missing or has a different identity.

This is a Bun TypeScript CLI. It manages skill directories. A host such as Claude Code, Codex, or Cursor must add the overlay to its normal skill discovery path. The host can then show those skills in slash completion. The CLI does not configure a host. A host should treat the output of `stow path` as project-local skills for the current checkout. Each skill must be a `<name>/SKILL.md` directory. A skill may also contain `references/`.

Do not commit overlay contents into the other checkout. The overlay belongs to the user and stays under `~/.stow/`.

## Use

Run from a Git checkout with an `origin` remote:

```sh
bun src/cli.ts path
bun src/cli.ts path --mkdir
bun src/cli.ts add /path/to/my-skill
bun src/cli.ts add /path/to/another-skill --link
bun src/cli.ts list
bun src/cli.ts open
```

`init` is an alias for `open`. Both create the overlay and print its path. `add` refuses to replace an existing skill. `list` prints the names of skill directories with `SKILL.md`. `--repo OWNER/REPO` works with each command.

For a local `stow` command, run `bun link` in this repository. Then use `stow path`, `stow add`, and the other commands from any checkout.

Run the tests with `bun test`.

## Host discovery contract

On each checkout, the host resolves the repository identity from `origin` or an explicit override. It adds `~/.stow/skills/<owner>/<repo>/` to its usual skill discovery paths. The host discovers each `<name>/SKILL.md` there as a project-local skill. It includes each skill name in slash completion. Agents should read skills under `stow path` for this repository. The host should refresh discovery when the checkout or overlay changes.
