const fs = require("node:fs");
const vm = require("node:vm");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");
const { createHash } = require("node:crypto");

const repo = process.argv[2] || "/Users/Thomas/code/my_github/openidea-terminating-means";
const fixedSource = process.argv[3] || path.join(__dirname, "fixed-resultView.ts");
const baselineCommit = process.argv[4] || "08333bcff8e8eabe4a645337c1d79cc885dff0a5";
const sourcePath = "src/features/database/resultView.ts";
const requireFromRepo = createRequire(path.join(repo, "package.json"));
const ts = requireFromRepo("typescript");
const reviewedSha256 = "13eb86de700f7558c20a79bfee3f48d82275d6f773e2a74172e7bff886f4a723";
const fixedText = fs.readFileSync(fixedSource, "utf8");
const fixedSha256 = createHash("sha256").update(fixedText).digest("hex");
assert.equal(fixedSha256, reviewedSha256, "The fixed input must match the independently reviewed source");

function load(source) {
  const code = ts.transpileModule(source + "\nexport { divideDecimal, decimalText };", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: requireFromRepo, console });
  return exports;
}
const current = load(fixedText);
const baseline = load(cp.execFileSync("git", ["show", baselineCommit + ":" + sourcePath], {
  cwd: repo,
  encoding: "utf8",
}));
const gcd = (a, b) => {
  while (b) [a, b] = [b, a % b];
  return a;
};
let seed = 0x912af051;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
let finite = 0;
let repeating = 0;
let maximumExtraFractionDigits = 0;
function check(coefficient, divisor, exponent, negative) {
  let reduced = divisor / gcd(coefficient, divisor);
  while (reduced % 2n === 0n) reduced /= 2n;
  while (reduced % 5n === 0n) reduced /= 5n;
  const input = { digits: coefficient, exponent, negative };
  const actual = current.divideDecimal(input, divisor);
  if (reduced === 1n) {
    const numerator = (negative ? -1n : 1n) * coefficient * 10n ** BigInt(Math.max(0, exponent));
    const denominator = divisor * 10n ** BigInt(Math.max(0, -exponent));
    const actualNumerator = (actual.negative ? -1n : 1n) * actual.digits * 10n ** BigInt(Math.max(0, actual.exponent));
    const actualDenominator = 10n ** BigInt(Math.max(0, -actual.exponent));
    assert.equal(actualNumerator * denominator, numerator * actualDenominator);
    finite++;
    maximumExtraFractionDigits = Math.max(maximumExtraFractionDigits, exponent - actual.exponent);
  } else {
    const previous = baseline.divideDecimal(input, divisor);
    assert.equal(actual.digits, previous.digits);
    assert.equal(actual.exponent, previous.exponent);
    assert.equal(actual.negative, previous.negative);
    repeating++;
  }
}
for (let i = 0; i < 6000; i++) {
  const coefficient = (2n ** 64n + BigInt(random())) * (i % 4 === 0 ? 15n : 1n);
  const divisor = i % 3 === 0
    ? 2n ** BigInt(random() % 20) * 5n ** BigInt(random() % 7)
    : BigInt(random() % 100000 + 1);
  check(coefficient, divisor, random() % 1001 - 500, Boolean(random() % 2));
}
for (const [coefficient, divisor] of [
  [1n, 2n ** 31n],
  [1n, 5n ** 13n],
  [3n, 3n * 2n ** 30n],
  [9n, 9n * 5n ** 12n],
  [1n, 3n * 2n ** 30n],
  [3n, 9n * 2n ** 28n],
]) {
  for (const negative of [false, true]) check(coefficient, divisor, 16, negative);
}
const result = {
  checks: finite + repeating,
  finite_exact_fraction_checks: finite,
  repeating_quotient_identical_to_main_checks: repeating,
  maximum_extra_fraction_digits: maximumExtraFractionDigits,
  source: "Fixed reviewed source and pinned main module transpiled only in memory; no repository file edits",
  fixed_source_sha256: fixedSha256,
  baseline_commit: baselineCommit,
  result: "pass",
};
fs.writeFileSync(path.join(__dirname, "independent-review-probes.json"), JSON.stringify(result, null, 2) + "\n");
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
