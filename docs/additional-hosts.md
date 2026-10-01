# Additional skill hosts

Checked on 2026-10-02 against official documentation and source code.
These findings describe local clients. A local overlay does not reach a remote cloud agent.

## Discovery and invocation

Each directory below contains one folder per skill, with `<name>/SKILL.md` inside.

| Host | Preferred shared path | Native or legacy project paths | Explicit invocation and refresh |
| --- | --- | --- | --- |
| Antigravity | `.agents/skills` | `.agent/skills` is a legacy path. | `/<name>` in Antigravity 2.0 and CLI. Discovery starts with a conversation. [Official guide](https://antigravity.google/docs/skills) |
| pi | `.agents/skills` | `.pi/skills` | `/skill:<name>`; `/reload` refreshes skills. Project skills require project trust. [Guide](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md), [discovery source](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/package-manager.ts) |
| Gemini CLI | `.agents/skills` | `.gemini/skills` | Mention the skill in a request; the model calls `activate_skill`. `/skills list` lists skills; `/skills reload` refreshes them. [Official guide](https://geminicli.com/docs/cli/skills/) |
| GitHub Copilot | `.agents/skills` | `.github/skills`, `.claude/skills` | Use `/<name>` in CLI prompts or VS Code chat. CLI supports `/skills reload`. [CLI guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills), [VS Code guide](https://code.visualstudio.com/docs/agent-customization/agent-skills) |
| OpenCode | `.agents/skills` | `.opencode/skills`, `.claude/skills` | Ask for the skill by name. The agent calls its native `skill` tool. [Official guide](https://opencode.ai/docs/skills/) |
| Devin Desktop Cascade | `.agents/skills` | `.devin/skills` is preferred; `.windsurf/skills` remains a legacy path. | `@<name>` activates a skill. The Windsurf documentation URL redirects to the current Devin Desktop guide. [Official guide](https://docs.devin.ai/desktop/cascade/skills) |

Antigravity distinguishes `.agent` from `.agents` explicitly. Its guide names `.agents/skills` as the default and retains `.agent/skills` compatibility.
The guide lists the shared path for Antigravity 2.0, CLI, and IDE. [Skill locations](https://antigravity.google/docs/skills#skills-by-surface)

pi discovers shared directories from the working directory through its ancestors, stopping at the repository root.
Its source also loads `.pi/skills`. [Discovery source](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/package-manager.ts#L438)

Gemini CLI gives `.agents/skills` precedence over `.gemini/skills` within the workspace tier.
Skill activation can require consent. [Discovery and activation](https://geminicli.com/docs/cli/skills/)

## Metadata

Use YAML frontmatter with `name` and `description` for portability.
Match `name` to the folder name, and use lowercase letters, digits, and single hyphens.
OpenCode requires this match and limits names to 64 characters and descriptions to 1024 characters. [OpenCode metadata](https://opencode.ai/docs/skills/)
VS Code applies the same limits and exposes skills in its slash menu by default. [VS Code metadata](https://code.visualstudio.com/docs/agent-customization/agent-skills)

Antigravity requires a description but permits a missing name, using the folder name instead. [Frontmatter](https://antigravity.google/docs/skills)
pi skips malformed skills and skills without descriptions. It warns about most other invalid fields. [pi metadata](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md)
Gemini CLI and Copilot document both `name` and `description`. [Gemini format](https://geminicli.com/docs/cli/creating-skills/), [Copilot format](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills)
Cascade requires both fields. [Cascade format](https://docs.devin.ai/desktop/cascade/skills)

## Symlink evidence and limits

- pi explicitly follows symlinked skill directories with `statSync`. It resolves real paths to suppress duplicate files. [Loader source](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/skills.ts#L219)
- OpenCode scans skill paths with `symlink: true`. [Scanner source](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/skill/index.ts#L131)
- Gemini CLI provides `gemini skills link`, documented as a symlink operation. This supports the same directory-link model. [CLI reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/cli-reference.md#skills-management)

The cited Antigravity, Copilot, and Cascade guides establish discovery paths.
Symlink traversal for this integration remains unverified in those clients.
Treat these hosts as documented directory targets; confirm discovery in each installed client before claiming a runtime result.

The current Cascade guide describes Devin Desktop, including compatibility with the legacy `.windsurf/skills` path.
Support for `.agents/skills` in older Windsurf versions remains unverified.
Use a Devin Desktop identifier for this mapping. [Current Cascade guide](https://docs.devin.ai/desktop/cascade/skills)

## stow mapping decision

Use `.agents/skills` for the shared path supported by these current hosts.
Keep native and legacy paths available as adoption sources.
This avoids creating extra copies of the same link for one selected host.
Native paths remain useful when adopting a skill created by an older client.

The source links above follow current branches. Client versions can differ from those branches.
The stow tests can verify links and Git exclusions. They cannot verify a client's skill menu or activation behavior.
This investigation did not run a skill discovery or activation smoke test in any host UI.
