import { defineStep, z } from "nukadoko";
import { runStow } from "./stow-cli.ts";

// init is how a person configures stow, so the scenario runs it rather than
// writing config.json itself. Both directories are scratch, so the person's
// own config and skills are never touched.
export default defineStep({
  description: "Runs `stow init --skills-dir <dir> --agents claude-code,codex` under a scratch HOME, with a scratch directory as the skills checkout.",
  pattern: "a skills checkout and stow configured for Claude Code and Codex",
  args: z.object({}),
  returns: z.object({
    home: z.string().describe("the scratch HOME stow reads ~/.stow/config.json from"),
    skillsDir: z.string().describe("the skills checkout that holds every repository's overlay"),
  }),
  mutates: true,
  async run({ scratch }) {
    const home = scratch.dir("stow-scenario-home");
    const skillsDir = scratch.dir("stow-scenario-skills");
    const { exitCode, stderr } = await runStow(["init", "--skills-dir", skillsDir, "--agents", "claude-code,codex"], home, home);
    if (exitCode !== 0) throw new Error(`stow init exited ${exitCode}: ${stderr}`);
    return { home, skillsDir };
  },
});
