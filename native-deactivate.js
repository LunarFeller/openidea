return (async () => {
  const button = document.querySelector('button[aria-label="Deactivate"]');
  if (!button || button.disabled) throw new Error("Deactivate button is unavailable");
  button.click();
  const audit = globalThis.__lifecycle;
  for (let attempt = 0; attempt < 100 && audit.store.useDatabase.getState().connected.has("lifecycle"); attempt++)
    await new Promise(done => setTimeout(done, 20));
  await window.__TAURI__.window.getCurrentWindow().setFocus();
  return { connected: [...audit.store.useDatabase.getState().connected], schemas: audit.store.useDatabase.getState().schemas, backendConnected: await audit.call(audit.commands.dbConnected()) };
})();
