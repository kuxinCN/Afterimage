import { openDB } from "idb";
import { ZodError } from "zod";

import {
  DB_NAME,
  DB_VERSION,
  ERROR_CODES,
  INDEXES,
  STORES,
} from "@/lib/constants";

export class StorageError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    this.cause = options.cause;
  }
}

function formatIssues(error) {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export function asStorageError(error, fallbackMessage = "Local storage operation failed") {
  if (error instanceof StorageError) {
    return error;
  }
  if (error instanceof ZodError) {
    return new StorageError(ERROR_CODES.VALIDATION_FAILED, formatIssues(error), { cause: error });
  }
  if (error?.name === "ConstraintError") {
    return new StorageError(
      ERROR_CODES.STORAGE_FAILED,
      `${fallbackMessage}: a key or uniqueness constraint was violated`,
      { cause: error },
    );
  }
  return new StorageError(ERROR_CODES.STORAGE_FAILED, fallbackMessage, { cause: error });
}

export function isStorageAvailable() {
  return typeof indexedDB !== "undefined";
}

// Each key is the version the database is upgraded to. Add a new entry whenever
// a field, index or object store changes, and never edit a shipped one.
const migrations = {
  1: (db) => {
    const memories = db.createObjectStore(STORES.memories, { keyPath: "id" });
    memories.createIndex(INDEXES.memories.byStatus, "status");
    memories.createIndex(INDEXES.memories.byCreatedAt, "createdAt");

    const assets = db.createObjectStore(STORES.assets, { keyPath: "id" });
    assets.createIndex(INDEXES.assets.byMemoryId, "memoryId");
    assets.createIndex(INDEXES.assets.byCreatedAt, "createdAt");

    const scenes = db.createObjectStore(STORES.scenes, { keyPath: "id" });
    scenes.createIndex(INDEXES.scenes.byMemoryId, "memoryId", { unique: true });

    const explorations = db.createObjectStore(STORES.explorations, { keyPath: "memoryId" });
    explorations.createIndex(INDEXES.explorations.byLastVisitedAt, "lastVisitedAt");
  },
};

function runMigrations(db, oldVersion, newVersion, tx) {
  for (let version = oldVersion + 1; version <= newVersion; version += 1) {
    const migration = migrations[version];
    if (!migration) {
      throw new StorageError(
        ERROR_CODES.STORAGE_FAILED,
        `No migration registered for database version ${version}`,
      );
    }
    migration(db, tx, version);
  }
}

let dbPromise = null;

export function getDB() {
  if (!isStorageAvailable()) {
    return Promise.reject(
      new StorageError(
        ERROR_CODES.STORAGE_UNAVAILABLE,
        "IndexedDB is not available in this environment",
      ),
    );
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade: (db, oldVersion, newVersion, tx) => {
        runMigrations(db, oldVersion, newVersion, tx);
      },
      blocked: () => {
        // An open connection in another tab is holding the previous version.
      },
      blocking: () => {
        void closeDB();
      },
    }).catch((error) => {
      dbPromise = null;
      throw asStorageError(error, `Failed to open ${DB_NAME}`);
    });
  }

  return dbPromise;
}

export async function closeDB() {
  const pending = dbPromise;
  dbPromise = null;
  if (!pending) {
    return;
  }
  try {
    const db = await pending;
    db.close();
  } catch {
    // Nothing was open, so there is nothing to close.
  }
}

// Everything the handler awaits must be an IndexedDB request. Awaiting a fetch,
// a timer or any other promise lets the transaction commit on its own and the
// follow-up request then throws TransactionInactiveError.
export async function withTransaction(stores, mode, handler, errorMessage) {
  const db = await getDB();
  const tx = db.transaction(stores, mode);
  try {
    const result = await handler(tx);
    await tx.done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction had already finished.
    }
    await tx.done.catch(() => {});
    throw asStorageError(error, errorMessage);
  }
}

export async function readFrom(stores, handler, errorMessage) {
  return withTransaction(stores, "readonly", handler, errorMessage);
}

export function validate(schema, value) {
  try {
    return schema.parse(value);
  } catch (error) {
    throw asStorageError(error, "Invalid data");
  }
}

// IDBIndex has no delete() in the IndexedDB spec, so matching primary keys are
// enumerated first. Both requests stay inside the caller's transaction.
export async function deleteByIndex(tx, storeName, indexName, key) {
  const store = tx.objectStore(storeName);
  const keys = await store.index(indexName).getAllKeys(key);

  for (const primaryKey of keys) {
    await store.delete(primaryKey);
  }

  return keys.length;
}
