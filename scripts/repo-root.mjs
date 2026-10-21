import path from "node:path";
import { fileURLToPath } from "node:url";

/** Resolve the repository root from a module's file URL, portably. */
export function repoRootFromModuleUrl(moduleUrl) {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..");
}
