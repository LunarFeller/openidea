return (() => {
  const a = globalThis.__agentDraftAudit;
  const png = { mimeType: "image/png", name: "next.png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==" };
  a.runCase = async (home, mode) => {
      await a.setup(home);
      const submitted = await a.send(home);
      const key = home ? a.store.HOME : a.task.id;
      if (mode === "edited" || mode === "failed edited") await a.type("B: next unsent prompt");
      if (mode === "ABA") { await a.type("temporary edit"); await a.type("A: submitted prompt"); }
      if (mode === "new image") a.store.updateComposer(key, { images: [png] });
      if (mode === "new file") a.store.updateComposer(key, { files: [{ path: a.task.cwd + "/package.json", rel: "package.json", attached: true }] });
      const expected = structuredClone(a.store.composerDraft(key));
      if (mode === "unchanged") Object.assign(expected, { text: "", files: [], images: [] });
      await a.finish(home, mode === "failed edited");
      const actual = a.inspect(home);
      const passed = actual.text === expected.text && JSON.stringify(actual.draft) === JSON.stringify(expected);
      return { path: home ? "new task" : "session", mode, passed, submitted, expected, actual };
  };
  return { registered: true };
})();
