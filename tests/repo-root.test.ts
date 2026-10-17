import assert from "node:assert/strict";
import { accessSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { repoRootFromModuleUrl } from "../scripts/repo-root.mjs";

test("repo root resolution works from file URLs on the current platform", () => {
  const scriptUrl = new URL("../scripts/e2e-ui-flow.mjs", import.meta.url);
  const root = repoRootFromModuleUrl(scriptUrl.href);
  assert.equal(root, path.resolve(process.cwd()));
  accessSync(path.join(root, "package.json"));
});
