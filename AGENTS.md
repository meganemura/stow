# Repository agent instructions

For this repository, read skills under the directory printed by `stow path` as project-local skills. Each skill is `<name>/SKILL.md`, with optional `references/`. Keep overlay contents in the separate personal skills repository selected by `skillsDir`, or under the default `~/.stow/skills/<owner>/<repo>/`. Commit skill changes only to that skills repository. Do not commit overlay contents or host links into the target checkout.


<!-- ARCHSTRICT_START -->
## archstrict

In projects with an `archstrict.config.ts` (module-boundary/architecture linting), run `archstrict rules <path>` BEFORE creating a file or adding an import - it reports the module, tags, and constraints that would govern that path, even before it exists. Run `archstrict check` after editing to confirm.

The full rule reference (every rule's evidence/because/do shape, the config schema, the pre-edit query) is at `node_modules/archstrict/skills/archstrict/SKILL.md` when installed via npm - read it before configuring `archstrict.config.ts`, or when a violation's `do:` text alone isn't enough.

If there is no `archstrict.config.ts`, skip archstrict entirely - it may not be installed here.
<!-- ARCHSTRICT_END -->
