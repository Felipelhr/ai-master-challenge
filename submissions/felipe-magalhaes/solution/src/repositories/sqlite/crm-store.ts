import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { historicalStatus, type CrmDeal, type DealStatus } from "@/domain/deals/deal";
import type { Task } from "@/domain/tasks/task";
import type { Tag, DealTag } from "@/domain/tags/tag";
import type { Note } from "@/domain/notes/note";
import { DEFAULT_FUNNEL_ID, type Funnel, type PipelineStage } from "@/domain/pipeline/stage";
import type { FunnelsRepository } from "@/repositories/pipeline/funnels-repository";
import type { OperationalDealsRepository } from "@/repositories/deals/deals-repository";
import type { TasksRepository } from "@/repositories/tasks/tasks-repository";
import type { TagsRepository } from "@/repositories/tags/tags-repository";
import type { NotesRepository } from "@/repositories/notes/notes-repository";
import type { PipelineStagesRepository } from "@/repositories/pipeline/stages-repository";

const DEFAULT_STAGES = [
  ["prospecting", "Prospecção", 0, "OPEN"],
  ["engaging", "Em negociação", 1, "OPEN"],
] as const;

export interface CrmStore {
  deals: OperationalDealsRepository;
  tasks: TasksRepository;
  tags: TagsRepository;
  notes: NotesRepository;
  stages: PipelineStagesRepository;
  funnels: FunnelsRepository;
  getMeta(key: string): string | null;
  setMeta(key: string, value: string): void;
  transaction<T>(work: () => T): T;
  close(): void;
}

function decode<T>(value: unknown): T { return JSON.parse(String(value)) as T; }

