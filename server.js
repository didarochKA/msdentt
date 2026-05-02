import "dotenv/config";
import cors from "cors";
import express from "express";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import Stripe from "stripe";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaSql = readFileSync(resolve(__dirname, "schema.sql"), "utf8");

const databaseUrl = process.env.DATABASE_URL;
const shouldUsePg =
  Boolean(databaseUrl) &&
  !String(databaseUrl).includes("postgres://user:password@host:5432/dbname") &&
  !String(databaseUrl).includes("@host:");

let pool = null;
let jsonDb = null;

if (shouldUsePg) {
  const useSsl = String(process.env.DATABASE_SSL || "true").toLowerCase() !== "false";
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
  await pool.query(schemaSql);
} else {
  const adapter = new JSONFile(resolve(__dirname, "data", "db.json"));
  jsonDb = new Low(adapter, { users: [], bookings: [], consultations: [], sessions: [], payments: [] });
  await jsonDb.read();
  jsonDb.data ||= { users: [], bookings: [], consultations: [], sessions: [], payments: [] };
  jsonDb.data.payments ||= [];
  await jsonDb.write();
  console.log("API storage: local JSON (data/db.json). Set DATABASE_URL to use Postgres.");
}

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 4000);
const adminEmails = String(process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

app.use(cors());

// Stripe webhooks require raw request body.
app.post("/api/payments/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const stripeKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!stripeKey || !webhookSecret) return res.status(501).send("Stripe is not configured.");

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const sig = String(req.headers["stripe-signature"] || "");
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : "Invalid signature"}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const paymentId = String(session?.metadata?.paymentId || "");
      const bookingId = String(session?.metadata?.bookingId || "");
      const paymentIntentId = session?.payment_intent ? String(session.payment_intent) : null;
      const sessionId = session?.id ? String(session.id) : null;

      if (pool) {
        if (paymentId) {
          await pool.query(
            "update payments set status = $1, stripe_session_id = coalesce($2, stripe_session_id), stripe_payment_intent_id = coalesce($3, stripe_payment_intent_id), updated_at = now() where id = $4",
            ["paid", sessionId, paymentIntentId, paymentId]
          );
        }
        if (bookingId) {
          await pool.query(
            "update bookings set payment_status = $1, payment_provider = $2, payment_session_id = $3, payment_intent_id = $4, updated_at = now() where id = $5",
            ["paid", "stripe", sessionId, paymentIntentId, bookingId]
          );
        }
      } else {
        await jsonDb.read();
        const now = new Date().toISOString();
        const payment = paymentId ? jsonDb.data.payments.find((p) => p.id === paymentId) : null;
        if (payment) {
          payment.status = "paid";
          payment.stripeSessionId = sessionId;
          payment.stripePaymentIntentId = paymentIntentId;
          payment.updatedAt = now;
        }
        const booking = bookingId ? jsonDb.data.bookings.find((b) => b.id === bookingId) : null;
        if (booking) {
          booking.paymentStatus = "paid";
          booking.paymentProvider = "stripe";
          booking.paymentSessionId = sessionId;
          booking.paymentIntentId = paymentIntentId;
          booking.updatedAt = now;
        }
        await jsonDb.write();
      }
    }
    // Always 200 so Stripe doesn't retry forever for handled events.
    res.json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Webhook handler failed.");
  }
});

app.use(express.json());

const distDir = resolve(__dirname, "dist");
const distIndexHtml = resolve(distDir, "index.html");
const shouldServeFrontend = existsSync(distIndexHtml);

if (!shouldServeFrontend) {
  app.get("/", (_, res) => {
    res.send("MsDent API is running. Use /api/health");
  });
}

function normalizeEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizePhoneDigits(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("8") && d.length === 11) d = `7${d.slice(1)}`;
  if (d.length === 10 && d.startsWith("7")) d = `7${d}`;
  return d.length === 11 && d.startsWith("7") ? d : null;
}

