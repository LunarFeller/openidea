return (async () => {
  const audit = globalThis.__lifecycle;
  const { store } = audit;
  await store.connect("lifecycle");
  const original = audit.commands.dbSchemas;
  audit.original = original;
  audit.held = false;
  audit.commands.dbSchemas = async function(id) {
    const result = await original(id);
    if (id === "lifecycle" && !audit.held) {
      audit.held = true;
      audit.backendAnswer = result;
      return new Promise(resolve => { audit.release = () => resolve(result); });
    }
    return result;
  };
  const source = store.useDatabase.getState().sources.find(s => s.id === "lifecycle");
  store.useDatabase.setState({ selectedSource: "lifecycle", selectedNode: {kind:"source",key:"lifecycle",source}, treeExpanded: new Set(["lifecycle"]) });
  audit.pending = store.loadSchemas("lifecycle");
  return { started: true, url: location.href };
})();
