return (async () => {
  await window.__TAURI__.window.getCurrentWindow().setFocus();
  for (const path of Object.values(fixtureRoots))
    await window.__TAURI__.core.invoke("project_trust_add_location", { path });
  const project = await import("/src/platform/project.ts");
  const source = await (await fetch("/src/features/agents/SessionEditor.tsx")).text();
  const storeUrl = source.match(/from ["']([^"']*\/store\.ts[^"']*)["']/)[1];
  const store = await import(storeUrl);
  const { commands } = await import("/src/platform/ipc.ts");
  const { editorService, toolWindowService } = await import("/src/workbench/contributions.ts");
  const { clearNotifications, useNotifications } = await import("/src/workbench/notificationStore.ts");
  const provider = {
    id: "codex", name: "Fixture agent", command: "fixture", program: "fixture", args: [],
    defaultProgram: null, defaultArgs: [], loginHint: null, commandOverridden: false,
    commandEditable: true, commandReadOnlyReason: null, installed: true, env: {}, commands: [],
    source: { kind: "custom" }, config: [], thoughtLevels: {},
  };
  const makeTask = (id, root, title) => ({
    id, title, cwd: root, provider: "codex", status: "ready", isolation: "local", model: null,
    branch: null, base: null, baseCommit: null, error: null, createdMs: 0, updatedMs: 0,
    config: [], commands: [], usage: null, queue: [], capabilities: { fork: true },
  });
  const sourceTask = makeTask("source-a", fixtureRoots.A, "Source task in project-a");
  const resultTask = makeTask("old-a", fixtureRoots.A, "OLD task from project-a");
  const currentTask = root => makeTask("current-project", root, "Current project's task");
  const delay = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async (predicate, message) => {
    for (let i=0;i<150;i++) { if (predicate()) return; await delay(); }
    throw new Error(message);
  };
  const visible = el => el && el.getBoundingClientRect().height > 0 && !el.closest('[hidden], [aria-hidden="true"], [inert]');
  const box = () => [...document.querySelectorAll('[role="textbox"][aria-label="Message"]')].find(visible);
  const read = () => box()?.cmTile?.view?.state.doc.toString() ?? null;
  const type = async text => {
    await wait(()=>!!box(), "Composer missing");
    const view=box().cmTile.view;
    view.focus(); view.dispatch({selection:{anchor:0,head:view.state.doc.length}});
    if (!document.execCommand("insertText",false,text)) throw new Error("Native insertText failed");
    await wait(()=>read()===text,"Native editor did not receive text");
  };
  commands.agentProviders = async () => ({ status:"ok",data:[provider] });
  commands.agentProbe = async () => ({ status:"ok",data:null });
  commands.agentCommands = async () => ({ status:"ok",data:[] });
  commands.agentEntries = async id => ({ status:"ok",data:id==="source-a" ? [{type:"user",text:"Existing prompt in project-a",attachments:[]}] : [] });
  commands.agentChanges = async () => ({ status:"ok",data:[] });
  commands.agentGroupedChanges = async () => ({ status:"ok",data:{uncommitted:[],commits:[]} });
  commands.agentSubscribe = async () => ({ status:"ok",data:[currentTask(project.useProject.getState().project.root)] });
  let pending=null;
  let holdClose=false;
  let closing=null;
  let closingEntered=false;
  let backendSettled=false;
  const requests=[];
  const acknowledge = (kind, payload) => {
    if(pending) throw new Error("A fixture request is already pending");
    requests.push({kind,payload:structuredClone(payload)});
    return new Promise(resolve=>{pending={resolve,kind};}).finally(()=>setTimeout(()=>{backendSettled=true;},0));
  };
  commands.agentCreate = request => acknowledge("create",request);
  commands.agentFork = (id,turns) => acknowledge("fork",{id,turns});
  const editors=editorService();
  const originalClose=editors.closeInput;
  editors.closeInput=async key=>{
    const closed=await originalClose(key);
    if(key!=="agent:new" || !holdClose) return closed;
    holdClose=false; closingEntered=true;
    await new Promise((resolve,reject)=>{closing={resolve,reject};});
    return closed;
  };
  const setup=async kind=>{
    await window.__TAURI__.window.getCurrentWindow().setFocus();
    if(pending || closing) throw new Error("Previous fixture operation is still pending");
    holdClose=false; closingEntered=false; backendSettled=false;
    await project.openProject(fixtureRoots.A);
    store.disconnect(); await store.connect();
    for(const tab of editors.openTabs())
      if(["agent-home","agent-session"].includes(tab.input.kind)) await editors.closeInput(tab.input.key);
    store.useAgents.setState({
      loaded:true,error:null,tasks:new Map([[sourceTask.id,sourceTask]]),providers:[provider],
      entries:new Map([[sourceTask.id,[{type:"user",text:"Existing prompt in project-a",attachments:[]}]]]),
      composers:new Map(),history:[],draft:{provider:"codex",config:{},isolation:"local",base:null},
      sessionLocation:"editor",docked:null,homeOpen:false,lastTask:null,
    });
    if(kind==="create") store.openHome("Task requested in project-a");
    else store.openTask(sourceTask.id);
    const key=kind==="create"?"agent:new":"agent:source-a";
    await wait(()=>editors.activeInput()?.key===key && !!box(),"Source editor did not open");
    if(kind==="create") await type("Task requested in project-a");
    else await wait(()=>!!document.querySelector('button[aria-label="Fork"]'),"Fork action missing");
    clearNotifications(); await delay();
  };
  const send=async(kind,pauseClose=false)=>{
    holdClose=pauseClose;
    const label=kind==="create"?"Start":"Fork";
    await wait(()=>[...document.querySelectorAll(`button[aria-label="${label}"]`)].some(el=>visible(el)&&!el.disabled),"Action unavailable");
    [...document.querySelectorAll(`button[aria-label="${label}"]`)].find(visible).click();
    await wait(()=>!!pending,"Action did not reach the fixture backend");
    return requests.at(-1);
  };
  const change=async mode=>{
    if(mode==="reopen A") await project.closeProject();
    else await project.openProject(fixtureRoots.B);
    if(mode!=="A to B") await project.openProject(fixtureRoots.A);
    const root=project.useProject.getState().project.root;
    await wait(()=>store.useAgents.getState().loaded && store.useAgents.getState().organizeRoot===root,"Agent connection not ready");
    store.useAgents.setState({tasks:new Map([["current-project",currentTask(root)]]),entries:new Map(),history:["Current project history"]});
    store.updateDraft({provider:"codex",projectRoot:root,config:{}});
    store.openHome("Current project draft");
    await wait(()=>editors.activeInput()?.key==="agent:new" && read()==="Current project draft","Current project Home did not open");
    clearNotifications(); await delay();
  };
  const release=async failure=>{
    if(!pending) throw new Error("No request to complete");
    const current=pending;pending=null;
    current.resolve(failure?{status:"error",error:{kind:"internal",message:"OLD failure from project-a"}}:{status:"ok",data:resultTask});
    await wait(()=>backendSettled,"Backend acknowledgement did not settle");
    await delay();await delay();
  };
  const releaseClose=async failure=>{
    if(!closing) throw new Error("No pending close");
    const current=closing;closing=null;
    if(failure)current.reject(new Error("OLD close failure from project-a"));else current.resolve();
    await delay();await delay();
  };
  const inspect=()=>{
    const s=store.useAgents.getState();
    const errors=[...document.querySelectorAll('[role="alert"]')].filter(visible).map(el=>el.textContent)
      .concat(useNotifications.getState().items.filter(n=>n.level==="error").map(n=>n.body??n.title))
      .filter(text=>text.includes("OLD "));
    const r=box()?.getBoundingClientRect();
    const selected=[...document.querySelectorAll('[aria-label="Editor tabs"] [role="tab"][aria-selected="true"]')].find(visible);
    const t=selected?.getBoundingClientRect();
    return {root:project.useProject.getState().project?.root,taskIds:[...s.tasks.keys()],history:s.history,
      text:read(),homeDraft:structuredClone(store.composerDraft(store.HOME)),draftProjectRoot:s.draft.projectRoot,
      active:editors.activeInput(),errors,title:document.title,url:location.href,closingEntered,
      innerWidth,innerHeight,devicePixelRatio,
      composerRect:r&&{x:r.x,y:r.y,width:r.width,height:r.height},
      tabRect:t&&{x:t.x,y:t.y,width:t.width,height:t.height}};
  };
  globalThis.__projectAudit={setup,send,change,release,releaseClose,inspect,wait,delay,clearNotifications,fixtureRoots,
    waitClosing:()=>wait(()=>closingEntered,"Close was not reached")};
  const storeSource=await(await fetch(storeUrl)).text();
  return {storeUrl,fixedSource:storeSource.includes("const closed = await editorService().closeInput"),fixtureRoots,title:document.title,url:location.href};
})();