function normalizeDoctorId(raw) {
  const id = String(raw || "").trim();
  if (!id) return null;
  if (!/^[a-z0-9-]{3,64}$/i.test(id)) return null;
  return id;
}

function normalizeBookingReason(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  return s.slice(0, 200);
}

function hashPassword(password) {
  return scryptSync(password, "msdent-static-salt", 64).toString("hex");
}

function isPasswordValid(password, hashedPassword) {
  const incoming = Buffer.from(hashPassword(password), "hex");
  const saved = Buffer.from(hashedPassword, "hex");
  if (incoming.length !== saved.length) return false;
  return timingSafeEqual(incoming, saved);
}

function getBearerToken(req) {
  const raw = String(req.headers.authorization || "");
  if (!raw) return null;
  const [kind, token] = raw.split(" ");
  if (kind !== "Bearer" || !token) return null;
  return token.trim() || null;
}

async function getSessionUserId(token) {
  if (pool) {
    const sessionRes = await pool.query("select user_id from sessions where token = $1", [token]);
    return sessionRes.rows[0]?.user_id || null;
  }

  await jsonDb.read();
  const session = jsonDb.data.sessions.find((s) => s.token === token);
  return session?.userId || null;
}

async function getUserById(userId) {
  if (pool) {
    const userRes = await pool.query("select id, email, name, is_admin, created_at from users where id = $1", [userId]);
    return userRes.rows[0] || null;
  }

  await jsonDb.read();
  return jsonDb.data.users.find((u) => u.id === userId) || null;
}

async function setUserAdminFlag(userId, shouldBeAdmin) {
  if (pool) {
    await pool.query("update users set is_admin = $1 where id = $2", [shouldBeAdmin, userId]);
    return;
  }

  await jsonDb.read();
  const user = jsonDb.data.users.find((u) => u.id === userId);
  if (user) {
    user.isAdmin = shouldBeAdmin;
    await jsonDb.write();
  }
}

function normalizeUserForClient(user) {
  if (!user) return null;
  return {
    email: user.email,
    name: user.name,
    isAdmin: Boolean(pool ? user.is_admin : user.isAdmin),
  };
}

async function requireAdmin(req, res) {
  const token = getBearerToken(req);
  if (!token) return { ok: false, res: res.status(401).json({ message: "Нет токена авторизации." }) };

  const userId = await getSessionUserId(token);
  if (!userId) return { ok: false, res: res.status(401).json({ message: "Сессия не найдена. Войдите заново." }) };

  const user = await getUserById(userId);
  if (!user) return { ok: false, res: res.status(401).json({ message: "Пользователь не найден." }) };
  const isAdmin = Boolean(pool ? user.is_admin : user.isAdmin);
  if (!isAdmin) return { ok: false, res: res.status(403).json({ message: "Недостаточно прав." }) };

  return { ok: true, user };
}

async function requireAuth(req, res) {
  const token = getBearerToken(req);
  if (!token) return { ok: false, res: res.status(401).json({ message: "Нет токена авторизации." }) };

  const userId = await getSessionUserId(token);
  if (!userId) return { ok: false, res: res.status(401).json({ message: "Сессия не найдена. Войдите заново." }) };

  const user = await getUserById(userId);
  if (!user) return { ok: false, res: res.status(401).json({ message: "Пользователь не найден." }) };

  return { ok: true, user };
}

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

function parseKztAmount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if (n < 100) return null;
  if (n > 10_000_000) return null;
  return n;
}

function getPublicBaseUrl(req) {
  const fromEnv = String(process.env.PUBLIC_BASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) return null;
  return `${proto}://${host}`;
}

