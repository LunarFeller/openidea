import { writeFileSync } from 'node:fs';
const output = new URL('./runtime-errors.json', import.meta.url);
function describe(error) {
  return { name: error?.name, message: error?.message, stack: error?.stack, stackStr: error?.stackStr, type: error?.type, testPath: error?.__vitest_testPath, testName: error?.__vitest_testName, keys: error ? Object.keys(error) : [] };
}
export default class RuntimeErrorsReporter {
  onInit(ctx) {
    this.ctx = ctx;
    this.count = 0;
    process.once('exit', code => this.save('process-exit', undefined, code));
  }
  save(phase, errors = this.ctx?.state.getUnhandledErrors() ?? [], code) {
    writeFileSync(output, JSON.stringify({ phase, processExitCode: code ?? process.exitCode ?? 0, errorCount: errors.length, errors: errors.map(describe) }, null, 2) + '\n');
  }
  onTestModuleEnd() {
    const errors = this.ctx.state.getUnhandledErrors();
    if (errors.length > this.count) {
      this.count = errors.length;
      this.save('during-run', errors);
    }
  }
  onTestRunEnd(modules, errors, reason) {
    this.save('run-end-' + reason, errors);
  }
}
