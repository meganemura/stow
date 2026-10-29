import { defineStep, z } from "nukadoko";
import { lstatSync } from "node:fs";
import { join } from "node:path";
import { HOST_PATHS } from "./assert-host-links.ts";
import createTargetCheckout from "./create-target-checkout.ts";
import writeGeneratedSkill from "./write-generated-skill.ts";

function present(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

// existsSync follows a link, so a dangling link would read as gone; lstat sees
// the link itself.
export default defineStep({
  description: "Lists the host paths that still hold anything under the skill's name, a dangling link included, and claims the list is empty.",
  pattern: "neither host path links to it any more",
  args: z.object({ checkout: z.string(), name: z.string() }),
  from: { checkout: [createTargetCheckout, "checkout"], name: [writeGeneratedSkill, "name"] },
  observe({}, { checkout, name }) {
    return { remaining: Object.values(HOST_PATHS).map(hostPath => `${hostPath}/${name}`).filter(path => present(join(checkout, path))) };
  },
  claims: [{ actual: "remaining", compare: "equal", expected: { literal: [] } }],
});
