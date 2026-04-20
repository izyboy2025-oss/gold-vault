/* ═══════════════════════════════════════════════════════════
   GOLDVAULT · app.js - BRIGHT THEME + AVATARS
   Backend: Supabase (Postgres + Storage)
   - payments table  → all payment records
   - screenshots bucket → uploaded images
   Any device, any browser, real-time shared data.
   ═══════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────
//  SUPABASE CONFIG
// ─────────────────────────────────────────────
const SUPA_URL = "https://skwjfpvrskhkvooukjiy.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrd2pmcHZyc2toa3Zvb3Vraml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTY1NzQsImV4cCI6MjA5MjE5MjU3NH0.nfBJOez4yeTJWmQQCN_-E3fXAjhBT3eq6iE7bVd66og";
const BUCKET  = "screenshots";

// ─────────────────────────────────────────────
//  APP CONFIG  — change passwords here
// ─────────────────────────────────────────────
const CFG = {
  WEEKLY_GOAL: 150,  // ← CHANGED FROM 50 TO 150
  PASSWORDS: {
    user1: "Debrah@456",
    user2: "Alexander514@et",
    user3: "Innocent1a@",
    admin: "Admin@1a"
  },
  LABELS: {
    user1: "Evans",
    user2: "Xander",
    user3: "Jesse",
    admin: "Admin - Jesse"
  },
  // NEW: Avatar configuration with emojis and colors
  AVATARS: {
    user1: { emoji: "🤵", color: "#FF6B6B", initials: "EV" },
    user2: { emoji: "🧑", color: "#4ECDC4", initials: "XN" },
    user3: { emoji: "👩‍💼", color: "#95E1D3", initials: "JS" },
    admin: { emoji: "👨‍🔧", color: "#FFB347", initials: "AD" }
  }
};

// ─────────────────────────────────────────────
//  SUPABASE HELPERS
// ─────────────────────────────────────────────
const H = {
  "apikey":        SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Content-Type":  "application/json"
};

// SELECT all payments ordered newest first
async function dbGetPayments() {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/payments?select=*&order=uploaded_at.desc`,
    { headers: H }
  );
  if (!r.ok) throw new Error(`DB read failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// INSERT a new payment row
async function dbInsertPayment(row) {
  const r = await fetch(`${SUPA_URL}/rest/v1/payments`, {
    method:  "POST",
    headers: { ...H, "Prefer": "return=representation" },
    body:    JSON.stringify(row)
  });
  if (!r.ok) throw new Error(`DB insert failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// UPDATE a payment row (verify)
async function dbUpdatePayment(id, updates) {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/payments?id=eq.${encodeURIComponent(id)}`,
    {
      method:  "PATCH",
      headers: { ...H, "Prefer": "return=representation" },
      body:    JSON.stringify(updates)
    }
  );
  if (!r.ok) throw new Error(`DB update failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// UPLOAD image to Supabase Storage, return public URL
async function storageUpload(file, path) {
  // Convert base64 dataURL to Blob
  const [meta, b64] = file.dataUrl.split(",");
  const mime  = meta.split(":")[1].split(";")[0];
  const bin   = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob  = new Blob([bytes], { type: mime });

  const r = await fetch(
    `${SUPA_URL}/storage/v1/object/${BUCKET}/${path}`,
    {
      method:  "POST",
      headers: {
        "apikey":        SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type":  mime,
        "x-upsert":      "true"
      },
      body: blob
    }
  );
  if (!r.ok) throw new Error(`Storage upload failed: ${r.status} ${await r.text()}`);

  // Return the public URL
  return `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ─────────────────────────────────────────────
//  RUNTIME STATE
// ─────────────────────────────────────────────
let currentUser = null;
let pickedFile  = null;   // { dataUrl, name, ext }
let allPayments = [];

// ─────────────────────────────────────────────
//  LOAD DATA
// ─────────────────────────────────────────────
async function loadAllData() {
  showBar();
  try {
    allPayments = await dbGetPayments();
  } catch(err) {
    console.error(err);
    toast("Failed to load data: " + err.message, "err");
  } finally {
    hideBar();
  }
  renderCurrentTab();
}

// ─────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────
let loginUser = "user1";

document.querySelectorAll(".user-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".user-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loginUser = btn.dataset.user;
    document.getElementById("pwInput").value = "";
    document.getElementById("loginErr").classList.add("hidden");
  });
});

function togglePw() {
  const i = document.getElementById("pwInput");
  i.type = i.type === "password" ? "text" : "password";
}

function handleLogin() {
  const pw = document.getElementById("pwInput").value;
  if (pw === CFG.PASSWORDS[loginUser]) {
    currentUser = loginUser;
    document.getElementById("loginErr").classList.add("hidden");
    bootApp();
  } else {
    document.getElementById("loginErr").classList.remove("hidden");
    document.getElementById("pwInput").value = "";
    document.getElementById("pwInput").focus();
  }
}
document.getElementById("pwInput").addEventListener("keydown", e => {
  if (e.key === "Enter") handleLogin();
});

function bootApp() {
  const isAdmin = currentUser === "admin";
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("appShell").classList.add("active");
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", !isAdmin));
  document.querySelectorAll(".member-only").forEach(el => el.classList.toggle("hidden", isAdmin));
  document.getElementById("adminRibbon").classList.toggle("hidden", !isAdmin);
  
  // NEW: Update user avatar and info in sidebar
  const label = CFG.LABELS[currentUser];
  const avatar = CFG.AVATARS[currentUser];
  document.getElementById("userChip").innerHTML = `
    <div class="user-chip-content">
      <div class="user-chip-avatar" style="background-color: ${avatar.color}">${avatar.emoji}</div>
      <div class="user-chip-text">
        <div class="user-chip-name">${label}</div>
        <div class="user-chip-status">Logged in</div>
      </div>
    </div>
  `;
  document.getElementById("topbarUser").textContent = label;
  
  goTab(document.querySelector("[data-tab='dashboard']"), "dashboard");
  loadAllData();
}

function doLogout() {
  currentUser = null;
  pickedFile  = null;
  allPayments = [];
  document.getElementById("appShell").classList.remove("active");
  document.getElementById("loginScreen").classList.add("active");
  document.getElementById("pwInput").value = "";
  document.querySelectorAll(".user-btn").forEach(b => b.classList.remove("active"));
  document.querySelector("[data-user='user1']").classList.add("active");
  loginUser = "user1";
  closeSidebar();
}

// ─────────────────────────────────────────────
//  TABS
// ─────────────────────────────────────────────
let activeTab = "dashboard";

function goTab(el, name) {
  closeSidebar();
  activeTab = name;
  document.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  if (el) el.classList.add("active");
  document.getElementById("tab-" + name)?.classList.add("active");
  renderCurrentTab();
}

function renderCurrentTab() {
  if (activeTab === "dashboard") renderDashboard();
  if (activeTab === "gallery")   renderGallery();
  if (activeTab === "verify")    renderVerify();
}

// ─────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("open");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
}

// ─────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────
function renderDashboard() {
  // FIXED: Filter only verified payments for balance calculations
  const verified = allPayments.filter(p => p.verified);
  const totals   = { user1: 0, user2: 0, user3: 0 };
  
  // FIXED: Calculate totals correctly
  verified.forEach(p => {
    if (totals[p.user_id] !== undefined) {
      totals[p.user_id] += parseFloat(p.amount || 0);
    }
  });
  
  const group = totals.user1 + totals.user2 + totals.user3;

  document.getElementById("totalAmt").textContent = fmt(group);

  const weekPmts = verified.filter(p => sameWeek(p.verified_at));
  const weekAmt  = weekPmts.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const pct      = Math.min(100, (weekAmt / CFG.WEEKLY_GOAL) * 100);
  document.getElementById("progFill").style.width = pct + "%";
  document.getElementById("progLabel").textContent =
    `₵${weekAmt.toFixed(2)} saved this week — ${pct.toFixed(0)}% of ₵${CFG.WEEKLY_GOAL} goal`;

  const now = new Date();
  document.getElementById("weekLabel").textContent =
    `Week ${weekNum(now)}, ${now.getFullYear()}`;

  // NEW: Generate member tiles dynamically with names and emojis
  const membersRow = document.getElementById("membersRow");
  if (membersRow) {
    membersRow.innerHTML = ["user1", "user2", "user3"].map(uid => {
      const userVerified = verified.filter(p => p.user_id === uid)
        .sort((a,b) => new Date(b.verified_at) - new Date(a.verified_at));
      const last = userVerified[0];
      const userLabel = CFG.LABELS[uid];
      const userAvatar = CFG.AVATARS[uid];
      const badgeText = last ? `Last: ${fmt(last.amount)}` : "No payments";
      const badgeClass = last ? "ok" : "";
      
      return `<div class="member-tile">
        <div class="m-avatar" style="background-color: ${userAvatar.color}">${userAvatar.emoji}</div>
        <div class="m-body">
          <div class="m-name">${userAvatar.emoji} ${userLabel}</div>
          <div class="m-paid">${fmt(totals[uid])}</div>
        </div>
        <div class="m-badge ${badgeClass}">${badgeText}</div>
      </div>`;
    }).join("");
  }

  const feed  = document.getElementById("actFeed");
  if (!allPayments.length) {
    feed.innerHTML = `<div class="empty">No activity yet.</div>`;
    return;
  }
  feed.innerHTML = allPayments.slice(0, 20).map(p => {
    const who  = CFG.LABELS[p.user_id] || p.user_id;
    const line = p.verified
      ? `<strong>${who}</strong> paid <strong>${fmt(p.amount)}</strong> — verified by admin`
      : `<strong>${who}</strong> uploaded a screenshot — <em style="color:var(--warn)">pending verification</em>`;
    return `<div class="act-item">
      <div class="act-dot ${p.verified ? "ok" : "warn"}"></div>
      <div>
        <div class="act-text">${line}</div>
        <div class="act-time">${fmtDate(p.uploaded_at)}</div>
      </div>
    </div>`;
  }).join("");
}

// ─────────────────────────────────────────────
//  GALLERY
// ─────────────────────────────────────────────
function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!allPayments.length) {
    grid.innerHTML = `<div class="empty">No screenshots yet.</div>`;
    return;
  }
  grid.innerHTML = allPayments.map(p => {
    const who = CFG.LABELS[p.user_id] || p.user_id;
    const src = p.image_url || placeholder();
    const cap = `${who} · ${fmtDate(p.uploaded_at)}${p.verified ? ` · ${fmt(p.amount)} ✓` : " · Unverified"}`;
    return `<div class="g-item" onclick="openLB('${esc(src)}','${esc(cap)}')">
      <div class="g-img-wrap">
        <img src="${src}" alt="" loading="lazy" onerror="this.src='${placeholder()}'"/>
        <span class="g-badge ${p.verified ? "ver" : "unv"}">${p.verified ? "✓ Verified" : "⏳ Pending"}</span>
      </div>
      <div class="g-meta">
        <div class="g-who">${who}</div>
        <div class="g-when">${fmtDate(p.uploaded_at)}</div>
        <div class="g-amt">${p.verified ? fmt(p.amount) : '<span style="color:var(--muted)">Awaiting</span>'}</div>
      </div>
    </div>`;
  }).join("");
}

// ─────────────────────────────────────────────
//  UPLOAD
// ─────────────────────────────────────────────
function onFileSelect(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase() || "jpg";
  const reader = new FileReader();
  reader.onload = e => {
    pickedFile = { dataUrl: e.target.result, name: file.name, ext };
    document.getElementById("previewImg").src = pickedFile.dataUrl;
    document.getElementById("previewName").textContent = file.name;
    document.getElementById("previewBox").classList.remove("hidden");
    setMsg("", "");
  };
  reader.readAsDataURL(file);
}

function clearFile() {
  pickedFile = null;
  document.getElementById("fileIn").value = "";
  document.getElementById("previewBox").classList.add("hidden");
  setMsg("", "");
}

// Drag & drop
const dz = document.getElementById("dropZone");
dz.addEventListener("dragover",  e => { e.preventDefault(); dz.classList.add("drag"); });
dz.addEventListener("dragleave", ()  => dz.classList.remove("drag"));
dz.addEventListener("drop", e => {
  e.preventDefault();
  dz.classList.remove("drag");
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith("image/")) onFileSelect({ target: { files: [f] } });
});

async function doUpload() {
  if (!pickedFile) { setMsg("Please select an image first.", "err"); return; }

  const btn = document.getElementById("uploadBtn");
  btn.disabled = true;
  setMsg("Uploading screenshot…", "load");

  try {
    const id        = "pmt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const filePath  = `${currentUser}/${id}.${pickedFile.ext}`;

    // 1. Upload image to Supabase Storage
    setMsg("Saving image…", "load");
    const imageUrl = await storageUpload(pickedFile, filePath);

    // 2. Insert payment record into database
    setMsg("Saving record…", "load");
    await dbInsertPayment({
      id,
      user_id:     currentUser,
      image_url:   imageUrl,
      verified:    false,
      amount:      0,
      uploaded_at: new Date().toISOString()
    });

    setMsg("✓ Screenshot submitted! The admin will verify it soon.", "ok");
    clearFile();
    toast("Screenshot uploaded successfully!", "ok");

    // Reload so this upload appears for everyone
    await loadAllData();

  } catch(err) {
    console.error(err);
    setMsg("Upload failed: " + err.message, "err");
  }

  btn.disabled = false;
}

function setMsg(txt, type) {
  const el = document.getElementById("uploadMsg");
  if (!txt) { el.classList.add("hidden"); return; }
  el.textContent = txt;
  el.className   = "msg-bar " + type;
  el.classList.remove("hidden");
}

// ─────────────────────────────────────────────
//  VERIFY  (Admin only)
// ─────────────────────────────────────────────
function renderVerify() {
  const pending = allPayments.filter(p => !p.verified);
  const list    = document.getElementById("verifyList");

  if (!pending.length) {
    list.innerHTML = `<div class="empty">🎉 All payments verified — nothing pending.</div>`;
    return;
  }

  list.innerHTML = pending.map(p => {
    const who = CFG.LABELS[p.user_id] || p.user_id;
    const src = p.image_url || placeholder();
    return `<div class="v-item" id="vi-${p.id}">
      <img class="v-img" src="${src}" loading="lazy"
        onclick="openLB('${esc(src)}','${esc(who + " · " + fmtDate(p.uploaded_at))}')"
        onerror="this.src='${placeholder()}'"/>
      <div class="v-body">
        <div class="v-who">${who}</div>
        <div class="v-when">Uploaded: ${fmtDate(p.uploaded_at)}</div>
        <div class="v-desc">Review the screenshot then enter the exact amount shown.</div>
        <div class="v-row">
          <input class="v-input" type="number" id="va-${p.id}"
            placeholder="₵ amount e.g. 30" min="0.01" step="0.01"/>
          <button class="btn-verify" onclick="doVerify('${p.id}')">✓ Verify</button>
        </div>
        <div id="vok-${p.id}" class="v-ok hidden"></div>
      </div>
    </div>`;
  }).join("");
}

async function doVerify(id) {
  const amount = parseFloat(document.getElementById("va-" + id).value);
  if (!amount || amount <= 0) { alert("Enter the amount from the screenshot."); return; }

  const payment = allPayments.find(p => p.id === id);
  if (!payment) return;

  const btn = document.querySelector(`#vi-${id} .btn-verify`);
  if (btn) btn.disabled = true;

  const who = CFG.LABELS[payment.user_id] || payment.user_id;

  try {
    // Update the row in Supabase
    await dbUpdatePayment(id, {
      verified:    true,
      amount:      amount,
      verified_at: new Date().toISOString(),
      verified_by: "admin"
    });

    // FIXED: Update local state immediately with correct verified_at
    const p = allPayments.find(x => x.id === id);
    if (p) {
      p.verified    = true;
      p.amount      = amount;
      p.verified_at = new Date().toISOString();
    }

    const okEl = document.getElementById("vok-" + id);
    if (okEl) {
      okEl.textContent = `✓ ${fmt(amount)} verified for ${who}`;
      okEl.classList.remove("hidden");
    }

    toast(`Payment of ${fmt(amount)} verified for ${who}`, "ok");

    // FIXED: Refresh dashboard immediately
    renderDashboard();

    setTimeout(() => {
      document.getElementById("vi-" + id)?.remove();
      if (!allPayments.some(x => !x.verified)) {
        document.getElementById("verifyList").innerHTML =
          `<div class="empty">🎉 All payments verified — nothing pending.</div>`;
      }
    }, 1500);

  } catch(err) {
    console.error(err);
    alert("Verification failed: " + err.message);
    if (btn) btn.disabled = false;
  }
}

// ─────────────────────────────────────────────
//  LIGHTBOX
// ─────────────────────────────────────────────
function openLB(src, caption) {
  document.getElementById("lbImg").src = src;
  document.getElementById("lbCaption").textContent = caption;
  document.getElementById("lightbox").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeLightbox() {
  document.getElementById("lightbox").classList.add("hidden");
  document.body.style.overflow = "";
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });

// ─────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────
function showBar() { document.getElementById("loadingBar").classList.remove("hidden"); }
function hideBar() { document.getElementById("loadingBar").classList.add("hidden"); }

let toastTimer;
function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = "toast" + (type ? " " + type : "");
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
}

// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────
function fmt(n) { return "₵" + Number(n || 0).toFixed(2); }

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
}

function weekNum(date) {
  const d  = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dn = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dn);
  const yr = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yr) / 86400000) + 1) / 7);
}

function sameWeek(ts) {
  if (!ts) return false;
  const now = new Date(), d = new Date(ts);
  return weekNum(d) === weekNum(now) && d.getFullYear() === now.getFullYear();
}

function esc(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function placeholder() {
  return "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="160">' +
    '<rect fill="#f0f0f0" width="100%" height="100%"/>' +
    '<text x="50%" y="50%" fill="#999" text-anchor="middle" dy=".35em" font-size="28">📷</text>' +
    '</svg>'
  );
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
document.getElementById("pwInput").focus();