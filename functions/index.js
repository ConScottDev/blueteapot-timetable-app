const { setGlobalOptions } = require("firebase-functions/v2");
setGlobalOptions({
  region: "europe-west1", // use the EU region (works well with eur3)
  // runtime: { node: 18 }   // optional if you want to pin Node here
});

// functions/index.js (v2 API)
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const logger = require("firebase-functions/logger");

initializeApp();

const DEFAULT_SMTP = {
  host: "smtp-relay.brevo.com",
  port: 587,
  user: "98bb09001@smtp-brevo.com",
  pass: "Y2fcnO0Pjv4rh3Iz",
  from: "ensemble@blueteapot.ie",
  fromName: "Blue Teapot Theatre Company",
};

const mailConfig = {
  host: process.env.SMTP_HOST || DEFAULT_SMTP.host,
  port: Number(process.env.SMTP_PORT || DEFAULT_SMTP.port),
  user: process.env.SMTP_USER || DEFAULT_SMTP.user,
  pass: process.env.SMTP_PASS || DEFAULT_SMTP.pass,
  from:
    process.env.SMTP_FROM ||
    process.env.SMTP_SENDER ||
    process.env.SMTP_USER ||
    DEFAULT_SMTP.from,
  fromName: process.env.SMTP_FROM_NAME || DEFAULT_SMTP.fromName || null,
};

if (Number.isNaN(mailConfig.port)) {
  mailConfig.port = DEFAULT_SMTP.port;
}

const ROLE_CLAIMS = [
  "admin",
  "staff",
  "theatre_staff",
  "actor_support_staff",
  "pas_staff",
  "pas_support",
  "actor",
  "student",
];

const SUPER_USER_EMAIL = "ensemble@blueteapot.ie";

const STAFF_ROLE_SET = new Set([
  "admin",
  "staff",
  "theatre_staff",
  "actor_support_staff",
  "pas_staff",
  "pas_support",
]);

const isSuperUser = (ctx) => {
  const email = ctx?.token?.email;
  return typeof email === "string" && email.toLowerCase() === SUPER_USER_EMAIL;
};

function buildClaimsForRole(role = "", group = null) {
  const claims = ROLE_CLAIMS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
  if (ROLE_CLAIMS.includes(role)) {
    claims[role] = true;
  }
  if (STAFF_ROLE_SET.has(role)) {
    claims.staff = true;
  }
  if (role === "admin") {
    claims.admin = true;
  }
  if (group) {
    claims.group = group;
  }
  return claims;
}

let mailTransport = null;
let mailTransportWarned = false;

function getMailTransport() {
  if (mailTransport) return mailTransport;
  if (!mailConfig.host || !mailConfig.user || !mailConfig.pass) {
    if (!mailTransportWarned) {
      mailTransportWarned = true;
      logger.warn("notifyTaskParticipants: SMTP credentials missing. Email notifications disabled.");
    }
    return null;
  }
  mailTransport = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.port === 465,
    auth: {
      user: mailConfig.user,
      pass: mailConfig.pass,
    },
  });
  return mailTransport;
}

function normalizeParticipantIds(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) ids.push(trimmed);
      continue;
    }
    if (entry && typeof entry === "object") {
      const candidates = [entry.id, entry.uid, entry.userId, entry.value];
      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          ids.push(candidate.trim());
          break;
        }
      }
    }
  }
  return Array.from(new Set(ids));
}

function inferFirstName(name, fallback) {
  if (!name) return fallback || "";
  const trimmed = String(name).trim();
  if (!trimmed) return fallback || "";
  const parts = trimmed.split(/\s+/);
  return parts.length ? parts[0] : trimmed;
}

function collectEmailTargets(profile) {
  if (!profile) return [];
  const raw = [
    profile.email,
    ...(Array.isArray(profile.additionalEmails) ? profile.additionalEmails : []),
  ];
  const seen = new Set();
  const addresses = [];
  raw.forEach((entry) => {
    if (typeof entry !== "string") return;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) return;
    seen.add(trimmed.toLowerCase());
    addresses.push(trimmed);
  });
  return addresses;
}

function formatDateEuropean(value) {
  if (!value) return "TBC";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      const [, year, month, day] = match;
      const dd = day.padStart(2, "0");
      const mm = month.padStart(2, "0");
      return `${dd}-${mm}-${year}`;
    }
  }
  try {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const dd = String(date.getDate()).padStart(2, "0");
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const yyyy = date.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
  } catch (_err) {
    // ignore
  }
  return String(value);
}

