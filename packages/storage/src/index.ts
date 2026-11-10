import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { Pool, type QueryResultRow } from "pg";

export interface UserRecord {
  id: string;
  email: string | null;
  createdAt: number;
}

export interface WaitlistInput {
  email: string;
  name: string | null;
  createdAt: number;
}

export interface TaskInput {
  id: string;
  userId: string;
  objective: string;
  toNumberHash: string | null;
  createdAt: number;
}

export interface TaskRow {
  id: string;
  user_id: string;
  objective: string;
  to_number_hash: string | null;
  status: string;
  created_at: number;
  confirmed_at: number | null;
}

export interface CallInput {
  id: string;
  userId: string;
  taskId: string | null;
  toNumberHash: string | null;
  objective: string;
  state: string;
  startedAt: number;
}

export interface CallRow {
  id: string;
  user_id: string;
  task_id: string | null;
  to_number_hash: string | null;
  objective: string;
  state: string;
  outcome: string | null;
  started_at: number;
  ended_at: number | null;
  provider_sid: string | null;
}

export interface EventInput {
  id: string;
  callId: string;
  ts: number;
  fromState: string;
  toState: string;
  trigger: string;
}

export interface TranscriptInput {
  id: string;
  callId: string;
  ts: number;
  speaker: string;
  text: string;
  confidence: number | null;
  lang: string | null;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS waitlist (
    email TEXT PRIMARY KEY,
    name TEXT,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    objective TEXT NOT NULL,
    to_number_hash TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at BIGINT NOT NULL,
    confirmed_at BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    to_number_hash TEXT,
    objective TEXT NOT NULL,
    state TEXT NOT NULL,
    outcome TEXT,
    started_at BIGINT NOT NULL,
    ended_at BIGINT,
    provider_sid TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS call_events (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    ts BIGINT NOT NULL,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    trigger TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS transcript_segments (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    ts BIGINT NOT NULL,
    speaker TEXT NOT NULL,
    text TEXT NOT NULL,
    confidence REAL,
    lang TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS consents (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    granted BOOLEAN NOT NULL,
    ts BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL,
    consent_id TEXT NOT NULL REFERENCES consents(id),
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_calls_user_started ON calls(user_id, started_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_events_call_ts ON call_events(call_id, ts)",
  "CREATE INDEX IF NOT EXISTS idx_transcripts_call_ts ON transcript_segments(call_id, ts)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks(user_id, created_at DESC)",
];

export class SqlStore {
  private constructor(
    private readonly dialect: "sqlite" | "postgres",
    private readonly db: Database.Database | Pool,
  ) {}

  static async open(options: { connectionString?: string; dataDir?: string; sqlitePath?: string } = {}): Promise<SqlStore> {
    const connectionString = options.connectionString?.trim();
    if (connectionString && /^(postgres|postgresql):\/\//i.test(connectionString)) {
      const pool = new Pool({ connectionString, max: 8, idleTimeoutMillis: 30_000 });
      const store = new SqlStore("postgres", pool);
      await store.initialize();
      return store;
    }
    const filePath = options.sqlitePath ?? resolve(options.dataDir ?? "./data", "vaani-dalal.sqlite");
    if (filePath !== ":memory:") await mkdir(dirname(filePath), { recursive: true });
    const sqlite = new Database(filePath);
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("synchronous = NORMAL");
    const store = new SqlStore("sqlite", sqlite);
    await store.initialize();
    return store;
  }

  private async initialize(): Promise<void> {
    if (this.dialect === "sqlite") {
      const db = this.db as Database.Database;
      const transaction = db.transaction(() => {
        for (const sql of SCHEMA) db.exec(sql);
      });
      transaction();
      return;
    }
    const pool = this.db as Pool;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const sql of SCHEMA) await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private sqliteSql(sql: string): string {
    return sql.replace(/\$\d+/g, "?");
  }

  private async rows<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (this.dialect === "postgres") {
      const result = await (this.db as Pool).query<T>(sql, params);
      return result.rows;
    }
    const statement = (this.db as Database.Database).prepare(this.sqliteSql(sql));
    return (/\b(?:SELECT|RETURNING)\b/i.test(sql) ? statement.all(...params) : []) as T[];
  }

  private async run(sql: string, params: unknown[] = []): Promise<number> {
    if (this.dialect === "postgres") {
      const result = await (this.db as Pool).query(sql, params);
      return result.rowCount ?? 0;
    }
    const statement = (this.db as Database.Database).prepare(this.sqliteSql(sql));
    return statement.run(...params).changes;
  }

  async upsertUser(user: UserRecord): Promise<void> {
    await this.run(
      `INSERT INTO users (id, email, created_at) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = excluded.email`,
      [user.id, user.email, user.createdAt],
    );
  }

  async addWaitlist(input: WaitlistInput): Promise<boolean> {
    const sql = `INSERT INTO waitlist (email, name, created_at) VALUES ($1, $2, $3)
      ON CONFLICT (email) DO NOTHING RETURNING email`;
    const inserted = await this.rows<{ email: string }>(sql, [input.email, input.name, input.createdAt]);
    if (this.dialect === "sqlite") return inserted.length > 0;
    return inserted.length > 0;
  }

  async createTask(input: TaskInput): Promise<void> {
    await this.run(
      `INSERT INTO tasks (id, user_id, objective, to_number_hash, status, created_at)
       VALUES ($1, $2, $3, $4, 'draft', $5)`,
      [input.id, input.userId, input.objective, input.toNumberHash, input.createdAt],
    );
  }

  async confirmTask(taskId: string, userId: string, confirmedAt: number): Promise<boolean> {
    const changed = await this.run(
      `UPDATE tasks SET status = 'confirmed', confirmed_at = $3
       WHERE id = $1 AND user_id = $2 AND status = 'draft'`,
      [taskId, userId, confirmedAt],
    );
    return changed > 0;
  }

  async getTask(userId: string, taskId: string): Promise<TaskRow | null> {
    const result = await this.rows<TaskRow>(
      `SELECT id, user_id, objective, to_number_hash, status, created_at, confirmed_at
       FROM tasks WHERE user_id = $1 AND id = $2`,
      [userId, taskId],
    );
    return result[0] ?? null;
  }

  async createCall(input: CallInput): Promise<void> {
    await this.run(
      `INSERT INTO calls (id, user_id, task_id, to_number_hash, objective, state, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [input.id, input.userId, input.taskId, input.toNumberHash, input.objective, input.state, input.startedAt],
    );
  }

  async updateCall(callId: string, userId: string, state: string, outcome: string | null, endedAt: number | null): Promise<void> {
    await this.run(
      `UPDATE calls SET state = $3, outcome = COALESCE($4, outcome), ended_at = COALESCE($5, ended_at)
       WHERE id = $1 AND user_id = $2`,
      [callId, userId, state, outcome, endedAt],
    );
  }

  async appendEvent(event: EventInput): Promise<void> {
    await this.run(
      `INSERT INTO call_events (id, call_id, ts, from_state, to_state, trigger)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [event.id, event.callId, event.ts, event.fromState, event.toState, event.trigger],
    );
  }

  async appendTranscript(segment: TranscriptInput): Promise<void> {
    await this.run(
      `INSERT INTO transcript_segments (id, call_id, ts, speaker, text, confidence, lang)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [segment.id, segment.callId, segment.ts, segment.speaker, segment.text, segment.confidence, segment.lang],
    );
  }

  async addConsent(input: { id: string; callId: string; kind: string; granted: boolean; ts: number }): Promise<void> {
    await this.run(
      `INSERT INTO consents (id, call_id, kind, granted, ts) VALUES ($1, $2, $3, $4, $5)`,
      [input.id, input.callId, input.kind, input.granted, input.ts],
    );
  }

  async addRecording(input: { id: string; callId: string; objectKey: string; consentId: string; createdAt: number; expiresAt: number }): Promise<void> {
    if (process.env.RECORDING_ENABLED !== "true") throw new Error("Recording storage is disabled");
    const consent = (await this.rows<{ granted: boolean }>(
      "SELECT granted FROM consents WHERE id = $1 AND call_id = $2 AND kind = 'recording'",
      [input.consentId, input.callId],
    ))[0];
    if (!consent?.granted) throw new Error("A recorded consent is required before creating a recording index");
    await this.run(
      `INSERT INTO recordings (id, call_id, object_key, consent_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.id, input.callId, input.objectKey, input.consentId, input.createdAt, input.expiresAt],
    );
  }

  async getCall(userId: string, callId: string): Promise<CallRow | null> {
    const result = await this.rows<CallRow>(
      `SELECT id, user_id, task_id, to_number_hash, objective, state, outcome, started_at, ended_at, provider_sid
       FROM calls WHERE user_id = $1 AND id = $2`,
      [userId, callId],
    );
    return result[0] ?? null;
  }

  async listCalls(userId: string, limit = 50): Promise<CallRow[]> {
    return this.rows<CallRow>(
      `SELECT id, user_id, task_id, to_number_hash, objective, state, outcome, started_at, ended_at, provider_sid
       FROM calls WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [userId, Math.max(1, Math.min(100, limit))],
    );
  }

  async listCallEvents(userId: string, callId: string): Promise<EventInput[]> {
    return this.rows<EventInput>(
      `SELECT e.id, e.call_id AS "callId", e.ts, e.from_state AS "fromState", e.to_state AS "toState", e.trigger
       FROM call_events e JOIN calls c ON c.id = e.call_id
       WHERE c.user_id = $1 AND c.id = $2 ORDER BY e.ts ASC`,
      [userId, callId],
    );
  }

  async listTranscript(userId: string, callId: string): Promise<TranscriptInput[]> {
    return this.rows<TranscriptInput>(
      `SELECT t.id, t.call_id AS "callId", t.ts, t.speaker, t.text, t.confidence, t.lang
       FROM transcript_segments t JOIN calls c ON c.id = t.call_id
       WHERE c.user_id = $1 AND c.id = $2 ORDER BY t.ts ASC`,
      [userId, callId],
    );
  }

  async close(): Promise<void> {
    if (this.dialect === "postgres") await (this.db as Pool).end();
    else (this.db as Database.Database).close();
  }

  get driver(): "sqlite" | "postgres" { return this.dialect; }
}

export async function openAppStore(): Promise<SqlStore> {
  return SqlStore.open({
    connectionString: process.env.APP_DATABASE_URL,
    dataDir: process.env.DATA_DIR ?? "./data",
  });
}
