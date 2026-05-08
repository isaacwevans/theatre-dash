// netlify/functions/save-entry.js
const GH_API = "https://api.github.com";

exports.handler = async function handler(event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." }, corsHeaders);

  try {
    const body = JSON.parse(event.body || "{}");
    const password = body.password || "";
    const entry = body.entry || {};

    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
      return json(401, { error: "Wrong password." }, corsHeaders);
    }

    const owner = requiredEnv("GITHUB_OWNER");
    const repo = requiredEnv("GITHUB_REPO");
    const branch = process.env.GITHUB_BRANCH || "main";
    const path = process.env.DATA_PATH || "theatre-data.json";
    const token = requiredEnv("GITHUB_TOKEN");

    validateEntry(entry);

    const apiPath = `${GH_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

    const metaResp = await githubFetch(`${apiPath}?ref=${encodeURIComponent(branch)}`, token, {
      headers: { "Accept": "application/vnd.github+json" }
    });
    if (!metaResp.ok) throw new Error(`Could not load file metadata from GitHub: ${metaResp.status} ${await metaResp.text()}`);
    const meta = await metaResp.json();

    const rawResp = await githubFetch(`${apiPath}?ref=${encodeURIComponent(branch)}`, token, {
      headers: { "Accept": "application/vnd.github.raw" }
    });
    if (!rawResp.ok) throw new Error(`Could not load raw theatre-data.json: ${rawResp.status} ${await rawResp.text()}`);

    const db = JSON.parse(await rawResp.text());
    const result = addEntry(db, entry);

    const content = Buffer.from(JSON.stringify(db, null, 2), "utf8").toString("base64");
    const message = `Add diary entry: ${entry.show} (${entry.date})`;

    const putResp = await githubFetch(apiPath, token, {
      method: "PUT",
      headers: { "Accept": "application/vnd.github+json" },
      body: JSON.stringify({ message, content, sha: meta.sha, branch })
    });

    const putText = await putResp.text();
    let putJson = {};
    try { putJson = JSON.parse(putText); } catch (_) {}

    if (!putResp.ok) throw new Error(`GitHub save failed: ${putResp.status} ${putText}`);

    return json(200, {
      ok: true,
      performanceId: result.performanceId,
      commit: putJson.commit && putJson.commit.sha ? putJson.commit.sha.slice(0, 7) : null,
      message: "Saved."
    }, corsHeaders);
  } catch (err) {
    return json(400, { error: err.message || String(err) }, corsHeaders);
  }
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing Netlify environment variable: ${name}`);
  return value;
}

function json(statusCode, obj, headers) {
  return { statusCode, headers, body: JSON.stringify(obj) };
}

