import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();

function stripQuotes(value) {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parsePolicyYaml(source) {
  const result = {};
  let currentList = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, "");
    if (!withoutComment.trim()) continue;

    const listMatch = withoutComment.match(/^\s*-\s+(.*)$/);
    if (listMatch) {
      if (!currentList) {
        throw new Error(`Policy list item without key: ${rawLine}`);
      }
      result[currentList].push(stripQuotes(listMatch[1]));
      continue;
    }

    const keyMatch = withoutComment.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!keyMatch) {
      throw new Error(`Unsupported policy line: ${rawLine}`);
    }

    const [, key, value = ""] = keyMatch;
    if (value.trim() === "") {
      result[key] = [];
      currentList = key;
    } else {
      result[key] = stripQuotes(value);
      currentList = null;
    }
  }

  return result;
}

export function loadPolicy(id) {
  const policyPath = path.join(ROOT, ".agents", "automations", `${id}.yaml`);
  if (!fs.existsSync(policyPath)) {
    throw new Error(`Automation policy not found: ${policyPath}`);
  }
  const policy = parsePolicyYaml(fs.readFileSync(policyPath, "utf8"));
  validatePolicy(policy, id);
  return policy;
}

function validatePolicy(policy, expectedId) {
  if (policy.id !== expectedId) {
    throw new Error(`Policy id mismatch: expected ${expectedId}, got ${policy.id || "missing"}`);
  }
  if (!["autoship_main", "pr_only"].includes(policy.mode)) {
    throw new Error(`Unsupported automation mode: ${policy.mode || "missing"}`);
  }
  for (const key of ["allowed_paths", "required_checks", "outputs"]) {
    if (!Array.isArray(policy[key])) throw new Error(`Policy ${key} must be a list`);
  }
  for (const key of ["commit_message", "branch_name"]) {
    if (typeof policy[key] !== "string" || !policy[key].trim()) {
      throw new Error(`Policy ${key} is required`);
    }
  }
}

export function run(command, options = {}) {
  const result = spawnSync(command, {
    cwd: ROOT,
    shell: true,
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8",
    env: { ...process.env, ...(options.env || {}) },
  });
  if (result.status !== 0) {
    const message = options.capture
      ? `${command}\n${result.stdout || ""}${result.stderr || ""}`
      : command;
    throw new Error(`Command failed: ${message}`);
  }
  return options.capture ? String(result.stdout || "").trim() : "";
}

export function changedFiles() {
  const tracked = run("git diff --name-only HEAD --", { capture: true })
    .split(/\r?\n/)
    .filter(Boolean);
  const untracked = run("git ls-files --others --exclude-standard", { capture: true })
    .split(/\r?\n/)
    .filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

export function globToRegex(glob) {
  let output = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];
    if (char === "*" && next === "*") {
      output += ".*";
      index += 1;
    } else if (char === "*") {
      output += "[^/]*";
    } else {
      output += escapeRegex(char);
    }
  }
  return new RegExp(`^${output}$`);
}

export function assertAllowedChanges(policy) {
  const files = changedFiles();
  const matchers = policy.allowed_paths.map(globToRegex);
  const disallowed = files.filter((file) => !matchers.some((matcher) => matcher.test(file)));
  if (disallowed.length) {
    throw new Error(
      `Automation ${policy.id} changed files outside allowed_paths:\n${disallowed.join("\n")}`,
    );
  }
  return files;
}

export function runRequiredChecks(policy) {
  for (const command of policy.required_checks) {
    run(command);
  }
}

export function template(value, policy) {
  const date = process.env.AUTOMATION_REPORT_DATE || new Date().toISOString().slice(0, 10);
  const runId = process.env.GITHUB_RUN_ID || String(Date.now());
  return String(value)
    .replaceAll("{date}", date)
    .replaceAll("{id}", policy.id)
    .replaceAll("{run_id}", runId);
}
