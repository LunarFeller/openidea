return (async () => {
  await window.__TAURI__.window.getCurrentWindow().setFocus();
  const root = "/private/tmp/openidea-agent-draft-ack-20261114/native-fixture";
  await window.__TAURI__.core.invoke("project_trust_add_location", { path: root });
  const { openProject } = await import("/src/platform/project.ts");
  const source = await (await fetch("/src/features/agents/SessionEditor.tsx")).text();
  const storeUrl = source.match(/from ["']([^"']*\/store\.ts[^"']*)["']/)[1];
  const store = await import(storeUrl);
  const { commands } = await import("/src/platform/ipc.ts");
  const { clearNotifications } = await import("/src/workbench/notificationStore.ts");
  const { editorService } = await import("/src/workbench/contributions.ts");
  const task = {
    id: "draft-ack-native", title: "Draft acknowledgement", provider: "codex", status: "ready", isolation: "local",
    model: null, cwd: root, branch: null, base: null, baseCommit: null, error: null,
    createdMs: 0, updatedMs: 0, config: [], commands: [], usage: null, queue: [],
  };
  const provider = {
    id: "codex", name: "Codex", command: "codex", program: "codex", args: [],
    defaultProgram: null, defaultArgs: [], loginHint: null, commandOverridden: false,
    commandEditable: true, commandReadOnlyReason: null, installed: true, env: {}, commands: [],
    source: { kind: "custom" }, config: [], thoughtLevels: {},
  };
  commands.agentProviders = async () => ({ status: "ok", data: [provider] });
  commands.agentProbe = async () => ({ status: "ok", data: null });
  commands.agentCommands = async () => ({ status: "ok", data: [] });
  commands.agentEntries = async () => ({ status: "ok", data: [] });
  commands.agentChanges = async () => ({ status: "ok", data: [] });
  commands.agentSubscribe = async () => ({ status: "ok", data: [task] });
  const delay = () => new Promise(resolve => setTimeout(resolve, 80));
  const wait = async (predicate, message) => {
    for (let i=0; i<100; i++) { if (predicate()) return; await delay(); }
    throw new Error(message);
  };
  let pending = null;
  const requests = [];
  const acknowledge = (kind, payload, now) => {
    if (pending) throw new Error("Previous acknowledgement still pending");
    const request = { kind, payload: structuredClone(payload), now };
    requests.push(request);
    return new Promise(resolve => { pending = { request, resolve }; });
  };
  commands.agentCreate = request => acknowledge("create", request.prompt, null);
  commands.agentPrompt = (id, prompt, now) => acknowledge("prompt", prompt, now);
  await openProject(root);
  await store.connect();
  const box = () => [...document.querySelectorAll('[role="textbox"][aria-label="Message"]')].find(el => el.getBoundingClientRect().height > 0 && !el.closest('[hidden], [aria-hidden="true"], [inert]'));
  const read = () => box()?.cmTile?.view?.state.doc.toString() ?? null;
  const type = async text => {
    const el = box();
    if (!el) throw new Error("Composer missing");
    const view = el.cmTile.view;
    view.focus();
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    if (!document.execCommand("insertText", false, text)) throw new Error("Native insertText failed");
    await wait(() => read() === text, "Native typing did not reach CodeMirror");
  };
  const setup = async home => {
    if (pending) throw new Error("Previous acknowledgement still pending");
    for (const tab of editorService().openTabs()) {
      if (tab.input.kind === "agent-home" || tab.input.kind === "agent-session") await editorService().closeInput(tab.input.key);
    }
    store.useAgents.setState({
      loaded: true, error: null, providers: [provider], tasks: new Map([[task.id, task]]),
      entries: new Map([[task.id, []]]), composers: new Map(), unread: new Set(),
      draft: { provider: "codex", config: {}, isolation: "local", base: null },
      sessionLocation: "editor", history: [],
    });
    if (home) store.openHome(); else store.openTask(task.id);
    await wait(() => !!box(), "Composer did not open");
    await type("A: submitted prompt");
    clearNotifications();
    await delay();
  };
  const send = async home => {
    const button = document.querySelector(`button[aria-label="${home ? "Start" : "Send"}"]`);
    await wait(() => button && !button.disabled, "Submit button disabled");
    button.click();
    await wait(() => !!pending, "Submit did not reach the local acknowledgement fixture");
    return structuredClone(pending.request);
  };
  const finish = async (home, failure = false) => {
    if (!pending) throw new Error("No acknowledgement is pending");
    const current = pending;
    pending = null;
    current.resolve(failure
      ? { status: "error", error: { kind: "internal", message: "Local send failed" } }
      : { status: "ok", data: home ? task : null });
    await delay(); await delay();
    if (home && !failure) {
      store.openHome();
      await wait(() => !!box(), "Home did not reopen");
    }
    clearNotifications();
    await delay();
  };
  const inspect = home => {
    const draft = store.composerDraft(home ? store.HOME : task.id);
    const r = box()?.getBoundingClientRect();
    return { text: read(), draft: structuredClone(draft), rect: r && {x:r.x,y:r.y,width:r.width,height:r.height}, innerWidth, innerHeight, devicePixelRatio };
  };
  globalThis.__agentDraftAudit = { store, commands, task, delay, setup, send, finish, type, inspect, requests, clearNotifications };
  const storeSource = await (await fetch(storeUrl)).text();
  return { root, title: document.title, url: location.href, storeUrl, fixedSource: storeSource.includes("function clearSubmittedComposer") };
})();
