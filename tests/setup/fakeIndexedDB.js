// idb checks `instanceof IDBRequest`, so the whole IndexedDB global surface is
// needed, not just indexedDB. Vitest isolates every test file, which gives each
// suite its own fake factory while still persisting records across a reopen.
import "fake-indexeddb/auto";