export function createCrmStore(filename = process.env.ARENA_DB_PATH ?? path.join(process.cwd(), "data", "arena-operations.sqlite")): CrmStore {
  if (filename !== ":memory:") mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS new_deals (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deal_overrides (deal_id TEXT PRIMARY KEY, stage_id TEXT NOT NULL, engage_date TEXT);
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      due_at TEXT, status TEXT NOT NULL CHECK(status IN ('PENDING','COMPLETED')),
      source TEXT NOT NULL CHECK(source IN ('USER','SYSTEM_ACTION')),
      action_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT,
      UNIQUE(deal_id, source, action_code)
    );
    CREATE INDEX IF NOT EXISTS tasks_deal_status_due ON tasks(deal_id, status, due_at);
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('SYSTEM','USER')), created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deal_tags (
      deal_id TEXT NOT NULL, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY(deal_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS deal_tags_tag ON deal_tags(tag_id);
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, content TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notes_deal ON notes(deal_id);
    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('OPEN','WON','LOST')),
      is_default INTEGER NOT NULL, active INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS funnels (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);
  if (!db.prepare("PRAGMA table_info(deal_overrides)").all().some((row) => row.name === "engage_date")) db.exec("ALTER TABLE deal_overrides ADD COLUMN engage_date TEXT");
  if (!db.prepare("PRAGMA table_info(deal_overrides)").all().some((row) => row.name === "status")) db.exec("ALTER TABLE deal_overrides ADD COLUMN status TEXT");
  if (!db.prepare("PRAGMA table_info(deal_overrides)").all().some((row) => row.name === "funnel_id")) db.exec("ALTER TABLE deal_overrides ADD COLUMN funnel_id TEXT");
  if (!db.prepare("PRAGMA table_info(pipeline_stages)").all().some((row) => row.name === "funnel_id")) db.exec(`ALTER TABLE pipeline_stages ADD COLUMN funnel_id TEXT NOT NULL DEFAULT '${DEFAULT_FUNNEL_ID}'`);
  const epoch = "2026-09-24T00:00:00.000Z";
  db.prepare("INSERT OR IGNORE INTO funnels VALUES (?, ?, ?, ?)").run(DEFAULT_FUNNEL_ID, "Pipeline Comercial", epoch, epoch);
  const stageInsert = db.prepare("INSERT OR IGNORE INTO pipeline_stages(id,name,sort_order,category,is_default,active,created_at,funnel_id) VALUES (?,?,?,?,1,1,?,?)");
  for (const [id, name, order, category] of DEFAULT_STAGES) stageInsert.run(id, name, order, category, epoch, DEFAULT_FUNNEL_ID);
  db.exec("UPDATE pipeline_stages SET active=0 WHERE category IN ('WON','LOST')");
  db.exec("CREATE INDEX IF NOT EXISTS pipeline_stages_funnel_order ON pipeline_stages(funnel_id,sort_order)");

  const taskFromRow = (row: Record<string, unknown>): Task => ({
    id: String(row.id), dealId: String(row.deal_id), title: String(row.title), description: row.description === null ? null : String(row.description),
    dueAt: row.due_at === null ? null : String(row.due_at), status: row.status as Task["status"], source: row.source as Task["source"],
    actionCode: row.action_code === null ? null : String(row.action_code), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    completedAt: row.completed_at === null ? null : String(row.completed_at),
  });
  const tagFromRow = (row: Record<string, unknown>): Tag => ({ id: String(row.id), name: String(row.name), color: String(row.color), type: row.type as Tag["type"], createdAt: String(row.created_at) });
  const noteFromRow = (row: Record<string, unknown>): Note => ({ id: String(row.id), dealId: String(row.deal_id), content: String(row.content), createdAt: String(row.created_at), updatedAt: String(row.updated_at) });
  const stageFromRow = (row: Record<string, unknown>): PipelineStage => ({ id: String(row.id), funnelId: String(row.funnel_id), name: String(row.name), order: Number(row.sort_order), category: row.category as PipelineStage["category"], isDefault: Boolean(row.is_default), active: Boolean(row.active), createdAt: String(row.created_at) });
  const funnelFromRow = (row: Record<string, unknown>): Funnel => ({ id: String(row.id), name: String(row.name), createdAt: String(row.created_at), updatedAt: String(row.updated_at) });

  return {
    deals: {
      listNew: () => db.prepare("SELECT payload FROM new_deals").all().map((row) => {
        const deal = decode<CrmDeal>(row.payload);
        const legacyStage = deal.stageId ? db.prepare("SELECT category FROM pipeline_stages WHERE id=?").get(deal.stageId) : null;
        const status: DealStatus = deal.status ?? (legacyStage?.category === "WON" ? "WON" : legacyStage?.category === "LOST" ? "LOST" : historicalStatus(deal.stage));
        return { ...deal, status, funnelId: deal.funnelId ?? DEFAULT_FUNNEL_ID, stageId: legacyStage && legacyStage.category !== "OPEN" ? null : deal.stageId };
      }),
      listOverrides: () => new Map(db.prepare("SELECT deal_id, stage_id, engage_date, status, funnel_id FROM deal_overrides").all().map((row) => {
        const stageId = String(row.stage_id);
        const legacy = db.prepare("SELECT category FROM pipeline_stages WHERE id=?").get(stageId);
        const status = row.status ? String(row.status) as DealStatus : legacy?.category === "WON" ? "WON" : legacy?.category === "LOST" ? "LOST" : "OPEN";
        return [String(row.deal_id), { stageId: legacy && legacy.category !== "OPEN" ? null : stageId || null, funnelId: row.funnel_id ? String(row.funnel_id) : DEFAULT_FUNNEL_ID, engageDate: row.engage_date === null ? null : String(row.engage_date), status }] as const;
      })),
      saveNew: (deal) => { db.prepare("INSERT INTO new_deals(id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").run(deal.id, JSON.stringify(deal)); },
      saveOverride: (dealId, value) => { db.prepare("INSERT INTO deal_overrides(deal_id,stage_id,engage_date,status,funnel_id) VALUES (?,?,?,?,?) ON CONFLICT(deal_id) DO UPDATE SET stage_id=excluded.stage_id,engage_date=excluded.engage_date,status=excluded.status,funnel_id=excluded.funnel_id").run(dealId,value.stageId ?? "",value.engageDate,value.status,value.funnelId); },
    },
    tasks: {
      list: () => db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all().map(taskFromRow),
      find: (id) => { const row = db.prepare("SELECT * FROM tasks WHERE id=?").get(id); return row ? taskFromRow(row) : null; },
      save: (task) => { db.prepare(`INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, due_at=excluded.due_at,
        status=excluded.status, updated_at=excluded.updated_at, completed_at=excluded.completed_at`).run(
          task.id, task.dealId, task.title, task.description, task.dueAt, task.status, task.source, task.actionCode, task.createdAt, task.updatedAt, task.completedAt,
        ); },
      delete: (id) => { db.prepare("DELETE FROM tasks WHERE id=?").run(id); },
    },
    tags: {
      list: () => db.prepare("SELECT * FROM tags ORDER BY type, name").all().map(tagFromRow),
      listLinks: () => db.prepare("SELECT deal_id, tag_id FROM deal_tags").all().map((row): DealTag => ({ dealId: String(row.deal_id), tagId: String(row.tag_id) })),
      find: (id) => { const row = db.prepare("SELECT * FROM tags WHERE id=?").get(id); return row ? tagFromRow(row) : null; },
      save: (tag) => { db.prepare("INSERT INTO tags VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color").run(tag.id, tag.name, tag.color, tag.type, tag.createdAt); },
      attach: (link) => { db.prepare("INSERT OR IGNORE INTO deal_tags VALUES (?, ?)").run(link.dealId, link.tagId); },
      detach: (link) => { db.prepare("DELETE FROM deal_tags WHERE deal_id=? AND tag_id=?").run(link.dealId, link.tagId); },
    },
    notes: {
      list: () => db.prepare("SELECT * FROM notes ORDER BY created_at DESC").all().map(noteFromRow),
      find: (id) => { const row = db.prepare("SELECT * FROM notes WHERE id=?").get(id); return row ? noteFromRow(row) : null; },
      save: (note) => { db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at").run(note.id, note.dealId, note.content, note.createdAt, note.updatedAt); },
      delete: (id) => { db.prepare("DELETE FROM notes WHERE id=?").run(id); },
    },
    stages: {
      list: () => db.prepare("SELECT * FROM pipeline_stages ORDER BY funnel_id, sort_order, created_at").all().map(stageFromRow),
      find: (id) => { const row = db.prepare("SELECT * FROM pipeline_stages WHERE id=?").get(id); return row ? stageFromRow(row) : null; },
      save: (stage) => { db.prepare(`INSERT INTO pipeline_stages(id,name,sort_order,category,is_default,active,created_at,funnel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, sort_order=excluded.sort_order,
        category=excluded.category, active=excluded.active,funnel_id=excluded.funnel_id`).run(stage.id, stage.name, stage.order, stage.category, Number(stage.isDefault), Number(stage.active), stage.createdAt, stage.funnelId); },
      delete: (id) => { db.prepare("DELETE FROM pipeline_stages WHERE id=?").run(id); },
    },
    funnels: {
      list: () => db.prepare("SELECT * FROM funnels ORDER BY created_at, id").all().map(funnelFromRow),
      find: (id) => { const row = db.prepare("SELECT * FROM funnels WHERE id=?").get(id); return row ? funnelFromRow(row) : null; },
      save: (funnel) => { db.prepare("INSERT INTO funnels VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at").run(funnel.id,funnel.name,funnel.createdAt,funnel.updatedAt); },
      delete: (id) => { db.prepare("DELETE FROM funnels WHERE id=?").run(id); },
    },
    getMeta: (key) => { const row = db.prepare("SELECT value FROM meta WHERE key=?").get(key); return row ? String(row.value) : null; },
    setMeta: (key, value) => { db.prepare("INSERT INTO meta VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value); },
    transaction: (work) => { db.exec("BEGIN IMMEDIATE"); try { const value = work(); db.exec("COMMIT"); return value; } catch (error) { db.exec("ROLLBACK"); throw error; } },
    close: () => db.close(),
  };
}
