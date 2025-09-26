import fs from "fs";
import path from "path";
import crypto from "crypto";
import dayjs from "dayjs";
import { mkdirp } from "mkdirp";

const LOG_TO_FILE = process.env.LOG_TO_FILE === "true";
const LOG_DIR = process.env.LOG_DIR || "./data/logs";
const SALT = process.env.IP_HASH_SALT || "dev-salt-do-not-use";

export function hashIP(ip) {
  const h = crypto.createHmac("sha256", SALT).update(ip || "").digest("hex");
  // shorten to 16 bytes hex for readability
  return h.slice(0, 32);
}

function ensureDir(dir) {
  mkdirp.sync(dir);
}

function currentLogPath() {
  const date = dayjs().format("YYYY-MM-DD");
  return path.join(LOG_DIR, `visits-${date}.jsonl`);
}

export function writeVisit(record) {
  const line = JSON.stringify(record) + "\n";
  // always emit to stdout for platform logs
  process.stdout.write(line);

  if (!LOG_TO_FILE) return;

  ensureDir(LOG_DIR);
  fs.appendFileSync(currentLogPath(), line, { encoding: "utf8" });
}
