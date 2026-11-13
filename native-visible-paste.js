return (async () => {
  await window.__TAURI__.window.getCurrentWindow().setFocus();
  const s = await import('/src/features/agents/store.ts');
  const { commands } = await import('/src/platform/ipc.ts');
  const n = await import('/src/workbench/notificationStore.ts');
  for (const item of n.useNotifications.getState().items) if (item.balloon) n.dismissBalloon(item.id);
  const box = document.querySelector('[role="textbox"][aria-label="Message"]');
  const view = box.cmTile.view;
  s.updateComposer(s.HOME, { images: [] });
  view.focus();
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'keep prompt' }, selection: { anchor: 0, head: 4 } });
  const original = commands.clipboardImage;
  try {
    commands.clipboardImage = async () => ({ status: 'ok', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==' });
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() });
    box.dispatchEvent(event);
    for(let i=0;i<100 && !s.composerDraft(s.HOME).images.length;i++) await new Promise(r => setTimeout(r,10));
    await new Promise(r => setTimeout(r, 50));
    const rect = box.getBoundingClientRect();
    return { title: document.title, text: view.state.doc.toString(), draft: s.composerDraft(s.HOME).text, images: s.composerDraft(s.HOME).images.length, prevented: event.defaultPrevented, box: { x:rect.x,y:rect.y,width:rect.width,height:rect.height }, viewport: { width:innerWidth,height:innerHeight }, dpr:devicePixelRatio };
  } finally { commands.clipboardImage = original; }
})();
