import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataSource, ProjectInfo } from "@/platform/ipc";
import { useProject } from "@/platform/project";

const backend = vi.hoisted(() => ({
  databases: vi.fn(),
  schemas: vi.fn(),
  tables: vi.fn(),
  objects: vi.fn(),
  details: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  completion: vi.fn(),
  sources: vi.fn(),
  connected: vi.fn(),
  save: vi.fn(),
  password: vi.fn(),
  sshSecret: vi.fn(),
  execute: vi.fn(),
  statements: vi.fn(),
}));
const ui = vi.hoisted(() => ({ show: vi.fn(), notify: vi.fn(), activeInput: vi.fn() }));
vi.mock("@/workbench/contributions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/workbench/contributions")>();
  return { ...actual, maybeEditorService: () => ({ activeInput: ui.activeInput }), toolWindowService: () => ({ show: ui.show }), notifications: () => ({ notify: ui.notify }) };
});
vi.mock("@/platform/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/ipc")>();
  return {
    ...actual,
    commands: {
      ...actual.commands,
      dbDatabases: backend.databases,
      dbSchemas: backend.schemas,
      dbTables: backend.tables,
      dbSchemaObjects: backend.objects,
      dbTableDetails: backend.details,
      dbConnect: backend.connect,
      dbDisconnect: backend.disconnect,
      dbCompletion: backend.completion,
      dbSources: backend.sources,
      dbConnected: backend.connected,
      dbSaveSources: backend.save,
      dbSetPassword: backend.password,
      dbSetSshSecret: backend.sshSecret,
      dbExecute: backend.execute,
      dbStatements: backend.statements,
    },
  };
});
import {
  connect,
  runSql,
  executeConsole,
  deleteSource,
  disconnect,
  loadCompletion,
  loadDatabases,
  loadDetails,
  loadSchemas,
  loadSources,
  loadTables,
  refresh,
  renameSource,
  revealInTree,
  revealOpened,
  saveSource,
  useDatabase,
  withConnection,
} from "@/features/database/store";

const initial = useDatabase.getState();
const initialProject = useProject.getState();
const pg: DataSource = { id: "pg", name: "Database", driver: "postgres" };
const other: DataSource = { id: "pg2", name: "Other", driver: "postgres" };
const projectA = { root: "/project-a" } as ProjectInfo;
const projectB = { root: "/project-b" } as ProjectInfo;
const ok = <T>(data: T) => ({ status: "ok" as const, data });
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const details = { columns: [], indexes: [], foreignKeys: [], triggers: [] };
const completion = { defaultSchema: "public", tables: [], foreignKeys: [] };
const cases = [
  {
    name: "databases",
    mock: backend.databases,
    load: (id: string) => loadDatabases(id),
    value: { current: "app", names: ["app"] },
    stale: { current: "old", names: ["old"] },
    read: (id: string) => useDatabase.getState().databases[id],
  },
  {
    name: "schemas",
    mock: backend.schemas,
    load: (id: string) => loadSchemas(id),
    value: ["public"],
    stale: ["old"],
    read: (id: string) => useDatabase.getState().schemas[id],
  },
  {
    name: "tables",
    mock: backend.tables,
    load: (id: string) => loadTables(id, "public"),
    value: [{ name: "users", kind: "table" }],
    stale: [{ name: "old", kind: "table" }],
    read: (id: string) => useDatabase.getState().tables[`${id}\u0000public`],
  },
  {
    name: "details",
    mock: backend.details,
    load: (id: string) => loadDetails(id, "public", "users"),
    value: details,
    stale: { ...details, columns: [{ name: "old" }] },
    read: (id: string) => useDatabase.getState().details[`${id}\u0000public\u0000users`],
  },
];
let savedSources: DataSource[];

function switchProject(project: ProjectInfo) {
  useProject.setState({ project });
  // The database feature's project subscription clears its visible state.
  useDatabase.setState({ ...initial, sources: [pg, other], loaded: true }, true);
}

beforeEach(() => {
  vi.resetAllMocks();
  useProject.setState({ project: projectA });
  savedSources = [pg, other];
  useDatabase.setState({ ...initial, sources: savedSources, loaded: true, connected: new Set(["pg"]) }, true);
  for (const spec of cases) spec.mock.mockResolvedValue(ok(spec.value));
  backend.connect.mockResolvedValue(ok(null));
  backend.disconnect.mockResolvedValue(ok(null));
  backend.objects.mockResolvedValue(ok({ routines: [], packages: [], sequences: [] }));
  backend.completion.mockResolvedValue(ok(completion));
  backend.sources.mockImplementation(async () => ok(savedSources));
  backend.connected.mockImplementation(async () => ok([...useDatabase.getState().connected]));
  backend.save.mockImplementation(async (sources: DataSource[]) => {
    savedSources = sources;
    return ok(null);
  });
  backend.password.mockResolvedValue(ok(null));
  backend.sshSecret.mockResolvedValue(ok(null));
  backend.execute.mockResolvedValue(ok([]));
  backend.statements.mockImplementation(async (_id: string, text: string) => ok([{ text, from: 0, to: text.length }]));
});
afterEach(() => {
  useProject.setState(initialProject, true);
  useDatabase.setState(initial, true);
});

