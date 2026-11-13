return (async () => {
  await window.__TAURI__.window.getCurrentWindow().setFocus();
  const root = "/private/tmp/openidea-db-lifecycle-20261114/fixture-a";
  await window.__TAURI__.core.invoke("project_trust_add_location", { path: root });
  const { openProject } = await import("/src/platform/project.ts");
  const { call, commands } = await import("/src/platform/ipc.ts");
  const view = await (await fetch("/src/features/database/DatabaseView.tsx")).text();
  const storeUrl = view.match(/from ["']([^"']*\/store\.ts[^"']*)["']/)[1];
  const store = await import(storeUrl);
  const { toolWindowService } = await import("/src/workbench/contributions.ts");
  await openProject(root);
  await call(commands.dbSaveSources([{ id: "lifecycle", name: "Lifecycle SQLite", driver: "sqlite", file: root + "/lifecycle.sqlite", introspection: {allSchemas:true,allDatabases:true} }]));
  await store.loadSources();
  for (let attempt = 0; attempt < 100 && !store.useDatabase.getState().sources.some(s=>s.id==="lifecycle"); attempt++)
    await new Promise(done => setTimeout(done, 10));
  toolWindowService().show("database", true);
  globalThis.__lifecycle = { root, store, call, commands };
  return { title: document.title, url: location.href, storeUrl, root, sources: store.useDatabase.getState().sources.map(s => ({id:s.id, name:s.name, driver:s.driver})), buttons: [...document.querySelectorAll("button")].map(b=>({text:b.innerText,label:b.getAttribute("aria-label"),title:b.title})).filter(b=>/dismiss|close|deactivate/i.test(b.text + b.label + b.title)) };
})();