function githubFetch(url, token, options = {}) {
  const headers = Object.assign({
    "Authorization": `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "theatre-diary-netlify-function"
  }, options.headers || {});
  return fetch(url, Object.assign({}, options, { headers }));
}

function norm(s) {
  return String(s || "").replace(/[‘’]/g, "'").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function validateEntry(entry) {
  if (!entry.show) throw new Error("Show is required.");
  if (!entry.date) throw new Error("Date is required.");
  if (!entry.venue) throw new Error("Venue is required.");
  if (!entry.cast || !Array.isArray(entry.cast) || entry.cast.length === 0) {
    throw new Error("At least one cast line is required.");
  }
}

function nextDictId(obj) {
  let max = 0;
  for (const k of Object.keys(obj || {})) max = Math.max(max, Number(k) || 0);
  return max + 1;
}

function nextListId(arr) {
  let max = 0;
  for (const item of arr || []) max = Math.max(max, Number(item.id) || 0);
  return max + 1;
}

function findEntity(obj, field, value, extraFn) {
  const target = norm(value);
  for (const k of Object.keys(obj || {})) {
    const v = obj[k];
    if (norm(v[field]) === target && (!extraFn || extraFn(v))) return v;
  }
  return null;
}

function ensurePerson(db, name, kind) {
  let p = findEntity(db.people, "name", name);
  if (p) {
    p.kinds = p.kinds || [];
    if (!p.kinds.includes(kind)) p.kinds.push(kind);
    return p.id;
  }
  const id = nextDictId(db.people);
  db.people[String(id)] = { id, name, sortName: name, kinds: [kind] };
  return id;
}

function ensureShow(db, title) {
  let s = findEntity(db.shows, "title", title);
  if (s) return s.id;
  const id = nextDictId(db.shows);
  db.shows[String(id)] = { id, title };
  return id;
}

function ensureVenue(db, name, city) {
  let v = findEntity(db.venues, "name", name, x => norm(x.city) === norm(city || ""));
  if (v) return v.id;
  const id = nextDictId(db.venues);
  db.venues[String(id)] = { id, name, city: city || "" };
  return id;
}

function ensureRole(db, showId, name) {
  let r = findEntity(db.roles, "name", name, x => Number(x.showId) === Number(showId));
  if (r) return r.id;
  const id = nextDictId(db.roles);
  db.roles[String(id)] = { id, showId, name };
  return id;
}

function addEntry(db, entry) {
  db.people = db.people || {};
  db.shows = db.shows || {};
  db.venues = db.venues || {};
  db.roles = db.roles || {};
  db.performances = db.performances || {};
  db.appearances = db.appearances || [];
  db.creativeCredits = db.creativeCredits || [];
  db.meta = db.meta || {};

  const showId = ensureShow(db, entry.show);
  const venueId = ensureVenue(db, entry.venue, entry.city || "");

  for (const k of Object.keys(db.performances)) {
    const p = db.performances[k];
    if (
      Number(p.showId) === Number(showId) &&
      Number(p.venueId) === Number(venueId) &&
      String(p.date || "") === String(entry.date || "") &&
      norm(p.time || "") === norm(entry.time || "")
    ) {
      throw new Error("That exact show/date/venue/time already exists. Change the time or delete the duplicate before saving.");
    }
  }

  const performanceId = nextDictId(db.performances);
  const castNorm = [];

  db.performances[String(performanceId)] = {
    id: performanceId,
    showId,
    date: entry.date,
    venueId,
    type: entry.type || "",
    time: entry.time || "",
    notes: entry.notes || "",
    source: { castNormalized: "" }
  };

  let appId = nextListId(db.appearances);

  entry.cast.forEach((row, i) => {
    if (!row || !row.person || !row.role) return;
    const personId = ensurePerson(db, row.person, "performer");
    const roleId = ensureRole(db, showId, row.role);
    const appearanceType = row.coverType === "Swing" ? "swing" : "principal";

    db.appearances.push({
      id: appId++,
      performanceId,
      personId,
      roleId,
      roleRaw: row.role,
      coverType: row.coverType || null,
      coverLabel: row.coverLabel || null,
      appearanceType,
      alsoEnsemble: false,
      displayOrder: i + 1,
      raw: `${row.person} (${row.coverLabel ? "*" + row.coverLabel + " " : ""}${row.role})`
    });

    castNorm.push(`${row.person} (${row.coverLabel ? "*" + row.coverLabel + " " : ""}${row.role})`);
  });

  db.performances[String(performanceId)].source.castNormalized = castNorm.join(", ");

  let creditId = nextListId(db.creativeCredits);
  (entry.creative || []).forEach(row => {
    if (!row || !row.person || !row.credit) return;
    const personId = ensurePerson(db, row.person, "creative");
    db.creativeCredits.push({ id: creditId++, performanceId, personId, credit: row.credit, raw: row.person });
  });

  db.meta.updatedAt = new Date().toISOString();
  db.meta.updatedBy = "Netlify Add Entry";
  db.meta.notes = `${db.meta.notes || ""} Added ${entry.show} ${entry.date}.`.trim();

  return { performanceId };
}
