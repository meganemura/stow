import { defineStep, z } from "nukadoko";
import { execFileSync } from "node:child_process";

export default defineStep({
  description: "Creates a scratch git checkout whose origin is git@github.com:alice/weather-app.git.",
  pattern: "a target checkout whose origin is a GitHub repository",
  args: z.object({}),
  returns: z.object({
    checkout: z.string().describe("the target checkout's root"),
    repository: z.string().describe("the owner/repo stow reads from origin"),
  }),
  mutates: true,
  rationale: "stow picks the overlay from the origin URL, so the checkout needs a GitHub-style remote. Nothing is fetched from it.",
  run({ scratch }) {
    const checkout = scratch.dir("stow-scenario-checkout");
    execFileSync("git", ["init", "--quiet", checkout]);
    execFileSync("git", ["-C", checkout, "remote", "add", "origin", "git@github.com:alice/weather-app.git"]);
    return { checkout, repository: "alice/weather-app" };
  },
});
