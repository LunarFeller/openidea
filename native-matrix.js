return (async () => {
  await window.__TAURI__.window.getCurrentWindow().setFocus();
  const s = await import('/src/features/agents/store.ts');
  const { commands } = await import('/src/platform/ipc.ts');
  const original = commands.clipboardImage;
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const results = [];
  const cases = [
    { name: 'real-macos-empty-clipboard-result', native: true, anchor: 0, head: 4 },
    { name: 'image-partial-selection', anchor: 0, head: 4 },
    { name: 'image-full-selection', anchor: 0, head: 11 },
    { name: 'image-reversed-selection', anchor: 4, head: 0 },
    { name: 'image-caret', anchor: 4, head: 4 },
    { name: 'image-unicode-multiline', text: '保留🙂\nprompt', anchor: 0, head: 5 },
    { name: 'empty-image-reply', empty: true, anchor: 0, head: 4 },
    { name: 'failed-image-reply', fail: true, anchor: 0, head: 4 },
    { name: 'ordinary-text', textPaste: 'new', anchor: 0, head: 4 },
    { name: 'rich-text', textPaste: 'new', html: true, anchor: 0, head: 4 },
    { name: 'uri-text', uri: 'https://example.com', anchor: 0, head: 4 },
    { name: 'image-file', file: true, anchor: 0, head: 4 },
  ];
  try {
    for (const c of cases) {
      s.updateComposer(s.HOME, { images: [] });
      const box = document.querySelector('[role="textbox"][aria-label="Message"]');
      const view = box.cmTile.view;
      const text = c.text ?? 'keep prompt';
      view.focus();
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: c.anchor, head: c.head } });
      let calls = 0;
      commands.clipboardImage = async () => {
        calls++;
        if (c.native) return original();
        if (c.fail) throw new Error('test clipboard unavailable');
        return { status: 'ok', data: c.empty ? null : png };
      };
      const transfer = new DataTransfer();
      if (c.textPaste) transfer.setData('text/plain', c.textPaste);
      if (c.html) transfer.setData('text/html', '<b>new</b>');
      if (c.uri) transfer.setData('text/uri-list', c.uri);
      if (c.file) transfer.items.add(new File([Uint8Array.from(atob(png.split(',')[1]), ch => ch.charCodeAt(0))], 'shot.png', { type: 'image/png' }));
      const e = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer });
      box.dispatchEvent(e);
      const wantImage = !c.native && !c.empty && !c.fail && !c.textPaste && !c.uri;
      const deadline = Date.now()+4000;
      while (wantImage && !s.composerDraft(s.HOME).images.length && Date.now()<deadline) await new Promise(r => setTimeout(r, 10));
      await new Promise(r => setTimeout(r, 30));
      const selection = view.state.selection.main;
      const expected = c.textPaste ? 'new prompt' : c.uri ? 'https://example.com prompt' : text;
      results.push({ name: c.name, text: view.state.doc.toString(), draft: s.composerDraft(s.HOME).text, expected, selection: { anchor: selection.anchor, head: selection.head }, expectedSelection: c.textPaste || c.uri ? null : { anchor: c.anchor, head: c.head }, images: s.composerDraft(s.HOME).images.length, expectedImages: wantImage ? 1 : 0, calls, expectedCalls: c.textPaste || c.uri || c.file ? 0 : 1, dataPresent: !!e.clipboardData, types: [...e.clipboardData.types], prevented: e.defaultPrevented });
    }
  } finally { commands.clipboardImage = original; }
  return { results, limitations: 'Native macOS WebView. Empty clipboard events replay the Linux shape; image replies are stubbed except the real macOS None case. Linux native clipboard not verified.' };
})();