app.post("/api/payments/checkout", async (req, res) => {
  const stripeKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!stripeKey) {
    return res.status(501).json({
      message:
        "Онлайн-оплата не настроена: добавьте STRIPE_SECRET_KEY в .env (Stripe secret key), затем перезапустите API.",
    });
  }

  const baseUrl = getPublicBaseUrl(req);
  if (!baseUrl) return res.status(400).json({ message: "Не удалось определить адрес сайта (host)." });

  const depositKzt = parseKztAmount(process.env.PAYMENT_DEPOSIT_KZT || 5000);
  if (!depositKzt) return res.status(500).json({ message: "Некорректная настройка PAYMENT_DEPOSIT_KZT." });

  const reason = normalizeBookingReason(req.body?.reason);
  const doctorId = normalizeDoctorId(req.body?.doctorId);
  const plan = req.body?.plan ? String(req.body.plan).slice(0, 80) : null;
  const customerPhone = normalizePhoneDigits(req.body?.phone);
  if (!customerPhone) return res.status(400).json({ message: "Введите корректный номер телефона." });
  if (!reason) return res.status(400).json({ message: "Выберите тип приёма / направление." });

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const bookingId = randomUUID();
  const paymentId = randomUUID();
  const nowIso = new Date().toISOString();

  if (pool) {
    await pool.query(
      "insert into bookings (id, phone, plan, doctor_id, reason, status, note, payment_status, payment_provider, payment_amount_kzt) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
      [bookingId, customerPhone, plan, doctorId, reason, "new", null, "pending", "stripe", depositKzt]
    );
    await pool.query(
      "insert into payments (id, provider, status, amount_kzt, booking_id, stripe_session_id, stripe_payment_intent_id, metadata) values ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        paymentId,
        "stripe",
        "created",
        depositKzt,
        bookingId,
        null,
        null,
        { reason, doctorId: doctorId || "", plan: plan || "", phone: customerPhone },
      ]
    );
  } else {
    await jsonDb.read();
    jsonDb.data.bookings.push({
      id: bookingId,
      phone: customerPhone,
      plan,
      doctorId: doctorId || null,
      reason,
      status: "new",
      note: null,
      assignedTo: null,
      assignedAt: null,
      paymentStatus: "pending",
      paymentProvider: "stripe",
      paymentSessionId: null,
      paymentIntentId: null,
      paymentAmountKzt: depositKzt,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    jsonDb.data.payments.push({
      id: paymentId,
      provider: "stripe",
      status: "created",
      amountKzt: depositKzt,
      currency: "kzt",
      bookingId,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      metadata: { reason, doctorId: doctorId || "", plan: plan || "", phone: customerPhone },
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await jsonDb.write();
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    success_url: `${baseUrl}/#/?payment=success&bookingId=${encodeURIComponent(bookingId)}`,
    cancel_url: `${baseUrl}/#/?payment=cancel&bookingId=${encodeURIComponent(bookingId)}`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "kzt",
          unit_amount: depositKzt * 100,
          product_data: {
            name: "Депозит за запись в MsDent",
            description: reason
              ? `Направление: ${reason}${plan ? `. План: ${plan}` : ""}${doctorId ? `. Врач: ${doctorId}` : ""}`
              : plan
                ? `План: ${plan}`
                : undefined,
          },
        },
      },
    ],
    metadata: {
      paymentId,
      bookingId,
      reason: reason || "",
      doctorId: doctorId || "",
      plan: plan || "",
      phone: customerPhone || "",
    },
  });

  if (!session.url) return res.status(500).json({ message: "Stripe не вернул ссылку на оплату." });

  // store session id for reconciliation (best effort)
  try {
    if (pool) {
      await pool.query("update bookings set payment_session_id = $1, updated_at = now() where id = $2", [session.id, bookingId]);
      await pool.query("update payments set stripe_session_id = $1, updated_at = now() where id = $2", [session.id, paymentId]);
    } else {
      await jsonDb.read();
      const booking = jsonDb.data.bookings.find((b) => b.id === bookingId);
      const payment = jsonDb.data.payments.find((p) => p.id === paymentId);
      if (booking) booking.paymentSessionId = session.id;
      if (payment) payment.stripeSessionId = session.id;
      await jsonDb.write();
    }
  } catch {
    // ignore
  }

  res.json({ ok: true, url: session.url });
});

