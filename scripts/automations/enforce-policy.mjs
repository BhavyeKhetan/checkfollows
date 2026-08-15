import { loadPolicy, assertAllowedChanges, runRequiredChecks, run, template } from "./lib/policy.mjs";

const id = process.argv[2];
if (!id) {
  throw new Error("Usage: node scripts/automations/enforce-policy.mjs <automation_id> [--no-checks] [--write-back]");
}

const noChecks = process.argv.includes("--no-checks");
const writeBack = process.argv.includes("--write-back");
const policy = loadPolicy(id);
const enableAutoMerge = String(process.env.AUTOMATION_AUTO_MERGE || "").toLowerCase() === "true";

if (!noChecks) {
  runRequiredChecks(policy);
}

const files = assertAllowedChanges(policy);
console.log(JSON.stringify({ automation_id: id, changed_files: files }, null, 2));

if (!writeBack) {
  process.exit(0);
}

if (files.length === 0) {
  console.log(`No changes to write back for ${id}.`);
  process.exit(0);
}

run("git config user.name \"Codex Bhavye Khetan\"");
run("git config user.email \"64077316+BhavyeKhetan@users.noreply.github.com\"");

if (policy.mode === "pr_only") {
  const branch = template(policy.branch_name, policy);
  run(`git checkout -b ${branch}`);
}

run("git add -A");
const staged = run("git diff --cached --name-only", { capture: true })
  .split(/\r?\n/)
  .filter(Boolean);
if (staged.length === 0) {
  console.log(`No staged changes to commit for ${id}.`);
  process.exit(0);
}

run(`git commit -m ${JSON.stringify(template(policy.commit_message, policy))}`);

if (policy.mode === "autoship_main") {
  run("git push origin HEAD:main");
} else {
  const branch = template(policy.branch_name, policy);
  run(`git push -u origin ${branch}`);
  const title = template(policy.commit_message, policy);
  const prUrl = run(
    `gh pr create --title ${JSON.stringify(title)} --body ${JSON.stringify(
      `Automated ${id} run. Review generated files before merging.`,
    )} --base main --head ${branch}`,
    { capture: true },
  );
  run(`gh pr edit ${JSON.stringify(prUrl)} --add-label codex --add-label codex-automation || true`);
  if (enableAutoMerge) {
    run(
      `gh pr merge ${JSON.stringify(prUrl)} --auto --merge --delete-branch || gh pr merge ${JSON.stringify(
        prUrl,
      )} --merge --delete-branch`,
    );
  }
}
