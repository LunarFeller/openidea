return (async () => {
  const win = window.__TAURI__.window.getCurrentWindow();
  await win.setFocus();
  const root = '/private/tmp/openidea-composer-clipboard-20261114/fixture';
  await window.__TAURI__.core.invoke('project_trust_add_location', { path: root });
  const { openProject } = await import('/src/platform/project.ts');
  await openProject(root);
  for (let i=0; i<200 && !document.querySelector('[data-editor-area]'); i++) await new Promise(r => setTimeout(r, 20));
  const s = await import('/src/features/agents/store.ts');
  s.useAgents.setState({ sessionLocation: 'editor' });
  s.openHome();
  for (let i=0; i<100 && !document.querySelector('[role="textbox"][aria-label="Message"]'); i++) await new Promise(r => setTimeout(r, 20));
  return { title: document.title, url: location.href, messageBox: !!document.querySelector('[role="textbox"][aria-label="Message"]'), popups: [...document.querySelectorAll('button')].map(b => ({ text: b.innerText, label: b.getAttribute('aria-label'), title: b.title })).filter(b => /dismiss|close|cancel/i.test(b.text+b.label+b.title)) };
})();