app.get("/api/accounts/me", async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth.ok) return;

  const shouldBeAdmin = adminEmails.includes(String(auth.user.email || "").toLowerCase());
  const currentAdmin = Boolean(pool ? auth.user.is_admin : auth.user.isAdmin);
  if (currentAdmin !== shouldBeAdmin) {
    await setUserAdminFlag(auth.user.id, shouldBeAdmin);
    if (pool) auth.user.is_admin = shouldBeAdmin;
    else auth.user.isAdmin = shouldBeAdmin;
  }

  res.json({
    account: normalizeUserForClient(auth.user),
  });
});

app.get("/api/admin/dashboard", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth.ok) return;

  let users = [];
  let bookings = [];
  let consultations = [];

  if (pool) {
    const usersRes = await pool.query("select id, email, name, is_admin, created_at from users order by created_at desc");
    const bookingsRes = await pool.query(
      "select id, phone, plan, doctor_id, reason, status, note, assigned_to, assigned_at, created_at, updated_at from bookings order by created_at desc"
    );
    const consultationsRes = await pool.query(
      "select id, email, status, note, assigned_to, assigned_at, created_at, updated_at from consultations order by created_at desc"
    );
    users = usersRes.rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isAdmin: Boolean(u.is_admin),
      createdAt: u.created_at,
    }));
    bookings = bookingsRes.rows.map((b) => ({
      id: b.id,
      phone: b.phone,
      plan: b.plan,
      doctorId: b.doctor_id || null,
      reason: b.reason || null,
      status: b.status || "new",
      note: b.note || null,
      assignedTo: b.assigned_to || null,
      assignedAt: b.assigned_at || null,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    }));
    consultations = consultationsRes.rows.map((c) => ({
      id: c.id,
      email: c.email,
      status: c.status || "new",
      note: c.note || null,
      assignedTo: c.assigned_to || null,
      assignedAt: c.assigned_at || null,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  } else {
    await jsonDb.read();
    users = [...jsonDb.data.users]
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        isAdmin: Boolean(u.isAdmin),
        createdAt: u.createdAt,
      }));
    bookings = [...jsonDb.data.bookings]
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map((b) => ({
        id: b.id,
        phone: b.phone,
        plan: b.plan ?? null,
        doctorId: b.doctorId ?? null,
        reason: b.reason ?? null,
        status: b.status || "new",
        note: b.note ?? null,
        assignedTo: b.assignedTo ?? null,
        assignedAt: b.assignedAt ?? null,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt ?? b.createdAt,
      }));
    consultations = [...jsonDb.data.consultations]
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map((c) => ({
        id: c.id,
        email: c.email,
        status: c.status || "new",
        note: c.note ?? null,
        assignedTo: c.assignedTo ?? null,
        assignedAt: c.assignedAt ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt ?? c.createdAt,
      }));
  }

  res.json({
    stats: {
      users: users.length,
      bookings: bookings.length,
      consultations: consultations.length,
    },
    users,
    bookings,
    consultations,
  });
});

app.delete("/api/admin/bookings/:id", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth.ok) return;

  const id = String(req.params.id || "");
  if (pool) {
    const r = await pool.query("delete from bookings where id = $1", [id]);
    res.json({ ok: true, removed: r.rowCount > 0 });
    return;
  }

  await jsonDb.read();
  const before = jsonDb.data.bookings.length;
  jsonDb.data.bookings = jsonDb.data.bookings.filter((b) => b.id !== id);
  const removed = jsonDb.data.bookings.length !== before;
  await jsonDb.write();
  res.json({ ok: true, removed });
});

