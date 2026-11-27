import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function isCliEntry(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(entry);
  } catch {
    return false;
  }
}
