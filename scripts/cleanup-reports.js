/**
 * scripts/cleanup-reports.js
 * Automatically retains only the latest test reports and cleans up older artifacts.
 */
"use strict";
const fs = require("fs");
const path = require("path");

function cleanOldReports(reportsDir, maxKeep = 5, maxAgeDays = 3) {
  if (!fs.existsSync(reportsDir)) return;

  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  try {
    const entries = fs.readdirSync(reportsDir, { withFileTypes: true });

    // 1. Clean old artifact folders (ui_artifacts_*, api_artifacts_*, etc.)
    const artifactDirs = entries
      .filter(e => e.isDirectory() && (e.name.startsWith("ui_artifacts_") || e.name.startsWith("api_artifacts_") || e.name.startsWith("artifacts_") || e.name.startsWith("html_")))
      .map(e => ({
        name: e.name,
        path: path.join(reportsDir, e.name),
        mtime: fs.statSync(path.join(reportsDir, e.name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime); // newest first

    // Keep only the latest 2 artifact folders, delete older ones
    if (artifactDirs.length > 2) {
      const toDelete = artifactDirs.slice(2);
      for (const item of toDelete) {
        fs.rmSync(item.path, { recursive: true, force: true });
        console.log(`[Auto-Cleanup] Removed old artifacts: ${item.name}`);
      }
    }

    // 2. Clean old report files (.html, .pdf, .json, .txt) beyond maxKeep
    const fileGroups = {};
    for (const e of entries) {
      if (!e.isFile()) continue;
      const fullPath = path.join(reportsDir, e.name);
      const stat = fs.statSync(fullPath);
      const prefix = e.name.split("_202")[0] || "other";
      if (!fileGroups[prefix]) fileGroups[prefix] = [];
      fileGroups[prefix].push({ name: e.name, path: fullPath, mtime: stat.mtimeMs });
    }

    for (const prefix of Object.keys(fileGroups)) {
      const list = fileGroups[prefix].sort((a, b) => b.mtime - a.mtime);
      if (list.length > maxKeep) {
        const toDelete = list.slice(maxKeep);
        for (const f of toDelete) {
          fs.unlinkSync(f.path);
          console.log(`[Auto-Cleanup] Removed old report: ${f.name}`);
        }
      }
    }
  } catch (err) {
    console.warn(`[Auto-Cleanup] Warning: ${err.message}`);
  }
}

module.exports = { cleanOldReports };

if (require.main === module) {
  const reportsDir = path.join(__dirname, "..", "reports");
  cleanOldReports(reportsDir);
}
