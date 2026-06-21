import { execSync } from "child_process";
import { join } from "path";

const binDir = process.platform === "win32" ? "Scripts" : "bin";
const python = join(".venv", binDir, "python");

execSync(`${python} -m api.main`, { stdio: "inherit" });