describe("independent review probes", () => {
  it("review: renaming the project preserves pending metadata", async () => {
    const response = deferred();
    backend.schemas.mockReturnValueOnce(response.promise);
    const pending = loadSchemas("pg");
    useProject.setState({ project: { ...projectA, name: "Renamed" } });
    response.resolve(ok(["public"]));
    await pending;
    expect(useDatabase.getState().schemas.pg).toEqual({ status: "ok", value: ["public"] });
  });

  it("review: a save event must not prevent credential storage", async () => {
    backend.save.mockImplementationOnce(async (sources: DataSource[]) => {
      savedSources = sources;
      await loadSources();
      return ok(null);
    });
    await saveSource({ ...pg, host: "new-host" }, "secret", "ssh-secret");
    expect.soft(backend.password).toHaveBeenCalledWith("pg", "secret", false);
    expect(backend.sshSecret).toHaveBeenCalledWith("pg", "ssh-secret", false);
  });

  it("review: failed reconnect does not preserve the old disconnected flag", async () => {
    const response = deferred();
    backend.disconnect.mockReturnValueOnce(response.promise);
    const pending = disconnect("pg");
    backend.connect.mockRejectedValueOnce(new Error("new connection failed"));
    expect(await connect("pg")).toBe(false);
    response.resolve(ok(null));
    await pending;
    expect(useDatabase.getState().connected.has("pg")).toBe(false);
  });

  it("review: successful implicit reconnect survives the old disconnect acknowledgement", async () => {
    const response = deferred();
    backend.disconnect.mockReturnValueOnce(response.promise);
    const pending = disconnect("pg");
    await loadSchemas("pg");
    response.resolve(ok(null));
    await pending;
    expect(useDatabase.getState().schemas.pg?.status).toBe("ok");
    expect(useDatabase.getState().connected.has("pg")).toBe(true);
  });

  it("review: unrelated local connect does not keep an edited source marked connected", async () => {
    const response = deferred();
    backend.connected.mockReturnValueOnce(response.promise);
    backend.sources.mockResolvedValueOnce(ok([{ ...pg, host: "changed" }, other]));
    const pending = loadSources();
    await connect("pg2");
    response.resolve(ok([]));
    await pending;
    expect.soft(useDatabase.getState().connected.has("pg2")).toBe(true);
    expect(useDatabase.getState().connected.has("pg")).toBe(false);
  });
});


it("review: saving a source must not reconnect after a later disconnect", async () => {
  const response = deferred();
  backend.save.mockReturnValueOnce(response.promise);
  useDatabase.setState({ databases: { pg: { status: "ok", value: { current: "app", names: ["app"] } } } });
  const pending = saveSource({ ...pg, host: "changed" }, undefined);
  await disconnect("pg");
  savedSources = [{ ...pg, host: "changed" }, other];
  response.resolve(ok(null));
  await pending;
  expect(backend.databases).not.toHaveBeenCalled();
  expect(useDatabase.getState().connected.has("pg")).toBe(false);
});


it("review: whole-source refresh does not restart a disconnected child database", async () => {
  useDatabase.setState({
    connected: new Set(["pg", "pg:app", "pg:other"]),
    schemas: {
      "pg:app": { status: "ok", value: ["public"] },
      "pg:other": { status: "ok", value: ["public"] },
    },
    tables: {
      "pg:app\u0000public": { status: "ok", value: [{ name: "users", kind: "table" }] },
      "pg:other\u0000public": { status: "ok", value: [{ name: "users", kind: "table" }] },
    },
  });
  const response = deferred();
  backend.schemas.mockImplementation((id: string) => id === "pg:app" ? response.promise : Promise.resolve(ok(["public"])));
  const pending = refresh("pg");
  await vi.waitFor(() => expect(backend.schemas).toHaveBeenCalledTimes(2));
  await disconnect("pg:app");
  response.resolve(ok(["public"]));
  await pending;
  expect(backend.tables.mock.calls.map(c => c[0])).toEqual(["pg:other"]);
  expect(useDatabase.getState().schemas["pg:app"]).toBeUndefined();
});


