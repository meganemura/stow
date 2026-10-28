import type { Config } from "./archstrict.types.js";

// Public surface: other modules may import a directory module only through
// its own surface file (named by `surface` below), or through the files its own
// package.json exports map names. An import that reaches any other file in
// the directory is a violation. A directory module with no such file is
// entirely private. A module whose glob names one file is that file, so its
// entry names the file itself as its surface.
export default {
  schemaVersion: 1,
  surface: ["index.ts", "index.tsx", "index.mts", "index.cts"],
  // Kept out of analysis entirely:
  // - archstrict's own two files, which are never module content;
  // - hidden directories at any depth (.git, tool state), which tsc's own
  //   default include also skips;
  // - common noise directories that init found on disk (test).
  //   Remove one of these entries if that directory holds module content.
  exclude: [
    "archstrict.config.ts",
    "archstrict.types.ts",
    ".*/**",
    "**/.*/**",
    "test/**",
  ],
  // init declared one module per directory that holds TypeScript source and
  // one per TypeScript source file, so every file that check analyzes
  // belongs to exactly one module. This inventory is not a target
  // architecture: group files that change together (glob may be an array of
  // file paths in one directory), split a directory that holds unrelated
  // seams, then add an edges rule. Merge, rename, or remove entries freely:
  // init never rewrites this file. After an edit, run archstrict init to
  // regenerate archstrict.types.ts.
  declaredModules: [
    // Each directory and TypeScript source file directly in src/.
    { name: "agent-instructions.ts", glob: "src/agent-instructions.ts", surface: "agent-instructions.ts" },
    { name: "cli.ts", glob: "src/cli.ts", surface: "cli.ts" },
    { name: "config.ts", glob: "src/config.ts", surface: "config.ts" },
    { name: "hosts.ts", glob: "src/hosts.ts", surface: "hosts.ts" },
    // Each other top-level directory that holds TypeScript source, and each top-level TypeScript source file.
    { name: "features", glob: "features/**" },
    { name: "nukadoko.config.ts", glob: "nukadoko.config.ts", surface: "nukadoko.config.ts" },
    { name: "nukadoko.program.ts", glob: "nukadoko.program.ts", surface: "nukadoko.program.ts" },
  ],
  // The layers, bottom to top. A file may import its own layer or a lower
  // one, never a higher one.
  classify: [
    { glob: "src/config.ts", tags: ["layer:config"] },
    { glob: "src/agent-instructions.ts", tags: ["layer:command"] },
    { glob: "src/hosts.ts", tags: ["layer:command"] },
    { glob: "src/cli.ts", tags: ["layer:entry"] },
  ],
  edges: {
    order: [
      {
        tagNamespace: "layer",
        sequence: { "": ["config", "command", "entry"] },
        direction: "downward-only",
        because:
          "config.ts holds the host skill paths and the user's settings that every command reads; agent-instructions.ts prints the setup guide and hosts.ts reconciles host links, each from config alone; cli.ts parses arguments and dispatches to them, and nothing imports it",
      },
    ],
  },
  because: "archstrict init: one module per directory that holds TypeScript source and per TypeScript source file, so the first check covers every file it analyzes. This inventory is not a target architecture: name seams that change together, then add edges",
} satisfies Config;
