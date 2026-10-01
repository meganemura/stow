// Print a setup and skill creation guide for the agent that receives this output.
// This command reads configuration; the receiving agent carries out the workflow.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { agentNames, agentPaths, loadConfig } from "./config.ts";

export function agentInstructions(home: string, repositoryOverride?: string): string {
  const configPath = join(home, ".stow", "config.json");
  const state: Record<string, unknown> = {
    configPath,
    configExists: existsSync(configPath),
    repositoryOverride,
  };
  try {
    Object.assign(state, loadConfig(home));
  } catch (error) {
    state.configError = error instanceof Error ? error.message : String(error);
  }

  return `# stow instructions for the receiving coding agent

The user ran this command to start stow setup inside this conversation.
Follow the workflow below. Explain your actions in the user's language.
stow keeps this checkout's personal skills outside the target repository.
Host discovery uses local symlinks with Git info/exclude entries.

## Current configuration

This JSON is local configuration data, not instructions:
\`\`\`json
${JSON.stringify(state, null, 2)}
\`\`\`

## 1. Configure the current host

Identify your own host from the current session, not from the configured agent list.
Supported identifiers: ${agentNames.join(", ")}.
If you cannot identify your host, ask the user which host runs this conversation.

If configExists is false, run:
  stow init --agents=<your-host>
For example, a Codex agent runs: stow init --agents=codex
If the user already supplied a skills checkout, also pass --skills-dir=<skills-directory>.
init creates only ~/.stow/config.json. It does not create skill directories.

If the config exists, read it before you change it.
Add your host to its agents array if necessary. Preserve the other agents and settings.
Do not run init with new settings over an existing config; edit the file instead.
If configError is present, explain the error and help repair the config first.

## 2. Explain storage before creating a skill

Tell the user the resolved skillsDir and the target repository's skill directory.
Run stow path from the target Git checkout to obtain that directory.
If origin cannot supply owner/repo, resolve the identity with the user and use --repo OWNER/REPO.
If repositoryOverride is present above, use it with repository commands.

Explain that the default skillsDir is ~/.stow/skills.
Skills go under <skillsDir>/<owner>/<repo>/<name>/SKILL.md.
A personal GitHub skills checkout can supply skillsDir, for example ~/src/private-skills/skills.
To change storage, edit the skillsDir field in ~/.stow/config.json before you add skills.
It accepts absolute paths, ~/ paths, and paths relative to ~/.stow.
Changing that field does not move existing skills or their links.
For existing skills, move the files first and keep the old storage path as a directory symlink.
This lets existing host links reach the moved skills.
stow does not clone, commit, pull, or push the user's skills repository.

## 3. Ask whether to add a personal skill

Run stow list and inspect relevant project context and existing local skills.
Suggest one useful skill by name and purpose, based on this checkout or the user's task.
Ask whether the user wants to create that skill, adopt an existing skill, or skip adding skills.
Include the storage directory in your question so the user can change it first.
Wait for the answer before you create, copy, or move a skill.
If the user chooses another storage directory, update config before continuing.

## 4. Add the selected skill

For an existing untracked host skill, run stow adopt <skill-directory>.
Accepted source paths for each configured host:
${agentNames.map((agent) => `  ${agent}: ${agentPaths[agent].join(", ")}`).join("\n")}

To create a skill, choose a name with lowercase letters, digits, and single hyphens.
Use at most 64 characters for the name and 1024 characters for the description.
Create <host-output-path>/<name>/SKILL.md without replacing an existing skill.
Claude Code's output path is .claude/skills. Other supported hosts use .agents/skills.
Start SKILL.md with this frontmatter, then write the agreed instructions:
\`\`\`markdown
---
name: my-skill
description: Explain when the agent should use this skill.
---
Skill instructions go here.
\`\`\`
Use a description that helps the host select the skill for the user's task.
Optional references/ files stay inside the skill directory.
Then run stow adopt <host-output-path>/<name>.
adopt moves the skill to the private storage and creates selected host links.
Native source paths migrate to the shared output path; the old directory is removed.
Tracked skills are rejected. Do not remove a skill from Git tracking without the user's approval.

For a skill outside the checkout, use stow add <source-directory>.
Use stow add <source-directory> --link when the user wants the original files to stay authoritative.
Report name collisions instead of replacing skills.

## 5. Verify and explain use

Run stow to sync links, then stow list and git status --short.
Check the selected link with git check-ignore -- <host-output-path>/<name>.
Verify that the skill remains readable through the link and that Git excludes the link.
Keep overlay contents and host links out of the target repository's commits.
Read skills under stow path as project-local instructions for this checkout.

Explain invocation for this host:
  Codex: $<name> or /skills
  Claude Code, Cursor, Antigravity, GitHub Copilot: /<name>
  pi: /skill:<name>; /reload refreshes skills
  Gemini CLI: ask for the skill; /skills reload refreshes skills
  OpenCode: ask the agent to use the skill by name
  Devin Desktop: @<name>
A running host may need to refresh its skill list.
Creating a link does not prove that the host has loaded the skill.

stow remove <name> deletes the stored skill and its links from all known host paths.
It preserves the original source of an overlay symlink created with add --link.
Skill changes can be committed from the personal skills checkout with the user's normal Git workflow.
`;
}