async function fetchParticipantProfiles(ids) {
  const db = getFirestore();
  return Promise.all(
    ids.map(async (id) => {
      try {
        const snap = await db.collection("users").doc(id).get();
        if (!snap.exists) {
          return { id, missing: true };
        }
        const data = snap.data() || {};
        const displayName = data.displayName || data.name || data.email || id;
        const firstName = data.firstName || inferFirstName(displayName, displayName);
        return {
          id,
          email: data.email || null,
          additionalEmails: Array.isArray(data.additionalEmails) ? data.additionalEmails : [],
          name: displayName,
          firstName,
        };
      } catch (error) {
        logger.error("notifyTaskParticipants: failed to load participant profile", { id, error });
        return { id, error: true };
      }
    })
  );
}

function buildTaskSnapshot(task, nameById) {
  if (!task) return null;
  const participantIds = normalizeParticipantIds(task.participants || []);
  return {
    title: task.title || "",
    date: task.date || "",
    startTime: task.startTime || "",
    endTime: task.endTime || "",
    location: task.location || "",
    tutor: task.tutor || "",
    color: task.color || "",
    strands: Array.isArray(task.strands)
      ? task.strands.map((s) => String(s))
      : task.strands
      ? [String(task.strands)]
      : [],
    production: task.production === true || task.isProductionEvent === true,
    participantIds,
    participantNames: participantIds.map((id) => nameById[id] || id),
  };
}

function formatTaskDetails(snapshot) {
  if (!snapshot) return ["Task details unavailable."];
  const participants =
    snapshot.participantNames && snapshot.participantNames.length
      ? snapshot.participantNames.join(", ")
      : "TBC";
  const timeRange =
    snapshot.startTime && snapshot.endTime
      ? `${snapshot.startTime} - ${snapshot.endTime}`
      : snapshot.startTime || snapshot.endTime || "TBC";
  const formattedDate = formatDateEuropean(snapshot.date);
  return [
    `Title: ${snapshot.title || "Untitled task"}`,
    `Date: ${formattedDate}`,
    `Time: ${timeRange}`,
    `Location: ${snapshot.location || "TBC"}`,
    `Tutor: ${snapshot.tutor || "TBC"}`,
    `Participants: ${participants}`,
  ];
}

function valueForDiff(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).sort().join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return value == null ? "" : String(value);
}

function listDifferences(previous, current) {
  if (!previous || !current) return [];
  const fields = [
    ["title", "Title"],
    ["date", "Date"],
    ["startTime", "Start Time"],
    ["endTime", "End Time"],
    ["location", "Location"],
    ["tutor", "Tutor"],
    ["participantNames", "Participants"],
    ["color", "Colour"],
  ];
  const changes = [];
  for (const [key, label] of fields) {
    let before = valueForDiff(previous[key]);
    let after = valueForDiff(current[key]);
    if (key === "date") {
      before = before ? formatDateEuropean(before) : "";
      after = after ? formatDateEuropean(after) : "";
    }
    if (before !== after) {
      const beforeDisplay = before || "-";
      const afterDisplay = after || "-";
      changes.push(`${label}: ${beforeDisplay} -> ${afterDisplay}`);
    }
  }
  return changes;
}

function buildEmailSubject(changeType, current, previous) {
  const title = (current || previous)?.title || "Untitled task";
  if (changeType === "created") return `New task scheduled: ${title}`;
  if (changeType === "updated") return `Task updated: ${title}`;
  if (changeType === "deleted") return `Task cancelled: ${title}`;
  return `Task notice: ${title}`;
}

