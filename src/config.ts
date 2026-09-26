import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const platformDefaults: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: [
    path.join(
      os.homedir(),
      "Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite",
    ),
    "/Applications/Aseprite.app/Contents/MacOS/aseprite",
  ],
  win32: [
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe",
    "C:\\Program Files\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe",
  ],
  linux: [
    path.join(os.homedir(), ".steam/steam/steamapps/common/Aseprite/aseprite"),
    "/usr/bin/aseprite",
    "/usr/local/bin/aseprite",
  ],
};

function firstExecutable(candidates: string[]): string | undefined {
  return candidates.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

export function resolveAsepriteBinary(): string {
  const override = process.env.ASEPRITE_BIN?.trim();
  if (override) return override;

  const detected = firstExecutable(platformDefaults[process.platform] ?? []);
  if (detected) return detected;

  throw new Error(
    "Could not locate the Aseprite binary. Set the ASEPRITE_BIN environment variable to its absolute path.",
  );
}

export const asepriteBinaryPath = resolveAsepriteBinary();