app.delete("/api/admin/consultations/:id", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth.ok) return;

  const id = String(req.params.id || "");
  if (pool) {
    const r = await pool.query("delete from consultations where id = $1", [id]);
    res.json({ ok: true, removed: r.rowCount > 0 });
    return;
  }

  await jsonDb.read();
  const before = jsonDb.data.consultations.length;
  jsonDb.data.consultations = jsonDb.data.consultations.filter((c) => c.id !== id);
  const removed = jsonDb.data.consultations.length !== before;
  await jsonDb.write();
  res.json({ ok: true, removed });
});

function normalizeAdminStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "new" || v === "in_progress" || v === "done") return v;
  return null;
}

function normalizeAdminNote(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.slice(0, 2000);
}

function normalizeAdminAssignee(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.slice(0, 120);
}

function mapPgBookingRow(b) {
  return {
    id: b.id,
    phone: b.phone,
    plan: b.plan,
    doctorId: b.doctor_id || null,
    reason: b.reason || null,
    status: b.status || "new",
    note: b.note || null,
    assignedTo: b.assigned_to || null,
    assignedAt: b.assigned_at || null,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}

app.patch("/api/admin/bookings/:id", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth.ok) return;

  const id = String(req.params.id || "");
  const status = req.body?.status !== undefined ? normalizeAdminStatus(req.body.status) : undefined;
  const note = req.body?.note !== undefined ? normalizeAdminNote(req.body.note) : undefined;
  const assignedTo = req.body?.assignedTo !== undefined ? normalizeAdminAssignee(req.body.assignedTo) : undefined;

  if (status === null) return res.status(400).json({ message: "Некорректный статус." });
  if (note === null && req.body?.note !== undefined && String(req.body.note).trim() !== "") {
    return res.status(400).json({ message: "Некорректная заметка." });
  }
  if (assignedTo === null && req.body?.assignedTo !== undefined && String(req.body.assignedTo).trim() !== "") {
    return res.status(400).json({ message: "Некорректный менеджер." });
  }

  const updatedAt = new Date().toISOString();

  if (pool) {
    const existingRes = await pool.query(
      "select id, phone, plan, doctor_id, reason, status, note, assigned_to, assigned_at, created_at, updated_at from bookings where id = $1",
      [id]
    );
    const existing = existingRes.rows[0];
    if (!existing) return res.status(404).json({ message: "Заявка не найдена." });

    const nextStatus = status === undefined ? existing.status : status;
    const nextNote = note === undefined ? existing.note : note;
    const nextAssignedTo = assignedTo === undefined ? existing.assigned_to : assignedTo;
    const shouldStampAssignee = assignedTo !== undefined;

    await pool.query(
      "update bookings set status = $1, note = $2, assigned_to = $3, assigned_at = case when $4 then now() else assigned_at end, updated_at = now() where id = $5",
      [nextStatus || "new", nextNote, nextAssignedTo, shouldStampAssignee, id]
    );
    const outRes = await pool.query(
      "select id, phone, plan, doctor_id, reason, status, note, assigned_to, assigned_at, created_at, updated_at from bookings where id = $1",
      [id]
    );
    return res.json({ ok: true, booking: mapPgBookingRow(outRes.rows[0]) });
  }

  await jsonDb.read();
  const booking = jsonDb.data.bookings.find((b) => b.id === id);
  if (!booking) return res.status(404).json({ message: "Заявка не найдена." });
  if (status !== undefined) booking.status = status;
  if (note !== undefined) booking.note = note;
  if (assignedTo !== undefined) {
    booking.assignedTo = assignedTo;
    booking.assignedAt = new Date().toISOString();
  }
  booking.updatedAt = updatedAt;
  await jsonDb.write();
  res.json({ ok: true, booking });
});

