import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const [port, command, input, output] = process.argv.slice(2);
if (!process.env.OPENIDEA_TEST_IDENTIFIER) throw new Error("Expected worktree identifier is required");
const args = command === "execute_js"
  ? { windowLabel: "main", script: await readFile(input, "utf8") }
  : input ? JSON.parse(input) : {};
function rpc(command, args) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const id = randomUUID();
    const timer = setTimeout(() => { socket.close(); reject(new Error("MCP request timed out")); }, 45000);
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("MCP connection failed")); });
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id, command, args })));
    socket.addEventListener("message", ({data}) => {
      const response = JSON.parse(String(data));
      if (response.id !== id) return;
      clearTimeout(timer); socket.close();
      if (!response.success) reject(new Error(JSON.stringify(response)));
      else resolve(response);
    });
  });
}
const state = await rpc("invoke_tauri", { command: "plugin:mcp-bridge|get_backend_state" });
if (state.data.app.identifier !== process.env.OPENIDEA_TEST_IDENTIFIER) throw new Error("Wrong worktree MCP bridge");
const result = await rpc(command, args);
if (output && command === "capture_native_screenshot") {
  await writeFile(output, Buffer.from((typeof result.data === "string" ? result.data : result.data.dataUrl).split(",")[1], "base64"));
  console.log(JSON.stringify({ path: output, windowContext: result.windowContext }));
} else if (output) {
  await writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} else console.log(JSON.stringify(result));
