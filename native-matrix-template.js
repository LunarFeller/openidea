return (async () => {
  const boundary = "__BOUNDARY__";
  const audit = globalThis.__lifecycle;
  const { store, call, commands } = audit;
  const { openProject } = await import("/src/platform/project.ts");
  const roots = ["/private/tmp/openidea-db-lifecycle-20261114/fixture-a", "/private/tmp/openidea-db-lifecycle-20261114/fixture-b"];
  for (const root of roots) await window.__TAURI__.core.invoke("project_trust_add_location", {path: root});
  const source = root => ({id:"lifecycle",name:root.endsWith("fixture-a") ? "Lifecycle SQLite" : "New project SQLite",driver:"sqlite",file:root+"/lifecycle.sqlite",introspection:{allSchemas:true,allDatabases:true}});
  const cases = [
    {name:"databases",command:"dbDatabases",load:()=>store.loadDatabases("lifecycle"),read:s=>s.databases.lifecycle},
    {name:"schemas",command:"dbSchemas",load:()=>store.loadSchemas("lifecycle"),read:s=>s.schemas.lifecycle},
    {name:"tables",command:"dbTables",load:()=>store.loadTables("lifecycle","main"),read:s=>s.tables["lifecycle\u0000main"]},
    {name:"details",command:"dbTableDetails",load:()=>store.loadDetails("lifecycle","main","customers"),read:s=>s.details["lifecycle\u0000main\u0000customers"]},
    {name:"completion",command:"dbCompletion",load:()=>store.loadCompletion("lifecycle"),read:s=>s.completion.lifecycle},
  ];
  const results = [];
  for (const spec of cases) {
    await openProject(roots[0]);
    await call(commands.dbSaveSources([source(roots[0])]));
    await store.loadSources();
    await store.disconnect("lifecycle");
    await store.connect("lifecycle");
    store.useDatabase.setState({databases:{},schemas:{},tables:{},details:{},objects:{},completion:{}});
    const original = commands[spec.command];
    let finish;
    let notifyReady;
    let answer;
    let held = false;
    const ready = new Promise(resolve => {notifyReady = resolve;});
    commands[spec.command] = async (...args) => {
      const result = await original(...args);
      if (held) return result;
      held = true;
      answer = result;
      const delayed = new Promise(resolve => {finish = () => resolve(result);});
      notifyReady();
      return delayed;
    };
    try {
      const pending = spec.load();
      await ready;
      if (boundary === "delete") await store.deleteSource("lifecycle");
      else if (boundary === "project") {
        await openProject(roots[1]);
        await call(commands.dbSaveSources([source(roots[1])]));
        await store.loadSources();
      } else {
        await store.disconnect("lifecycle");
        if (boundary === "reconnect") {
          await store.connect("lifecycle");
          const fresh = spec.load();
          if (fresh !== pending) await fresh;
        }
      }
      const expectedCache = JSON.stringify(spec.read(store.useDatabase.getState()));
      const expectedConnected = JSON.stringify([...store.useDatabase.getState().connected]);
      finish();
      const returned = await pending;
      const cache = JSON.stringify(spec.read(store.useDatabase.getState()));
      const connected = JSON.stringify([...store.useDatabase.getState().connected]);
      const completionIgnored = spec.name !== "completion" || returned === null;
      results.push({boundary,kind:spec.name,realIpcStatus:answer.status,realIpcError:answer.error?.message,passed:cache===expectedCache && connected===expectedConnected && completionIgnored,expectedCache,cache,expectedConnected,connected,backendConnected:await call(commands.dbConnected())});
    } finally { commands[spec.command] = original; }
  }
  return {boundary,results,passed:results.filter(r=>r.passed).length,total:results.length};
})();
