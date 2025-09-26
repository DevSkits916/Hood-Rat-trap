import fs from "fs";
import path from "path";
import crypto from "crypto";
import dayjs from "dayjs";
import { mkdirp } from "mkdirp";

const LOG_TO_FILE = process.env.LOG_TO_FILE !== "false";
const LOG_DIR = process.env.LOG_DIR || "./data/logs";
export function hashIP(ip) {
  const h = crypto.createHash("sha256").update(ip || "").digest("hex");
  // shorten to 16 bytes hex for readability
  return h.slice(0, 32);
}

function ensureDir(dir) {
  mkdirp.sync(dir);
}

function currentLogPath() {
  const date = dayjs().format("YYYY-MM-DD");
  return path.join(LOG_DIR, `visits-${date}.txt`);
}

function formatRecord(record) {
  const lines = [];
  const headerParts = [
    `[${record.ts}]`,
    record.kind ? record.kind.toUpperCase() : "EVENT"
  ];
  if (record.path) {
    headerParts.push(`path=${record.path}`);
  }
  if (record.method) {
    headerParts.push(`method=${record.method}`);
  }
  if (record.ipHash) {
    headerParts.push(`ipHash=${record.ipHash}`);
  }
  lines.push(headerParts.join(" | "));

  if (record.device?.summary) {
    lines.push(`  Device: ${record.device.summary}`);
  } else if (record.device) {
    const parts = [];
    if (record.device.vendor || record.device.model) {
      parts.push(
        [record.device.vendor, record.device.model].filter(Boolean).join(" ")
      );
    }
    if (record.device.type) {
      parts.push(`type: ${record.device.type}`);
    }
    const osSummary = [
      record.device.os?.name,
      record.device.os?.version
    ]
      .filter(Boolean)
      .join(" ");
    if (osSummary) {
      parts.push(`OS: ${osSummary}`);
    }
    const browserSummary = [
      record.device.browser?.name,
      record.device.browser?.version
    ]
      .filter(Boolean)
      .join(" ");
    if (browserSummary) {
      parts.push(`Browser: ${browserSummary}`);
    }
    if (parts.length) {
      lines.push(`  Device: ${parts.join(" | ")}`);
    }
  }

  if (record.userAgent) {
    lines.push(`  User-Agent: ${record.userAgent}`);
  }

  if (record.headers) {
    const headerLines = Object.entries(record.headers)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => `    ${key}: ${value}`);
    if (headerLines.length) {
      lines.push("  Headers:");
      lines.push(...headerLines);
    }
  }

  if (record.client) {
    const clientEntries = Object.entries(record.client);
    if (clientEntries.length) {
      lines.push("  Client payload:");
      clientEntries.forEach(([key, value]) => {
        const serialised =
          typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : value;
        lines.push(`    ${key}: ${serialised}`);
      });
    }
  }

  lines.push("---");

  return `${lines.join("\n")}\n`;
}

export function writeVisit(record) {
  const formatted = formatRecord(record);
  // always emit to stdout for platform logs
  process.stdout.write(formatted);

  if (!LOG_TO_FILE) return;

  ensureDir(LOG_DIR);
  fs.appendFileSync(currentLogPath(), formatted, { encoding: "utf8" });
}
