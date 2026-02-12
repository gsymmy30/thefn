import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type IdentityType = "phone" | "email";

export type SessionUser = {
  userId: string;
  profileDisplayName: string | null;
};

export type AvatarModel = {
  id: string;
  user_id: string;
  status: "pending" | "ready" | "failed";
  provider: string;
  sample_image_path: string | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
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
      handle TEXT,
      display_name TEXT NOT NULL,
      full_name TEXT,
      bio TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  ensureRuntimeMigrations(db);

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

function ensureRuntimeMigrations(db: DatabaseSync) {
  const profileColumns = db
    .prepare(`PRAGMA table_info(profiles)`)
    .all() as Array<{ name: string }>;
  if (!profileColumns.some((column) => column.name === "handle")) {
    db.exec(`ALTER TABLE profiles ADD COLUMN handle TEXT;`);
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_handle_unique
    ON profiles(lower(handle))
    WHERE handle IS NOT NULL;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_photos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_profile_photos_user_order
    ON profile_photos(user_id, sort_order);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS avatar_models (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('pending', 'ready', 'failed')),
      provider TEXT NOT NULL,
      sample_image_path TEXT,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_avatar_models_user_id
    ON avatar_models(user_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS avatar_generations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'ready', 'failed')),
      image_path TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_avatar_generations_user_created
    ON avatar_generations(user_id, created_at DESC);
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

  ensureRuntimeMigrations(globalForDb.conn);
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
  handle: string;
  displayName: string;
  fullName?: string | null;
  bio?: string | null;
}) {
  const db = getDb();
  const timestamp = nowUnix();

  db.prepare(
    `INSERT INTO profiles (user_id, handle, display_name, full_name, bio, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id)
     DO UPDATE SET
       handle = excluded.handle,
       display_name = excluded.display_name,
       full_name = excluded.full_name,
       bio = excluded.bio,
       updated_at = excluded.updated_at`
  ).run(
    params.userId,
    params.handle,
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
      `SELECT handle, display_name, full_name, bio
       FROM profiles
       WHERE user_id = ?
       LIMIT 1`
    )
    .get(userId) as
    | { handle: string | null; display_name: string; full_name: string | null; bio: string | null }
    | undefined;
}

export function isHandleTaken(handle: string, excludeUserId?: string) {
  const db = getDb();
  const normalized = handle.toLowerCase();

  if (excludeUserId) {
    const row = db
      .prepare(
        `SELECT user_id
         FROM profiles
         WHERE lower(handle) = ?
           AND user_id != ?
         LIMIT 1`
      )
      .get(normalized, excludeUserId) as { user_id: string } | undefined;
    return Boolean(row);
  }

  const row = db
    .prepare(
      `SELECT user_id
       FROM profiles
       WHERE lower(handle) = ?
       LIMIT 1`
    )
    .get(normalized) as { user_id: string } | undefined;
  return Boolean(row);
}

export function revokeSessionByTokenHash(tokenHash: string) {
  const db = getDb();
  const timestamp = nowUnix();

  db.prepare(
    `UPDATE sessions
     SET revoked_at = ?
     WHERE token_hash = ?
       AND revoked_at IS NULL`
  ).run(timestamp, tokenHash);
}