app.patch("/api/admin/consultations/:id", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth.ok) return;

  const id = String(req.params.id || "");
  const status = req.body?.status !== undefined ? normalizeAdminStatus(req.body.status) : undefined;
  const note = req.body?.note !== undefined ? normalizeAdminNote(req.body.note) : undefined;
  const assignedTo = req.body?.assignedTo !== undefined ? normalizeAdminAssignee(req.body.assignedTo) : undefined;

  if (status === null) return res.status(400).json({ message: "Некорректный статус." });
  if (note === null && req.body?.note !== undefined && String(req.body.note).trim() !== "") {
    return res.status(400).json({ message: "Некорректная заметка." });
  }
  if (assignedTo === null && req.body?.assignedTo !== undefined && String(req.body.assignedTo).trim() !== "") {
    return res.status(400).json({ message: "Некорректный менеджер." });
  }

  const updatedAt = new Date().toISOString();

  if (pool) {
    const existingRes = await pool.query(
      "select id, email, status, note, assigned_to, assigned_at, created_at, updated_at from consultations where id = $1",
      [id]
    );
    const existing = existingRes.rows[0];
    if (!existing) return res.status(404).json({ message: "Заявка не найдена." });

    const nextStatus = status === undefined ? existing.status : status;
    const nextNote = note === undefined ? existing.note : note;
    const nextAssignedTo = assignedTo === undefined ? existing.assigned_to : assignedTo;
    const shouldStampAssignee = assignedTo !== undefined;

    await pool.query(
      "update consultations set status = $1, note = $2, assigned_to = $3, assigned_at = case when $4 then now() else assigned_at end, updated_at = now() where id = $5",
      [nextStatus || "new", nextNote, nextAssignedTo, shouldStampAssignee, id]
    );
    const outRes = await pool.query(
      "select id, email, status, note, assigned_to, assigned_at, created_at, updated_at from consultations where id = $1",
      [id]
    );
    return res.json({ ok: true, consultation: outRes.rows[0] });
  }

  await jsonDb.read();
  const consultation = jsonDb.data.consultations.find((c) => c.id === id);
  if (!consultation) return res.status(404).json({ message: "Заявка не найдена." });
  if (status !== undefined) consultation.status = status;
  if (note !== undefined) consultation.note = note;
  if (assignedTo !== undefined) {
    consultation.assignedTo = assignedTo;
    consultation.assignedAt = new Date().toISOString();
  }
  consultation.updatedAt = updatedAt;
  await jsonDb.write();
  res.json({ ok: true, consultation });
});

app.post("/api/accounts/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const name = String(req.body?.name || "").trim();
  const password = String(req.body?.password || "");

  if (!email) return res.status(400).json({ message: "Введите корректный email." });
  if (name.length < 2) return res.status(400).json({ message: "Укажите имя (минимум 2 символа)." });
  if (password.length < 6) return res.status(400).json({ message: "Пароль должен содержать минимум 6 символов." });

  if (pool) {
    const existsRes = await pool.query("select 1 from users where email = $1", [email]);
    if (existsRes.rowCount > 0) return res.status(409).json({ message: "Аккаунт с таким email уже существует. Войдите в него." });
  } else {
    await jsonDb.read();
    const exists = jsonDb.data.users.some((u) => String(u.email || "").toLowerCase() === email);
    if (exists) return res.status(409).json({ message: "Аккаунт с таким email уже существует. Войдите в него." });
  }

  const user = {
    id: randomUUID(),
    email,
    name,
    hashedPassword: hashPassword(password),
    isAdmin: adminEmails.includes(email),
    createdAt: new Date().toISOString(),
  };
  const token = randomUUID();
  if (pool) {
    await pool.query("insert into users (id, email, name, hashed_password, is_admin) values ($1, $2, $3, $4, $5)", [
      user.id,
      user.email,
      user.name,
      user.hashedPassword,
      user.isAdmin,
    ]);
    await pool.query("insert into sessions (id, token, user_id) values ($1, $2, $3)", [randomUUID(), token, user.id]);
  } else {
    await jsonDb.read();
    jsonDb.data.users.push(user);
    jsonDb.data.sessions.push({ id: randomUUID(), token, userId: user.id, createdAt: new Date().toISOString() });
    await jsonDb.write();
  }

  res.status(201).json({ account: { email: user.email, name: user.name, isAdmin: user.isAdmin }, token });
});