function introForChange(changeType) {
  if (changeType === "created") return "A new task has been scheduled for you.";
  if (changeType === "updated") return "A task you are part of has been updated.";
  if (changeType === "deleted") return "A task you were part of has been cancelled.";
  return "There has been an update to one of your tasks.";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailBodies({ greetingName, intro, detailLines, diffLines }) {
  const safeName = greetingName || "there";
  const textParts = [`Hi ${safeName},`, "", intro];
  if (diffLines.length) {
    textParts.push("", "Changes:");
    diffLines.forEach((line) => textParts.push(`- ${line}`));
  }
  textParts.push("", "Task details:");
  detailLines.forEach((line) => textParts.push(`- ${line}`));
  textParts.push(
    "",
    "This message was sent automatically. Please contact the office if you have any questions."
  );
  const text = textParts.join("\n");

  let html = `<p>Hi ${escapeHtml(safeName)},</p>`;
  html += `<p>${escapeHtml(intro)}</p>`;
  if (diffLines.length) {
    html += "<p>Changes:</p><ul>";
    diffLines.forEach((line) => {
      html += `<li>${escapeHtml(line)}</li>`;
    });
    html += "</ul>";
  }
  html += "<p>Task details:</p><ul>";
  detailLines.forEach((line) => {
    html += `<li>${escapeHtml(line)}</li>`;
  });
  html +=
    "</ul><p>This message was sent automatically. Please contact the office if you have any questions.</p>";

  return { text, html };
}

async function maybeQueuePushNotification() {
  // TODO: integrate FCM/mobile push notifications when the client workflow is ready.
}

exports.syncUserClaimsOnWrite = onDocumentWritten("users/{uid}", async (event) => {
  const uid = event.params.uid;
  const afterSnap = event.data?.after;
  const data = afterSnap?.data();

  // If deleted, clear claims
  if (!data) {
    await getAuth().setCustomUserClaims(uid, {});
    return;
  }

  const role = data.role || "staff";
  const group = data.group || null;
  const disabled = !!data.disabled;

  try {
    await getAuth().updateUser(uid, { disabled });
  } catch (_) {
    // ignore if user doesn't exist yet
  }

  const claims = buildClaimsForRole(role, group);
  await getAuth().setCustomUserClaims(uid, claims);
});

exports.notifyTaskParticipants = onDocumentWritten("tasks/{taskId}", async (event) => {
  const taskId = event.params.taskId;
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();

  if (!before && !after) return;

  const changeType = !before ? "created" : !after ? "deleted" : "updated";
  const participantIds = Array.from(
    new Set([
      ...normalizeParticipantIds(before?.participants || []),
      ...normalizeParticipantIds(after?.participants || []),
    ])
  );

  if (participantIds.length === 0) {
    logger.debug("notifyTaskParticipants: no participants to notify", { taskId, changeType });
    return;
  }

  const profiles = await fetchParticipantProfiles(participantIds);
  const nameById = profiles.reduce((acc, profile) => {
    if (profile && profile.name) acc[profile.id] = profile.name;
    return acc;
  }, {});

  const currentSnapshot = buildTaskSnapshot(after, nameById);
  const previousSnapshot = buildTaskSnapshot(before, nameById);
  const recipients = profiles
    .map((profile) => ({ ...profile, emailTargets: collectEmailTargets(profile) }))
    .filter((profile) => profile.emailTargets.length > 0);
  const missingEmail = profiles.filter((profile) => collectEmailTargets(profile).length === 0);

  if (missingEmail.length) {
    logger.warn("notifyTaskParticipants: participants missing email addresses", {
      taskId,
      participantIds: missingEmail.map((p) => p.id),
    });
  }

  const detailSnapshot = changeType === "deleted" ? previousSnapshot : currentSnapshot;
  const detailLines = formatTaskDetails(detailSnapshot);
  const diffLines = changeType === "updated" ? listDifferences(previousSnapshot, currentSnapshot) : [];
  const subject = buildEmailSubject(changeType, currentSnapshot, previousSnapshot);
  const intro = introForChange(changeType);

  const notificationContext = {
    taskId,
    changeType,
    current: currentSnapshot,
    previous: previousSnapshot,
    participants: profiles,
  };

  if (recipients.length === 0) {
    logger.info("notifyTaskParticipants: no recipients with email addresses", { taskId, changeType });
    await maybeQueuePushNotification(notificationContext);
    return;
  }

  const transporter = getMailTransport();
  if (!transporter) {
    logger.warn("notifyTaskParticipants: SMTP not configured, skipping email dispatch", { taskId });
    await maybeQueuePushNotification(notificationContext);
    return;
  }

  await Promise.all(
    recipients.map(async (recipient) => {
      const toAddresses = recipient.emailTargets?.length
        ? recipient.emailTargets
        : collectEmailTargets(recipient);
      if (toAddresses.length === 0) {
        logger.warn("notifyTaskParticipants: skipping recipient with no email targets", {
          taskId,
          participantId: recipient.id,
        });
        return;
      }

      const { text, html } = buildEmailBodies({
        greetingName: recipient.firstName || recipient.name,
        intro,
        detailLines,
        diffLines,
      });

      try {
        await transporter.sendMail({
          to: toAddresses.join(", "),
          from: mailConfig.fromName
            ? `${mailConfig.fromName} <${mailConfig.from || mailConfig.user}>`
            : mailConfig.from || mailConfig.user,
          subject,
          text,
          html,
        });
        logger.info("notifyTaskParticipants: email sent", {
          taskId,
          recipient: toAddresses,
          changeType,
        });
      } catch (error) {
        logger.error("notifyTaskParticipants: failed to send email", {
          taskId,
          recipient: toAddresses,
          changeType,
          error,
        });
      }
    })
  );

  await maybeQueuePushNotification(notificationContext);
});

exports.adminCreateUser = onCall(async (request) => {
  const ctx = request.auth;
  if (!ctx?.token?.admin && !isSuperUser(ctx)) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const { email, firstName = "", lastName = "", role = "staff", group = null } = request.data || {};
  if (!email || !role) {
    throw new HttpsError("invalid-argument", "email and role required");
  }

  const auth = getAuth();
  const db = getFirestore();

  // Create or fetch user
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch {
    userRecord = await auth.createUser({ email, emailVerified: false });
  }

  // Write /users doc (source of truth for your admin UI)
  await db.doc(`users/${userRecord.uid}`).set(
    {
      email,
      firstName,
      lastName,
      role,
      group: group || null,
      disabled: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: ctx.uid,
    },
    { merge: true }
  );

  // Claims will be synced by the trigger above, but you can also set immediately:
  const claims = buildClaimsForRole(role, group);
  await auth.setCustomUserClaims(userRecord.uid, claims);

  return { ok: true, uid: userRecord.uid, claims };
});

exports.adminUpsertAuthUserWithPassword = onCall(async (request) => {
  const ctx = request.auth;
  if (!ctx?.token?.admin && !isSuperUser(ctx)) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const {
    uid,
    email,
    password,
    role = "staff",
    group: groupIn = null,
    displayName = "",
    disabled = false,
    profile = {},
  } = request.data || {};

  if (!email) throw new HttpsError("invalid-argument", "email is required");

  const auth = getAuth();
  const db = getFirestore();

  let userRecord;
  if (uid) {
    // Update or create with a known UID
    try {
      userRecord = await auth.getUser(uid);
      const update = { email, displayName, disabled };
      if (password) update.password = password;
      userRecord = await auth.updateUser(uid, update);
    } catch {
      if (!password) {
        throw new HttpsError("invalid-argument", "password is required when creating a new user");
      }
      userRecord = await auth.createUser({ uid, email, password, displayName, disabled });
    }
  } else {
    // No UID provided: try to find by email, else create
    try {
      userRecord = await auth.getUserByEmail(email);
      const update = { displayName, disabled };
      if (password) update.password = password;
      userRecord = await auth.updateUser(userRecord.uid, update);
    } catch {
      if (!password) {
        throw new HttpsError("invalid-argument", "password is required when creating a new user");
      }
      userRecord = await auth.createUser({ email, password, displayName, disabled });
    }
  }

  const finalUid = userRecord.uid;

  // Derive group if not provided by the client
  let computedGroup = groupIn;
  if (!computedGroup) {
    if (role === "actor") computedGroup = "actors";
    if (role === "student") {
      const yr = (profile && profile.studentMeta && Number(profile.studentMeta.year)) || 1;
      computedGroup = `year${yr}`;
    }
  }

  // Write /users/{uid}
  await db.doc(`users/${finalUid}`).set(
    {
      email,
      role,
      group: computedGroup || null,
      disabled: !!disabled,
      displayName,
      updatedAt: FieldValue.serverTimestamp(),
      ...(profile || {}),
    },
    { merge: true }
  );

  return { ok: true, uid: finalUid };
});

exports.adminDeleteUser = onCall(async (request) => {
  const ctx = request.auth;
  if (!ctx?.token?.admin && !isSuperUser(ctx)) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const { uid } = request.data || {};
  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required");
  }

  const auth = getAuth();
  const db = getFirestore();

  // Delete Auth user (ignore if missing)
  try {
    await auth.deleteUser(uid);
  } catch (e) {
    if (e?.code !== "auth/user-not-found") throw e;
  }

  // Delete Firestore profile (ignore if missing)
  await db.doc(`users/${uid}`).delete();

  return { ok: true };
});

// Public callable used by the web app to resolve a username to an email for sign-in.
// We keep it simple and read from Firestore with admin privileges to avoid exposing
// wider read access in security rules. Errors are deliberately generic to avoid
// leaking whether a username exists during brute-force attempts.
exports.lookupEmailByUsername = onCall(async (request) => {
  const username = (request.data && request.data.username) || "";
  if (typeof username !== "string" || !username.trim()) {
    throw new HttpsError("invalid-argument", "username is required");
  }

  const db = getFirestore();
  const trimmed = username.trim();
  const snap = await db
    .collection("users")
    .where("username", "==", trimmed)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError("not-found", "Username not found");
  }

  const data = snap.docs[0].data() || {};
  const email = data.email;
  if (!email) {
    throw new HttpsError("failed-precondition", "Username missing email");
  }

  return { email };
});
