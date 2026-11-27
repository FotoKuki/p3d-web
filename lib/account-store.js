import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { currentLineProvider } from "./line-provider";
import { filamentSwatch } from "./print-options";

let clientInstance;
let schemaReady;

function plainRow(row, columns) {
  if (!row) return null;
  const obj = {};
  for (const col of columns) {
    obj[col] = row[col];
  }
  return obj;
}

function plainRows(result) {
  return result.rows.map((row) => plainRow(row, result.columns));
}

function getClient() {
  if (clientInstance) return clientInstance;
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    clientInstance = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
    });
  } else {
    const directory = resolve(/* turbopackIgnore: true */ process.env.P3D_ACCOUNT_DATA_DIR || ".p3d-data");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const filePath = join(directory, "accounts.sqlite").replace(/\\/g, "/");
    clientInstance = createClient({ url: "file:" + filePath });
  }
  return clientInstance;
}

async function db() {
  const client = getClient();
  if (!schemaReady) {
    schemaReady = (async () => {
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT UNIQUE COLLATE NOCASE,
          image TEXT,
          phone TEXT NOT NULL DEFAULT ''
        )`,
        `CREATE TABLE IF NOT EXISTS accounts (
          provider TEXT NOT NULL,
          providerAccountId TEXT NOT NULL,
          userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          PRIMARY KEY (provider, providerAccountId),
          UNIQUE (userId, provider)
        )`,
        `CREATE TABLE IF NOT EXISTS addresses (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          recipient TEXT NOT NULL,
          phone TEXT NOT NULL,
          address TEXT NOT NULL,
          postalCode TEXT NOT NULL,
          details TEXT NOT NULL DEFAULT '{}',
          createdAt INTEGER NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS addresses_by_user ON addresses(userId, createdAt)`,
        `CREATE TABLE IF NOT EXISTS printOrders (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL REFERENCES users(id),
          requestId TEXT NOT NULL,
          fileName TEXT NOT NULL,
          model BLOB NOT NULL,
          printSettings TEXT NOT NULL,
          shipping TEXT NOT NULL,
          quote TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending_payment',
          tracking TEXT NOT NULL DEFAULT '{}',
          progressVersion INTEGER NOT NULL DEFAULT 0,
          assignee TEXT NOT NULL DEFAULT '',
          deletedAt INTEGER,
          createdAt INTEGER NOT NULL,
          UNIQUE(userId, requestId)
        )`,
        `CREATE INDEX IF NOT EXISTS print_orders_by_user ON printOrders(userId, createdAt)`,
        `CREATE TABLE IF NOT EXISTS printOrderNotices (
          orderId TEXT PRIMARY KEY REFERENCES printOrders(id),
          sentAt INTEGER
        )`,
        `CREATE TABLE IF NOT EXISTS printPaymentSlips (
          orderId TEXT PRIMARY KEY REFERENCES printOrders(id),
          mime TEXT NOT NULL,
          image BLOB NOT NULL,
          submittedAt INTEGER NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS filamentStock (
          id TEXT PRIMARY KEY,
          material TEXT NOT NULL,
          color TEXT NOT NULL,
          colorKey TEXT NOT NULL,
          hex TEXT,
          grams INTEGER NOT NULL CHECK (grams >= 0),
          revision INTEGER NOT NULL DEFAULT 0,
          UNIQUE(material, colorKey)
        )`,
      ];
      for (const sql of statements) {
        await client.execute(sql);
      }
      const stockColumns = () => client.execute("PRAGMA table_info(filamentStock)");
      if (!(await stockColumns()).rows.some((column) => column.name === "hex")) {
        try {
          await client.execute("ALTER TABLE filamentStock ADD COLUMN hex TEXT");
        } catch (error) {
          if (!(await stockColumns()).rows.some((column) => column.name === "hex")) throw error;
        }
      }

      const addrInfo = await client.execute("PRAGMA table_info(addresses)");
      if (!addrInfo.rows.some((col) => col.name === "details")) {
        await client.execute("ALTER TABLE addresses ADD COLUMN details TEXT NOT NULL DEFAULT '{}'");
      }

      const orderInfo = await client.execute("PRAGMA table_info(printOrders)");
      const hasCol = (name) => orderInfo.rows.some((col) => col.name === name);
      if (!hasCol("tracking")) {
        await client.execute("ALTER TABLE printOrders ADD COLUMN tracking TEXT NOT NULL DEFAULT '{}'");
      }
      if (!hasCol("progressVersion")) {
        await client.execute("ALTER TABLE printOrders ADD COLUMN progressVersion INTEGER NOT NULL DEFAULT 0");
      }
      if (!hasCol("assignee")) {
        await client.execute("ALTER TABLE printOrders ADD COLUMN assignee TEXT NOT NULL DEFAULT ''");
      }
      if (!hasCol("deletedAt")) {
        await client.execute("ALTER TABLE printOrders ADD COLUMN deletedAt INTEGER");
      }
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
  return client;
}

function authUser(row) {
  return row ? { ...row, emailVerified: null } : null;
}

export const accountAdapter = {
  async createUser(profile) {
    const id = randomUUID();
    const client = await db();
    await client.execute({
      sql: "INSERT INTO users (id, name, email, image) VALUES (?, ?, ?, ?)",
      args: [id, profile.name ?? null, profile.email ?? null, profile.image ?? null],
    });
    return accountAdapter.getUser(id);
  },
  async getUser(id) {
    const client = await db();
    const res = await client.execute({
      sql: "SELECT id, name, email, image FROM users WHERE id = ?",
      args: [id],
    });
    return authUser(plainRow(res.rows[0], res.columns));
  },
  async getUserByEmail(email) {
    const client = await db();
    const res = await client.execute({
      sql: "SELECT id, name, email, image FROM users WHERE email = ?",
      args: [email],
    });
    return authUser(plainRow(res.rows[0], res.columns));
  },
  async getUserByAccount({ provider, providerAccountId }) {
    const client = await db();
    const res = await client.execute({
      sql: `SELECT users.id, users.name, users.email, users.image
            FROM accounts JOIN users ON users.id = accounts.userId
            WHERE accounts.provider = ? AND accounts.providerAccountId = ?`,
      args: [provider, providerAccountId],
    });
    return authUser(plainRow(res.rows[0], res.columns));
  },
  async linkAccount({ provider, providerAccountId, userId, type }) {
    const client = await db();
    await client.execute({
      sql: "INSERT INTO accounts (provider, providerAccountId, userId) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
      args: [provider, providerAccountId, userId],
    });
    const res = await client.execute({
      sql: "SELECT userId FROM accounts WHERE provider = ? AND providerAccountId = ?",
      args: [provider, providerAccountId],
    });
    const account = res.rows[0];
    if (account?.userId !== userId) {
      await client.execute({
        sql: "DELETE FROM users WHERE id = ? AND NOT EXISTS (SELECT 1 FROM accounts WHERE userId = ?)",
        args: [userId, userId],
      });
      throw new Error("The provider account could not be linked");
    }
    return { provider, providerAccountId, userId, type };
  },
};

export async function getAccountProfile(userId) {
  const client = await db();
  const userRes = await client.execute({
    sql: "SELECT id, name, email, phone FROM users WHERE id = ?",
    args: [userId],
  });
  const user = plainRow(userRes.rows[0], userRes.columns);
  if (!user) return null;

  const addrRes = await client.execute({
    sql: "SELECT id, label, recipient, phone, address, postalCode, details FROM addresses WHERE userId = ? ORDER BY createdAt, id",
    args: [userId],
  });
  const provRes = await client.execute({
    sql: "SELECT provider FROM accounts WHERE userId = ?",
    args: [userId],
  });
  const providers = provRes.rows.map((r) => r.provider);
  const lineLinked = providers.includes(currentLineProvider);
  const legacyLineLinked = currentLineProvider !== "line" && providers.includes("line");
  const canUnlinkLine = lineLinked && providers.some((p) => p !== currentLineProvider);
  const addresses = plainRows(addrRes).map(({ details, ...address }) => ({
    ...address,
    ...JSON.parse(details || "{}"),
  }));
  return { ...user, addresses, lineLinked, legacyLineLinked, canUnlinkLine };
}

export async function unlinkLineAccount(userId) {
  const client = await db();
  const res = await client.execute({
    sql: `DELETE FROM accounts
          WHERE userId = ? AND provider = ?
            AND EXISTS (SELECT 1 FROM accounts WHERE userId = ? AND provider != ?)`,
    args: [userId, currentLineProvider, userId, currentLineProvider],
  });
  return res.rowsAffected === 1;
}

export async function getUserLineId(userId) {
  const client = await db();
  const res = await client.execute({
    sql: "SELECT providerAccountId FROM accounts WHERE userId = ? AND provider = ? LIMIT 1",
    args: [userId, currentLineProvider],
  });
  return res.rows[0]?.providerAccountId ?? null;
}

export async function updateProfile(userId, { name, phone }) {
  const client = await db();
  const res = await client.execute({
    sql: "UPDATE users SET name = ?, phone = ? WHERE id = ?",
    args: [name, phone, userId],
  });
  return res.rowsAffected === 1;
}

export async function saveShippingAddress(userId, id, { label, recipient, phone, address, postalCode, ...extra }) {
  const client = await db();
  if (id) {
    const res = await client.execute({
      sql: "UPDATE addresses SET label = ?, recipient = ?, phone = ?, address = ?, postalCode = ?, details = ? WHERE id = ? AND userId = ?",
      args: [label, recipient, phone, address, postalCode, JSON.stringify(extra), id, userId],
    });
    return res.rowsAffected === 1;
  }
  const res = await client.execute({
    sql: "INSERT INTO addresses (id, userId, label, recipient, phone, address, postalCode, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [randomUUID(), userId, label, recipient, phone, address, postalCode, JSON.stringify(extra), Date.now()],
  });
  return res.rowsAffected === 1;
}

export async function removeShippingAddress(userId, id) {
  const client = await db();
  const res = await client.execute({
    sql: "DELETE FROM addresses WHERE id = ? AND userId = ?",
    args: [id, userId],
  });
  return res.rowsAffected === 1;
}

export async function getOrderByRequest(userId, requestId) {
  const client = await db();
  const res = await client.execute({
    sql: "SELECT id FROM printOrders WHERE userId = ? AND requestId = ?",
    args: [userId, requestId],
  });
  return plainRow(res.rows[0], res.columns);
}

export async function createPrintOrder(userId, { requestId, fileName, model, printSettings, shipping, quote, saveAddress }) {
  const client = await db();
  const existing = await getOrderByRequest(userId, requestId);
  if (existing) return existing.id;

  const id = randomUUID();
  const modelBytes = model instanceof Uint8Array ? model : new Uint8Array(model);
  const tx = await client.transaction("write");
  try {
    if (printSettings.stockId) {
      const result = await tx.execute({
        sql: "SELECT color, hex FROM filamentStock WHERE id = ? AND material = ? AND grams > 0 AND grams >= ?",
        args: [printSettings.stockId, printSettings.material, quote.weight],
      });
      const stock = result.rows[0];
      if (!stock || stock.color !== printSettings.colorLabel || filamentSwatch(stock.color, stock.hex) !== printSettings.color) {
        await tx.rollback();
        return (await getOrderByRequest(userId, requestId))?.id ?? null;
      }
    }
    const inserted = await tx.execute({
      sql: `INSERT INTO printOrders (id, userId, requestId, fileName, model, printSettings, shipping, quote, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(userId, requestId) DO NOTHING`,
      args: [id, userId, requestId, fileName, modelBytes, JSON.stringify(printSettings), JSON.stringify(shipping), JSON.stringify(quote), Date.now()],
    });
    if (!inserted.rowsAffected) {
      const duplicate = await tx.execute({
        sql: "SELECT id FROM printOrders WHERE userId = ? AND requestId = ?",
        args: [userId, requestId],
      });
      await tx.commit();
      return duplicate.rows[0].id;
    }
    await tx.execute({ sql: "INSERT INTO printOrderNotices (orderId) VALUES (?)", args: [id] });
    if (saveAddress) {
      const { label, recipient, phone, address, postalCode, ...extra } = saveAddress;
      await tx.execute({
        sql: "INSERT INTO addresses (id, userId, label, recipient, phone, address, postalCode, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [randomUUID(), userId, label, recipient, phone, address, postalCode, JSON.stringify(extra), Date.now()],
      });
    }
    await tx.commit();
    return id;
  } catch (error) {
    try { await tx.rollback(); } catch {}
    throw error;
  }
}

function hydrateOrder(row) {
  return row ? {
    ...row,
    printSettings: JSON.parse(row.printSettings),
    shipping: JSON.parse(row.shipping),
    quote: JSON.parse(row.quote),
    tracking: JSON.parse(row.tracking),
  } : null;
}

export async function listPrintOrders(userId) {
  const client = await db();
  const columns = [
    "printOrders.id",
    "printOrders.fileName",
    "printOrders.printSettings",
    "printOrders.shipping",
    "printOrders.quote",
    "printOrders.status",
    "printOrders.tracking",
    "printOrders.progressVersion",
    "printOrders.assignee",
    "printOrders.createdAt",
    "printPaymentSlips.submittedAt AS paymentReportedAt",
    "users.name AS customerName",
    "users.email AS customerEmail",
  ].join(", ");
  const from = "FROM printOrders LEFT JOIN users ON users.id = printOrders.userId LEFT JOIN printPaymentSlips ON printPaymentSlips.orderId = printOrders.id";
  const res = userId
    ? await client.execute({
        sql: `SELECT ${columns} ${from} WHERE printOrders.userId = ? AND printOrders.deletedAt IS NULL ORDER BY printOrders.createdAt DESC LIMIT 50`,
        args: [userId],
      })
    : await client.execute(
        `SELECT ${columns} ${from} WHERE printOrders.deletedAt IS NULL ORDER BY printOrders.createdAt DESC LIMIT 50`
      );
  return plainRows(res).map(hydrateOrder);
}

export async function getPrintOrder(id, viewer) {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT id, userId, fileName, printSettings, shipping, quote, status, tracking, progressVersion, assignee, createdAt,
            (SELECT submittedAt FROM printPaymentSlips WHERE orderId = printOrders.id) AS paymentReportedAt
          FROM printOrders WHERE id = ? AND deletedAt IS NULL AND (userId = ? OR ? = 1)`,
    args: [id, viewer.id, viewer.admin ? 1 : 0],
  });
  return hydrateOrder(plainRow(res.rows[0], res.columns));
}

export async function reportPrintPayment(id, userId, mime, image) {
  const client = await db();
  const result = await client.execute({
    sql: `INSERT INTO printPaymentSlips (orderId, mime, image, submittedAt)
          SELECT id, ?, ?, ? FROM printOrders WHERE id = ? AND userId = ? AND status = 'pending_payment' AND deletedAt IS NULL
          ON CONFLICT(orderId) DO UPDATE SET mime = excluded.mime, image = excluded.image, submittedAt = excluded.submittedAt`,
    args: [mime, image, Date.now(), id, userId],
  });
  return result.rowsAffected === 1;
}

export async function getPrintPaymentSlip(id) {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT mime, image FROM printPaymentSlips JOIN printOrders ON printOrders.id = orderId
          WHERE orderId = ? AND printOrders.deletedAt IS NULL`,
    args: [id],
  });
  return result.rows[0];
}

export async function getPrintModel(id) {
  const client = await db();
  const res = await client.execute({
    sql: "SELECT model FROM printOrders WHERE id = ? AND deletedAt IS NULL",
    args: [id],
  });
  const blob = res.rows[0]?.model;
  if (!blob) return null;
  if (blob instanceof Uint8Array) return blob;
  if (blob instanceof ArrayBuffer) return new Uint8Array(blob);
  return new Uint8Array(blob);
}

export async function updateOrderAssignee(id, assignee) {
  const client = await db();
  const res = await client.execute({
    sql: "UPDATE printOrders SET assignee = ? WHERE id = ? AND deletedAt IS NULL",
    args: [assignee, id],
  });
  return res.rowsAffected === 1;
}

export async function softDeletePrintOrder(id) {
  const client = await db();
  const res = await client.execute({
    sql: "UPDATE printOrders SET deletedAt = ? WHERE id = ? AND deletedAt IS NULL",
    args: [Date.now(), id],
  });
  return res.rowsAffected === 1;
}

export async function restorePrintOrder(id) {
  const client = await db();
  const res = await client.execute({
    sql: "UPDATE printOrders SET deletedAt = NULL WHERE id = ? AND deletedAt IS NOT NULL",
    args: [id],
  });
  return res.rowsAffected === 1;
}

export async function updatePrintProgress(id, version, status, tracking) {
  const client = await db();
  const res = await client.execute({
    sql: "UPDATE printOrders SET status = ?, tracking = ?, progressVersion = progressVersion + 1 WHERE id = ? AND progressVersion = ?",
    args: [status, JSON.stringify(tracking), id, version],
  });
  return res.rowsAffected === 1;
}

export async function getPendingOrderNotice(orderId) {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT printOrders.quote
          FROM printOrderNotices JOIN printOrders ON printOrders.id = printOrderNotices.orderId
          WHERE printOrderNotices.orderId = ? AND printOrderNotices.sentAt IS NULL
            AND printOrders.deletedAt IS NULL AND printOrders.createdAt > ?`,
    args: [orderId, Date.now() - 23 * 60 * 60 * 1000],
  });
  return res.rows[0] ? JSON.parse(res.rows[0].quote) : null;
}

export async function markOrderNoticeSent(orderId) {
  const client = await db();
  await client.execute({
    sql: "UPDATE printOrderNotices SET sentAt = ? WHERE orderId = ? AND sentAt IS NULL",
    args: [Date.now(), orderId],
  });
}

export async function listFilamentStock() {
  const client = await db();
  return plainRows(await client.execute("SELECT id, material, color, hex, grams, revision FROM filamentStock ORDER BY material, color"));
}

export async function listAvailableFilaments() {
  const client = await db();
  const result = await client.execute("SELECT id, material, color, hex, grams FROM filamentStock WHERE grams > 0 ORDER BY material, color");
  return result.rows.map(({ id, material, color, hex, grams }) => ({ id, material, label: color, hex: filamentSwatch(color, hex), grams }));
}

export async function addFilamentStock({ material, color, hex, grams }) {
  const client = await db();
  const result = await client.execute({
    sql: `INSERT INTO filamentStock (id, material, color, colorKey, hex, grams)
          VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(material, colorKey) DO NOTHING`,
    args: [randomUUID(), material, color, color.normalize("NFKC").toLowerCase(), hex, grams],
  });
  return result.rowsAffected === 1;
}

export async function updateFilamentStock(id, revision, { material, color, hex, grams }) {
  const client = await db();
  const colorKey = color.normalize("NFKC").toLowerCase();
  const result = await client.execute({
    sql: `UPDATE filamentStock SET material = ?, color = ?, colorKey = ?, hex = ?, grams = ?, revision = revision + 1
          WHERE id = ? AND revision = ? AND NOT EXISTS (
            SELECT 1 FROM filamentStock WHERE material = ? AND colorKey = ? AND id <> ?
          )`,
    args: [material, color, colorKey, hex, grams, id, revision, material, colorKey, id],
  });
  return result.rowsAffected === 1;
}

export async function deleteFilamentStock(id, revision) {
  const client = await db();
  const result = await client.execute({
    sql: "DELETE FROM filamentStock WHERE id = ? AND revision = ?",
    args: [id, revision],
  });
  return result.rowsAffected === 1;
}