app.post("/api/accounts/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ message: "Введите email и пароль." });
  }

  let user = null;
  if (pool) {
    const userRes = await pool.query("select id, email, name, hashed_password, is_admin from users where email = $1", [email]);
    user = userRes.rows[0] || null;
    if (!user || !isPasswordValid(password, user.hashed_password)) {
      return res.status(401).json({ message: "Неверный email или пароль." });
    }
    // backfill role for older records + keep in sync with .env
    const shouldBeAdmin = adminEmails.includes(user.email);
    if (Boolean(user.is_admin) !== shouldBeAdmin) {
      await setUserAdminFlag(user.id, shouldBeAdmin);
      user.is_admin = shouldBeAdmin;
    }

    const token = randomUUID();
    await pool.query("insert into sessions (id, token, user_id) values ($1, $2, $3)", [randomUUID(), token, user.id]);
    res.json({ account: { email: user.email, name: user.name, isAdmin: Boolean(user.is_admin) }, token });
    return;
  }

  await jsonDb.read();
  user = jsonDb.data.users.find((u) => String(u.email || "").toLowerCase() === email) || null;
  if (!user || !isPasswordValid(password, user.hashedPassword)) {
    return res.status(401).json({ message: "Неверный email или пароль." });
  }
  const shouldBeAdmin = adminEmails.includes(user.email);
  if (Boolean(user.isAdmin) !== shouldBeAdmin) {
    user.isAdmin = shouldBeAdmin;
    await jsonDb.write();
  }

  const token = randomUUID();
  jsonDb.data.sessions.push({ id: randomUUID(), token, userId: user.id, createdAt: new Date().toISOString() });
  await jsonDb.write();
  res.json({ account: { email: user.email, name: user.name, isAdmin: Boolean(user.isAdmin) }, token });
});

app.post("/api/bookings", async (req, res) => {
  const phone = normalizePhoneDigits(req.body?.phone);
  const plan = req.body?.plan ? String(req.body.plan) : null;
  const doctorId = normalizeDoctorId(req.body?.doctorId);
  const reason = normalizeBookingReason(req.body?.reason);
  if (!phone) {
    return res.status(400).json({ message: "Введите корректный номер телефона." });
  }
  if (!reason) {
    return res.status(400).json({ message: "Выберите тип приёма / направление." });
  }
  if (req.body?.doctorId && !doctorId) {
    return res.status(400).json({ message: "Некорректный идентификатор врача." });
  }

  if (pool) {
    await pool.query("insert into bookings (id, phone, plan, doctor_id, reason, status, note) values ($1, $2, $3, $4, $5, $6, $7)", [
      randomUUID(),
      phone,
      plan,
      doctorId,
      reason,
      "new",
      null,
    ]);
  } else {
    await jsonDb.read();
    const now = new Date().toISOString();
    jsonDb.data.bookings.push({
      id: randomUUID(),
      phone,
      plan,
      doctorId,
      reason,
      status: "new",
      note: null,
      assignedTo: null,
      assignedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await jsonDb.write();
  }

  res.status(201).json({ ok: true });
});

app.post("/api/consultations", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ message: "Введите корректный email." });
  }

  if (pool) {
    await pool.query("insert into consultations (id, email, status, note) values ($1, $2, $3, $4)", [
      randomUUID(),
      email,
      "new",
      null,
    ]);
  } else {
    await jsonDb.read();
    const now = new Date().toISOString();
    jsonDb.data.consultations.push({
      id: randomUUID(),
      email,
      status: "new",
      note: null,
      assignedTo: null,
      assignedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await jsonDb.write();
  }

  res.status(201).json({ ok: true });
});

if (shouldServeFrontend) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(distIndexHtml);
  });
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  if (shouldServeFrontend) console.log(`Frontend: serving ${distDir}`);
});
