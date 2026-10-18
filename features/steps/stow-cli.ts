// Runs the built Node CLI, the file npm installs as `stow`, with HOME set
// to a scratch directory so the person's own ~/.stow is never read.
import { fileURLToPath } from "node:url";
import { runCommand } from "nukadoko";

const CLI = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

export async function runStow(args: string[], cwd: string, home: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const result = await runCommand(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, HOME: home } });
  return { exitCode: result.exitCode ?? 1, stdout: result.stdout, stderr: result.stderr };
}
