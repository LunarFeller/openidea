import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
const root=process.env.OPENIDEA_EVIDENCE_DIR ?? "/tmp/openidea-agent-project-verification";
const worktree=process.env.OPENIDEA_WORKTREE ?? process.cwd();
const [phase]=process.argv.slice(2);
if(!["before","after"].includes(phase))throw new Error("Expected before/after");
const status=JSON.parse(execFileSync("node",["scripts/dev-status.ts"],{cwd:worktree,encoding:"utf8"}));
if(status.bridges.length!==1)throw new Error("Expected one bridge for this worktree");
const {port}=status.bridges[0];
const identifier=status.identifier;
async function rpc(command,args){
 return await new Promise((resolve,reject)=>{
  const socket=new WebSocket(`ws://127.0.0.1:${port}`),id=randomUUID();
  const timer=setTimeout(()=>{socket.close();reject(new Error(command+" timed out"));},15000);
  socket.addEventListener("error",()=>{clearTimeout(timer);reject(new Error("MCP connection failed"));});
  socket.addEventListener("open",()=>socket.send(JSON.stringify({id,command,args})));
  socket.addEventListener("message",({data})=>{
   const response=JSON.parse(String(data));if(response.id!==id)return;
   clearTimeout(timer);socket.close();
   if(!response.success)reject(new Error(JSON.stringify(response)));else resolve(response);
  });
 });
}
const state=await rpc("invoke_tauri",{command:"plugin:mcp-bridge|get_backend_state"});
if(state.data.app.identifier!==identifier)throw new Error("Wrong worktree");
const run=async script=>(await rpc("execute_js",{windowLabel:"main",script:`return await (async()=>{\n${script}\n})();`})).data;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function job(script){
 const id=randomUUID();
 await run(`globalThis.__projectJobs??={};globalThis.__projectJobs[${JSON.stringify(id)}]={state:"running"};(async()=>{${script}})().then(value=>{globalThis.__projectJobs[${JSON.stringify(id)}]={state:"done",value};},error=>{globalThis.__projectJobs[${JSON.stringify(id)}]={state:"error",error:String(error),stack:error.stack};});return true;`);
 for(let i=0;i<150;i++){
  const result=await run(`return globalThis.__projectJobs?.[${JSON.stringify(id)}]??null;`);
  if(result?.state==="done")return result.value;
  if(result?.state==="error")throw new Error(JSON.stringify(result));
  await pause(200);
 }
 throw new Error("Native fixture job timed out");
}
const fixtureRoots={};
for(const [name,folder]of [["A","project-a"],["B","project-b"]]){
 const path=`${root}/fixtures/${folder}`;await mkdir(path,{recursive:true});
 await writeFile(`${path}/README.md`,`# ${folder}\nNative Agent project ownership fixture.\n`);
 fixtureRoots[name]=await realpath(path);
}
const init=await job(`const fixtureRoots=${JSON.stringify(fixtureRoots)};${await readFile(root+"/native-init.js","utf8")}`);
if(init.fixedSource!==(phase==="after"))throw new Error("Wrong frontend revision: "+JSON.stringify(init));
await writeFile(`${root}/${phase}-native-init.json`,JSON.stringify({identifier,port,backend:state.data,...init},null,2));
const cases=[];
for(const kind of ["create","fork"]){
 for(const failure of [false,true]){
  for(const change of ["A to B","A to B to A","reopen A","same project"]){
   const actual=await job(`const a=__projectAudit;await a.setup(${JSON.stringify(kind)});await a.send(${JSON.stringify(kind)});${change!=="same project"?`await a.change(${JSON.stringify(change)});`:""}await a.release(${failure});return a.inspect();`);
   const changed=change!=="same project";
   const expectedRoot=change==="A to B"?fixtureRoots.B:fixtureRoots.A;
   const expectedTasks=changed?["current-project"]:failure?["source-a"]:["source-a","old-a"];
   const expectedKey=changed||failure&&kind==="create"?"agent:new":failure?"agent:source-a":"agent:old-a";
   const passed=actual.root===expectedRoot && JSON.stringify(actual.taskIds)===JSON.stringify(expectedTasks)
    &&actual.active?.key===expectedKey && (changed?actual.text==="Current project draft"&&actual.homeDraft.text==="Current project draft"&&actual.draftProjectRoot===expectedRoot&&JSON.stringify(actual.history)==='["Current project history"]'&&actual.errors.length===0:failure?actual.errors.length>0:actual.errors.length===0);
   cases.push({kind,failure,change,passed,expected:{root:expectedRoot,tasks:expectedTasks,key:expectedKey},actual});
   console.log(JSON.stringify({phase,kind,failure,change,passed}));
  }
 }
}
for(const failure of [false,true]){
 const actual=await job(`const a=__projectAudit;await a.setup("create");await a.send("create",true);await a.release(false);await a.waitClosing();await a.change("A to B to A");await a.releaseClose(${failure});return a.inspect();`);
 const passed=actual.root===fixtureRoots.A&&JSON.stringify(actual.taskIds)==='["current-project"]'&&actual.active?.key==="agent:new"&&actual.text==="Current project draft"&&actual.errors.length===0;
 cases.push({kind:"create during Home close",failure,change:"A to B to A",passed,actual});
 console.log(JSON.stringify({phase,kind:"create during Home close",failure,passed}));
}
await writeFile(`${root}/${phase}-native-matrix.json`,JSON.stringify({passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length,cases},null,2));
async function capture(name){
 await job("await window.__TAURI__.window.getCurrentWindow().setFocus();__projectAudit.clearNotifications();await __projectAudit.delay();return true;");
 const result=await rpc("capture_native_screenshot",{windowLabel:"main"});
 const data=typeof result.data==="string"?result.data:result.data.dataUrl;
 await writeFile(`${root}/${phase}-${name}.png`,Buffer.from(data.split(",")[1],"base64"));
 const actual=await run("return __projectAudit.inspect();");
 await writeFile(`${root}/${phase}-${name}.json`,JSON.stringify(actual,null,2));
}
await job('await __projectAudit.setup("create");await __projectAudit.send("create");return true;');
await capture("1-requested-in-a");
await job('await __projectAudit.change("A to B");return true;');
await capture("2-current-project-b");
await job('await __projectAudit.release(false);return true;');
await capture("3-old-reply-completed");
console.log(JSON.stringify({phase,total:cases.length,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length}));