export function consumeEmailMagicLinkRateLimit(email: string, ipAddress?: string | null) {
  const db = getDb();
  const now = nowUnix();
  const cooldownSeconds = 60;
  const windowSeconds = 15 * 60;
  const maxPerEmailInWindow = 5;
  const maxPerIpInWindow = 20;

  db.exec(`
    CREATE TABLE IF NOT EXISTS email_magic_link_requests (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      ip_address TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_email_magic_link_requests_email_created
    ON email_magic_link_requests(email, created_at);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_email_magic_link_requests_ip_created
    ON email_magic_link_requests(ip_address, created_at);
  `);

  const lastForEmail = db
    .prepare(
      `SELECT created_at
       FROM email_magic_link_requests
       WHERE email = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(email) as { created_at: number } | undefined;

  if (lastForEmail) {
    const secondsSinceLast = now - lastForEmail.created_at;
    if (secondsSinceLast < cooldownSeconds) {
      return {
        allowed: false,
        retryAfterSeconds: cooldownSeconds - secondsSinceLast,
        reason: "cooldown",
      } as const;
    }
  }

  const emailCount = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM email_magic_link_requests
       WHERE email = ?
         AND created_at > ?`
    )
    .get(email, now - windowSeconds) as { count: number };

  if (emailCount.count >= maxPerEmailInWindow) {
    return {
      allowed: false,
      retryAfterSeconds: windowSeconds,
      reason: "email_window_limit",
    } as const;
  }

  if (ipAddress) {
    const ipCount = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM email_magic_link_requests
         WHERE ip_address = ?
           AND created_at > ?`
      )
      .get(ipAddress, now - windowSeconds) as { count: number };

    if (ipCount.count >= maxPerIpInWindow) {
      return {
        allowed: false,
        retryAfterSeconds: windowSeconds,
        reason: "ip_window_limit",
      } as const;
    }
  }

  db.prepare(
    `INSERT INTO email_magic_link_requests (id, email, ip_address, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(randomUUID(), email, ipAddress ?? null, now);

  db.prepare(
    `DELETE FROM email_magic_link_requests
     WHERE created_at < ?`
  ).run(now - 24 * 60 * 60);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    reason: "ok",
  } as const;
}

export function createDevMagicLink(email: string, ttlSeconds = 15 * 60) {
  const db = getDb();
  const now = nowUnix();
  const expiresAt = now + ttlSeconds;
  const tokenHash = randomBytes(24).toString("hex");

  db.exec(`
    CREATE TABLE IF NOT EXISTS dev_magic_links (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dev_magic_links_token_hash
    ON dev_magic_links(token_hash);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dev_magic_links_email_created
    ON dev_magic_links(email, created_at);
  `);

  db.prepare(
    `INSERT INTO dev_magic_links (id, email, token_hash, created_at, expires_at, consumed_at)
     VALUES (?, ?, ?, ?, ?, NULL)`
  ).run(randomUUID(), email, tokenHash, now, expiresAt);

  db.prepare(
    `DELETE FROM dev_magic_links
     WHERE expires_at < ? OR consumed_at IS NOT NULL`
  ).run(now - 24 * 60 * 60);

  return { tokenHash, expiresAt };
}

export function consumeDevMagicLink(tokenHash: string) {
  const db = getDb();
  const now = nowUnix();

  const row = db
    .prepare(
      `SELECT id, email
       FROM dev_magic_links
       WHERE token_hash = ?
         AND consumed_at IS NULL
         AND expires_at > ?
       LIMIT 1`
    )
    .get(tokenHash, now) as { id: string; email: string } | undefined;

  if (!row) {
    return null;
  }

  db.prepare(
    `UPDATE dev_magic_links
     SET consumed_at = ?
     WHERE id = ?`
  ).run(now, row.id);

  return { email: row.email };
}

export function listRecentEmailIdentities(limit = 8) {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         ui.normalized_value AS email,
         p.display_name AS display_name
       FROM user_identities ui
       LEFT JOIN profiles p ON p.user_id = ui.user_id
       WHERE ui.type = 'email'
       ORDER BY ui.created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{ email: string; display_name: string | null }>;
}

export function replaceProfilePhotos(
  userId: string,
  photos: Array<{
    storagePath: string;
    mimeType: string;
    originalName: string;
    sizeBytes: number;
  }>
) {
  const db = getDb();
  const timestamp = nowUnix();

  const existing = db
    .prepare(
      `SELECT storage_path
       FROM profile_photos
       WHERE user_id = ?`
    )
    .all(userId) as Array<{ storage_path: string }>;

  db.exec("BEGIN IMMEDIATE TRANSACTION;");
  try {
    db.prepare(`DELETE FROM profile_photos WHERE user_id = ?`).run(userId);

    photos.forEach((photo, index) => {
      db.prepare(
        `INSERT INTO profile_photos (id, user_id, storage_path, mime_type, original_name, size_bytes, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        userId,
        photo.storagePath,
        photo.mimeType,
        photo.originalName,
        photo.sizeBytes,
        index,
        timestamp
      );
    });

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }

  return existing.map((item) => item.storage_path);
}

export function listProfilePhotosByUserId(userId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, storage_path, mime_type, original_name, size_bytes, sort_order
       FROM profile_photos
       WHERE user_id = ?
       ORDER BY sort_order ASC`
    )
    .all(userId) as Array<{
    id: string;
    storage_path: string;
    mime_type: string;
    original_name: string;
    size_bytes: number;
    sort_order: number;
  }>;
}

export function getProfilePhotoByIdForUser(photoId: string, userId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, storage_path, mime_type, original_name, size_bytes
       FROM profile_photos
       WHERE id = ?
         AND user_id = ?
       LIMIT 1`
    )
    .get(photoId, userId) as
    | {
        id: string;
        storage_path: string;
        mime_type: string;
        original_name: string;
        size_bytes: number;
      }
    | undefined;
}

export function upsertAvatarModelPending(userId: string, provider: string) {
  const db = getDb();
  const timestamp = nowUnix();
  const existing = db
    .prepare(
      `SELECT id
       FROM avatar_models
       WHERE user_id = ?
       LIMIT 1`
    )
    .get(userId) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE avatar_models
       SET status = 'pending',
           provider = ?,
           last_error = NULL,
           updated_at = ?
       WHERE user_id = ?`
    ).run(provider, timestamp, userId);
    return existing.id;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO avatar_models (id, user_id, status, provider, sample_image_path, last_error, created_at, updated_at)
     VALUES (?, ?, 'pending', ?, NULL, NULL, ?, ?)`
  ).run(id, userId, provider, timestamp, timestamp);
  return id;
}

export function updateAvatarModelReady(userId: string, sampleImagePath: string) {
  const db = getDb();
  const timestamp = nowUnix();
  db.prepare(
    `UPDATE avatar_models
     SET status = 'ready',
         sample_image_path = ?,
         last_error = NULL,
         updated_at = ?
     WHERE user_id = ?`
  ).run(sampleImagePath, timestamp, userId);
}

export function updateAvatarModelFailed(userId: string, errorMessage: string) {
  const db = getDb();
  const timestamp = nowUnix();
  db.prepare(
    `UPDATE avatar_models
     SET status = 'failed',
         last_error = ?,
         updated_at = ?
     WHERE user_id = ?`
  ).run(errorMessage.slice(0, 300), timestamp, userId);
}

export function getAvatarModelByUserId(userId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, user_id, status, provider, sample_image_path, last_error, created_at, updated_at
       FROM avatar_models
       WHERE user_id = ?
       LIMIT 1`
    )
    .get(userId) as AvatarModel | undefined;
}

export function createAvatarGeneration(params: {
  userId: string;
  prompt: string;
  status: "pending" | "ready" | "failed";
  imagePath?: string | null;
  errorMessage?: string | null;
}) {
  const db = getDb();
  const timestamp = nowUnix();
  db.prepare(
    `INSERT INTO avatar_generations (id, user_id, prompt, status, image_path, error_message, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    params.userId,
    params.prompt.slice(0, 500),
    params.status,
    params.imagePath ?? null,
    params.errorMessage ?? null,
    timestamp,
    timestamp
  );
}
