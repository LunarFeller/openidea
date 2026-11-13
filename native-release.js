return (async () => {
  const audit = globalThis.__lifecycle;
  if (!audit.held || !audit.release) throw new Error("No delayed real response is ready");
  audit.release();
  await audit.pending;
  audit.commands.dbSchemas = audit.original;
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  return { connected: [...audit.store.useDatabase.getState().connected], schemas: audit.store.useDatabase.getState().schemas, backendConnected: await audit.call(audit.commands.dbConnected()), connectedDots: document.querySelectorAll('section[aria-label="Database"] [title="Connected"]').length };
})();
