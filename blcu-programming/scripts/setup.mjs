import { execSync } from "child_process";
import { join } from "path";

const binDir = process.platform === "win32" ? "Scripts" : "bin";
const pip = join(".venv", binDir, "pip");
const python = join(".venv", binDir, "python");

execSync(`python -m venv .venv`, { stdio: "inherit" });
execSync(`${pip} install -r requirements.txt`, { stdio: "inherit" });
