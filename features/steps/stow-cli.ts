// Runs the built Node CLI, the file npm installs as `stow`, with HOME set
// to a scratch directory so the person's own ~/.stow is never read.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

export function runStow(args: string[], cwd: string, home: string): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, HOME: home } });
  if (result.error) throw result.error;
  return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}
