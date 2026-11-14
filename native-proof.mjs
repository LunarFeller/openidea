import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const [port, phase] = process.argv.slice(2);
const root = "/tmp/openidea-agent-draft-ack-20261114";
const expectedId = "ai.l0ng.openidea.dev.w06e55612e9661132";
async function rpc(command, args) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const id = randomUUID();
    const timer = setTimeout(() => { socket.close(); reject(new Error(command + " timed out")); }, 45000);
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("MCP connection failed")); });
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id, command, args })));
    socket.addEventListener("message", ({ data }) => {
      const response = JSON.parse(String(data));
      if (response.id !== id) return;
      clearTimeout(timer); socket.close();
      if (!response.success) reject(new Error(JSON.stringify(response)));
      else resolve(response);
    });
  });
}
const state = await rpc("invoke_tauri", { command: "plugin:mcp-bridge|get_backend_state" });
if (state.data.app.identifier !== expectedId) throw new Error("Wrong worktree");
const run = async script => (await rpc("execute_js", { windowLabel: "main", script: `return await (async () => {\n${script}\n})();` })).data;
const save = async (name, value) => writeFile(`${root}/${phase}-${name}.json`, JSON.stringify(value, null, 2) + "\n");
const capture = async name => {
  await run("return (async()=>{await window.__TAURI__.window.getCurrentWindow().setFocus();__agentDraftAudit.clearNotifications();await __agentDraftAudit.delay();return true;})();");
  const result = await rpc("capture_native_screenshot", { windowLabel: "main" });
  const dataUrl = typeof result.data === "string" ? result.data : result.data.dataUrl;
  await writeFile(`${root}/${phase}-${name}.png`, Buffer.from(dataUrl.split(",")[1], "base64"));
};
const init = await run(await readFile(`${root}/native-init.js`, "utf8"));
if (init.fixedSource !== (phase === "after")) throw new Error("Wrong frontend revision: " + JSON.stringify(init));
await save("init", init);
await run(await readFile(`${root}/native-matrix.js`, "utf8"));
const cases = [];
for (const home of [false,true]) {
  for (const mode of ["unchanged", "edited", "ABA", "new image", "new file", "failed edited"]) {
    const result = await run(`return __agentDraftAudit.runCase(${home},${JSON.stringify(mode)}).catch(error=>({error:String(error),stack:error.stack}));`);
    if (result.error || typeof result.passed !== "boolean") throw new Error(JSON.stringify(result));
    cases.push(result);
  }
}
const matrix = { passed: cases.filter(c=>c.passed).length, failed: cases.filter(c=>!c.passed).length, cases };
await save("native-matrix", matrix);
console.log(JSON.stringify({ phase, passed: matrix.passed, failed: matrix.failed }));
await run("return (async()=>{await __agentDraftAudit.setup(false);return __agentDraftAudit.inspect(false);})();");
await capture("1-submitted");
const pending = await run("return (async()=>{await __agentDraftAudit.send(false);await __agentDraftAudit.type('B: next unsent prompt');return __agentDraftAudit.inspect(false);})();");
await save("pending", pending);
await capture("2-pending");
const complete = await run("return (async()=>{await __agentDraftAudit.finish(false);return __agentDraftAudit.inspect(false);})();");
await save("completed", complete);
await capture("3-completed");
console.log(JSON.stringify({ phase, pending: pending.text, completed: complete.text }));
