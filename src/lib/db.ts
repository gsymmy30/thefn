import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type IdentityType = "phone" | "email";

export type SessionUser = {
  userId: string;
  profileDisplayName: string | null;
};

type DatabaseGlobal = {
  conn?: DatabaseSync;
};

const globalForDb = globalThis as typeof globalThis & DatabaseGlobal;

function getDbPath() {
  const configuredPath = process.env.SQLITE_DB_PATH?.trim();
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(process.cwd(), configuredPath);
  }

  return path.join(process.cwd(), "data", "thefn.sqlite");
}

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function initDb(db: DatabaseSync) {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('phone', 'email')),
      normalized_value TEXT NOT NULL,
      verified_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(type, normalized_value)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      full_name TEXT,
      bio TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      ip_address TEXT,
      user_agent TEXT
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);
}

export function getDb() {
  if (!globalForDb.conn) {
    const dbPath = getDbPath();
    mkdirSync(path.dirname(dbPath), { recursive: true });

    const db = new DatabaseSync(dbPath);
    initDb(db);
    globalForDb.conn = db;
  }

  return globalForDb.conn;
}

export function findOrCreateUserByIdentity(type: IdentityType, normalizedValue: string) {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT user_id FROM user_identities WHERE type = ? AND normalized_value = ? LIMIT 1`
    )
    .get(type, normalizedValue) as { user_id: string } | undefined;

  if (existing?.user_id) {
    return existing.user_id;
  }

  const userId = randomUUID();
  const timestamp = nowUnix();

  db.exec("BEGIN IMMEDIATE TRANSACTION;");
  try {
    db.prepare(
      `INSERT INTO users (id, status, created_at, updated_at)
       VALUES (?, 'active', ?, ?)`
    ).run(userId, timestamp, timestamp);

    db.prepare(
      `INSERT INTO user_identities (id, user_id, type, normalized_value, verified_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), userId, type, normalizedValue, timestamp, timestamp);

    db.exec("COMMIT;");
    return userId;
  } catch (error) {
    db.exec("ROLLBACK;");

    const retry = db
      .prepare(
        `SELECT user_id FROM user_identities WHERE type = ? AND normalized_value = ? LIMIT 1`
      )
      .get(type, normalizedValue) as { user_id: string } | undefined;

    if (retry?.user_id) {
      return retry.user_id;
    }

    throw error;
  }
}

export function createSession(params: {
  userId: string;
  tokenHash: string;
  ttlSeconds: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const db = getDb();
  const createdAt = nowUnix();
  const expiresAt = createdAt + params.ttlSeconds;

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
  ).run(
    randomUUID(),
    params.userId,
    params.tokenHash,
    createdAt,
    expiresAt,
    params.ipAddress?.slice(0, 120) ?? null,
    params.userAgent?.slice(0, 500) ?? null
  );
}

export function getSessionUserByTokenHash(tokenHash: string): SessionUser | null {
  const db = getDb();
  const timestamp = nowUnix();

  const row = db
    .prepare(
      `SELECT
          u.id AS user_id,
          p.display_name AS profile_display_name
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE s.token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > ?
       LIMIT 1`
    )
    .get(tokenHash, timestamp) as
    | { user_id: string; profile_display_name: string | null }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    profileDisplayName: row.profile_display_name,
  };
}

export function upsertProfile(params: {
  userId: string;
  displayName: string;
  fullName?: string | null;
  bio?: string | null;
}) {
  const db = getDb();
  const timestamp = nowUnix();

  db.prepare(
    `INSERT INTO profiles (user_id, display_name, full_name, bio, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id)
     DO UPDATE SET
       display_name = excluded.display_name,
       full_name = excluded.full_name,
       bio = excluded.bio,
       updated_at = excluded.updated_at`
  ).run(
    params.userId,
    params.displayName,
    params.fullName ?? null,
    params.bio ?? null,
    timestamp,
    timestamp
  );
}

export function getProfileByUserId(userId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT display_name, full_name, bio
       FROM profiles
       WHERE user_id = ?
       LIMIT 1`
    )
    .get(userId) as
    | { display_name: string; full_name: string | null; bio: string | null }
    | undefined;
}