it("review: late successful DDL does not refresh metadata after disconnect", async () => {
  const response = deferred();
  backend.execute.mockReturnValueOnce(response.promise);
  const text = "CREATE TABLE test (id int)";
  const pending = runSql("pg", [text]);
  await disconnect("pg");
  response.resolve(ok([{ statement: { text, from: 0, to: text.length }, result: null, error: null }]));
  expect(await pending).toBe(true);
  expect.soft(backend.databases).not.toHaveBeenCalled();
  expect(useDatabase.getState().output).toEqual([]);
});

it("review: old SQL is not executed in a new project after completion finishes", async () => {
  useDatabase.setState({ consoles: { "console.sql": "pg" } });
  const response = deferred();
  backend.completion.mockReturnValueOnce(response.promise);
  const text = "DELETE FROM users";
  const pending = executeConsole("console.sql", text, 0, text.length);
  await vi.waitFor(() => expect(backend.completion).toHaveBeenCalledOnce());
  switchProject(projectB);
  response.resolve(ok(completion));
  await pending;
  expect(backend.execute).not.toHaveBeenCalled();
});


it("review: querying a source's default database does not freeze a sibling connection snapshot", async () => {
  useDatabase.setState({ connected: new Set(["pg", "pg:app"]) });
  const response = deferred();
  backend.connected.mockReturnValueOnce(response.promise);
  const pending = loadSources();
  await loadSchemas("pg");
  response.resolve(ok(["pg"]));
  await pending;
  expect(useDatabase.getState().connected.has("pg")).toBe(true);
  expect(useDatabase.getState().connected.has("pg:app")).toBe(false);
});


it("review merge: undefined kind infers a view before selecting its path", async () => {
  useDatabase.setState({
    databases: { pg: { status: "ok", value: { current: "app", names: ["app"] } } },
    schemas: { pg: { status: "ok", value: ["public"] } },
    tables: { "pg\u0000public": { status: "ok", value: [{ name: "users", kind: "view" }] } },
  });
  await revealInTree("pg", "public", "users", undefined);
  expect(useDatabase.getState().treeReveal?.path.at(-1)).toBe("pg/public/views/users");
  expect(ui.show).toHaveBeenCalledWith("database");
});

it("review merge: a stale details response cannot select or focus the tree", async () => {
  useDatabase.setState({
    databases: { pg: { status: "ok", value: { current: "app", names: ["app"] } } },
    schemas: { pg: { status: "ok", value: ["public"] } },
    tables: { "pg\u0000public": { status: "ok", value: [{ name: "users", kind: "view" }] } },
  });
  const response = deferred();
  backend.details.mockReturnValueOnce(response.promise);
  const pending = revealInTree("pg", "public", "users", undefined, "id");
  expect(backend.details).toHaveBeenCalledOnce();
  await disconnect("pg");
  response.resolve(ok(details));
  await pending;
  expect(useDatabase.getState().treeReveal).toBeNull();
  expect(ui.show).not.toHaveBeenCalled();
});

it("review merge: Select Opened File delegates view selection through inferred kind", async () => {
  const { tableInput } = await import("@/features/database/tableInput");
  ui.activeInput.mockReturnValueOnce(tableInput("pg", "public", "users"));
  useDatabase.setState({
    databases: { pg: { status: "ok", value: { current: "app", names: ["app"] } } },
    schemas: { pg: { status: "ok", value: ["public"] } },
  });
  backend.tables.mockResolvedValueOnce(ok([{ name: "users", kind: "view" }]));
  await revealOpened();
  expect(useDatabase.getState().treeReveal?.path.at(-1)).toBe("pg/public/views/users");
  expect(ui.show).toHaveBeenCalledWith("database");
});

it("review merge: Select Opened File stops after disconnect while tables are pending", async () => {
  const { tableInput } = await import("@/features/database/tableInput");
  ui.activeInput.mockReturnValueOnce(tableInput("pg", "public", "users"));
  useDatabase.setState({
    databases: { pg: { status: "ok", value: { current: "app", names: ["app"] } } },
    schemas: { pg: { status: "ok", value: ["public"] } },
  });
  const response = deferred();
  backend.tables.mockReturnValueOnce(response.promise);
  const pending = revealOpened();
  await vi.waitFor(() => expect(backend.tables).toHaveBeenCalledOnce());
  await disconnect("pg");
  response.resolve(ok([{ name: "users", kind: "view" }]));
  await pending;
  expect(useDatabase.getState().treeReveal).toBeNull();
  expect(ui.show).not.toHaveBeenCalled();
});
