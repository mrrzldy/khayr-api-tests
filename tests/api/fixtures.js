/**
 * fixtures.js — Shared Playwright API test fixtures for Khayr API test suite.
 *
 * Provides:
 *  - `request`  : Playwright APIRequestContext, auto-wrapped to emit structured
 *                 [HTTP] console logs that generate-api-report.js can parse.
 *  - `db`       : MongoDB helper (connect/disconnect managed per suite via beforeAll/afterAll).
 *  - `state`    : Read/write helpers for .state.json persistence across suites.
 *
 * Usage in spec files:
 *   const { test, expect } = require('./fixtures');
 *   // request, db, state are available as test fixtures
 */

const { test: base, expect } = require('@playwright/test');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.resolve(process.cwd(), '.state.json');

// ── State helpers ─────────────────────────────────────────────────────────────

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(data) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

function mergeState(patch) {
  const current = readState();
  const merged = { ...current, ...patch };
  writeState(merged);
  return merged;
}

// ── MongoDB helper ────────────────────────────────────────────────────────────

class DbHelper {
  constructor() {
    this.client = null;
    this.db = null;
    this.available = false;
  }

  async connect() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn('[DB] MONGODB_URI not set — DB validation will be skipped.');
      return this;
    }
    try {
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      await this.client.connect();
      this.db = this.client.db(process.env.MONGODB_DB_NAME || 'khayr_dev');
      this.available = true;
      console.log('[DB] MongoDB connected — DB validation enabled.');
    } catch (e) {
      console.warn('[DB] MongoDB not reachable — DB validation will be skipped:', e.message);
    }
    return this;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close().catch(() => null);
      this.client = null;
      this.db = null;
      this.available = false;
    }
  }

  collection(name) {
    if (!this.available) throw new Error('[DB] Not connected');
    return this.db.collection(name);
  }

  /**
   * Assert a document exists and optionally validate fields.
   * @param {string} collectionName
   * @param {string|ObjectId} id
   * @param {object} [expectedFields]  — key/value pairs to assert on the document
   * @returns {object} the found document
   */
  async assertDocument(collectionName, id, expectedFields = {}) {
    if (!this.available) {
      console.warn(`[DB] Skipping DB assertion for ${collectionName}/${id} — no connection`);
      return null;
    }
    const oid = typeof id === 'string' ? new ObjectId(id) : id;
    const doc = await this.db.collection(collectionName).findOne({ _id: oid });
    if (!doc) throw new Error(`[DB] Document not found in ${collectionName}: ${id}`);

    for (const [key, expected] of Object.entries(expectedFields)) {
      const actual = doc[key];
      const actualStr = actual?.toString ? actual.toString() : String(actual);
      const expectedStr = expected?.toString ? expected.toString() : String(expected);
      if (actualStr !== expectedStr) {
        throw new Error(
          `[DB] Field mismatch in ${collectionName}.${key}: expected "${expectedStr}", got "${actualStr}"`
        );
      }
    }

    console.log(`[DB] ✅ ${collectionName}/${id} validated${Object.keys(expectedFields).length ? ` (${Object.keys(expectedFields).join(', ')})` : ''}`);
    return doc;
  }

  /**
   * Find first matching document.
   */
  async findOne(collectionName, filter = {}, projection = {}) {
    if (!this.available) return null;
    return this.db.collection(collectionName).findOne(filter, { projection });
  }
}

// ── HTTP logging wrapper ──────────────────────────────────────────────────────
// Wraps Playwright APIRequestContext methods to emit [HTTP] log lines
// in the format that generate-api-report.js parses:
//   [HTTP] METHOD /path/... STATUS duration_ms

function wrapRequest(request) {
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head'];
  const proxy = {};

  for (const method of methods) {
    proxy[method] = async (url, options) => {
      const t0 = Date.now();
      const res = await request[method](url, options);
      const ms = Date.now() - t0;

      // Derive short path from URL for the log line
      const shortUrl = url.replace(/https?:\/\/[^/]+/, '');
      const status = res.status();
      const statusEmoji = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
      console.log(`[HTTP] ${method.toUpperCase()} ${shortUrl} ${status} ${ms}ms`);

      // Log request body (from options.data)
      const reqBody = options?.data ?? options?.form ?? null;
      if (reqBody !== null && reqBody !== undefined) {
        try {
          console.log(`[REQ_BODY] ${typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody)}`);
        } catch {}
      }

      // Log response body (safe — Playwright allows multiple reads)
      try {
        const rawText = await res.text();
        if (rawText) {
          // Try to pretty-print as JSON, fallback to raw
          try {
            const parsed = JSON.parse(rawText);
            console.log(`[RES_BODY] ${JSON.stringify(parsed)}`);
          } catch {
            console.log(`[RES_BODY] ${rawText.slice(0, 500)}`);
          }
        }
      } catch {}

      console.log(`[STATUS] ${statusEmoji} ${method.toUpperCase()} ${shortUrl} → ${status}`);

      return res;
    };
  }

  // Pass-through for anything else (dispose, etc.)
  return new Proxy(proxy, {
    get(target, prop) {
      return prop in target ? target[prop] : request[prop].bind(request);
    },
  });
}

// ── Fixture definitions ───────────────────────────────────────────────────────

const test = base.extend({
  /**
   * Wrapped APIRequestContext — all HTTP calls emit [HTTP] log lines.
   */
  request: async ({ request }, use) => {
    await use(wrapRequest(request));
  },

  /**
   * DbHelper instance — connect/disconnect lifecycle managed by the fixture.
   */
  db: [async ({}, use) => {
    const helper = new DbHelper();
    await helper.connect();
    await use(helper);
    await helper.disconnect();
  }, { scope: 'worker' }],

  /**
   * State helpers — read/merge/write .state.json.
   */
  state: [async ({}, use) => {
    await use({ read: readState, write: writeState, merge: mergeState });
  }, { scope: 'worker' }],
});

module.exports = { test, expect, DbHelper, readState, writeState, mergeState, ObjectId };
