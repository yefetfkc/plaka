/* plaka — istemci (sürüm 2) */
(function () {
  "use strict";

  // ================================================================ sabit veri
  const CITIES = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Amasya","Ankara","Antalya","Artvin","Aydın","Balıkesir","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Isparta","Mersin","İstanbul","İzmir","Kars","Kastamonu","Kayseri","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Kahramanmaraş","Mardin","Muğla","Muş","Nevşehir","Niğde","Ordu","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Tekirdağ","Tokat","Trabzon","Tunceli","Şanlıurfa","Uşak","Van","Yozgat","Zonguldak","Aksaray","Bayburt","Karaman","Kırıkkale","Batman","Şırnak","Bartın","Ardahan","Iğdır","Yalova","Karabük","Kilis","Osmaniye","Düzce"];
  const REGIONS = {
    "Marmara": [10, 11, 16, 17, 22, 34, 39, 41, 54, 59, 77],
    "Ege": [3, 9, 20, 35, 43, 45, 48, 64],
    "Akdeniz": [1, 7, 15, 31, 32, 33, 46, 80],
    "İç Anadolu": [6, 18, 26, 38, 40, 42, 50, 51, 58, 66, 68, 70, 71],
    "Karadeniz": [5, 8, 14, 19, 28, 29, 37, 52, 53, 55, 57, 60, 61, 67, 69, 74, 78, 81],
    "Doğu Anadolu": [4, 12, 13, 23, 24, 25, 30, 36, 44, 49, 62, 65, 75, 76],
    "Güneydoğu": [2, 21, 27, 47, 56, 63, 72, 73, 79]
  };
  const REGION_OF = {};
  Object.entries(REGIONS).forEach(([r, codes]) => codes.forEach(c => { REGION_OF[c] = r; }));
  const MON = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const MONTH = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const VIEWS = { plates: "", map: "#harita", stats: "#istatistik", history: "#gecmis", settings: "#ayarlar" };

  const pad = (n) => String(n).padStart(2, "0");
  const city = (c) => CITIES[c - 1];
  const label = (c) => `${pad(c)} ${city(c)}`;
  const norm = (s) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

  // Tarihler veritabanında eskisi gibi "gg.aa.yyyy" metni olarak saklanır.
  const todayStr = () => { const d = new Date(); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
  const parseDate = (s) => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s || ""); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };
  // Kaydedilebilir tarih: takvimde gerçekten olan bir gün, 2000'den bugüne (sunucu da aynısını ister)
  const okDate = (s) => {
    if (typeof s !== "string") return false;
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s); if (!m) return false;
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    if (d.getFullYear() !== +m[3] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[1]) return false;
    const end = new Date(); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() + 1);
    return +m[3] >= 2000 && d <= end;
  };
  const toInput = (s) => { const d = parseDate(s); return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : ""; };
  const fromInput = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? `${m[3]}.${m[2]}.${m[1]}` : todayStr(); };
  // "36'sını", "21'ini" gibi Türkçe ek (belirtme + iyelik)
  const acc = (n) => {
    const u = n % 10, t = Math.floor(n / 10) % 10;
    const U = ["", "'ini", "'sini", "'ünü", "'ünü", "'ini", "'sını", "'sini", "'ini", "'unu"];
    const T = ["", "'unu", "'sini", "'unu", "'ını", "'sini", "'ını", "'ini", "'ini", "'ını"];
    return n + (u ? U[u] : t ? T[t] : "'ını");
  };
  const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const pretty = (s) => { const d = parseDate(s); return d ? `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}` : (s || ""); };

  // ================================================================ yardımcılar
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach(k => { if (k != null && k !== false) n.append(k); });
    return n;
  }
  const svgIcon = (d) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.append(p); return s; };

  const session = {
    get(k) { try { return localStorage.getItem(k) || sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v, remember) { try { (remember ? localStorage : sessionStorage).setItem(k, v); } catch (e) {} },
    clear() { try { ["token", "username"].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); }); } catch (e) {} },
  };

  async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json" };
    const t = session.get("token");
    if (t) headers.Authorization = `Bearer ${t}`;
    let res;
    try { res = await fetch(path, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined }); }
    catch (e) { throw new Error("Sunucuya ulaşılamadı. İnternet bağlantını kontrol et."); }
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (res.status === 401 && t) { session.clear(); showAuth("Oturumun sona erdi, lütfen yeniden giriş yap."); throw new Error("Oturum sona erdi."); }
    if (!res.ok || data.error) { const err = new Error(data.error || "Bir şeyler ters gitti, tekrar dene."); err.status = res.status; throw err; }
    return data;
  }

  // ---------------------------------------------------------------- bildirim
  let toastTimer = null, toastAction = null;
  function toast(text, action) {
    $("toast-text").textContent = text;
    toastAction = action || null;
    const b = $("toast-undo");
    b.hidden = !action; if (action) b.textContent = action.label;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").hidden = true; toastAction = null; }, action ? 5500 : 3000);
  }
  $("toast-undo").addEventListener("click", () => { const a = toastAction; $("toast").hidden = true; toastAction = null; if (a) a.run(); });

  // ---------------------------------------------------------------- onay penceresi
  function confirmDlg({ title, text, yes = "Evet", danger = true }) {
    return new Promise((resolve) => {
      const d = $("dlg-confirm");
      $("cf-title").textContent = title; $("cf-text").textContent = text;
      const y = $("cf-yes"); y.textContent = yes; y.className = "btn " + (danger ? "danger" : "primary");
      const done = (v) => { d.close(); resolve(v); };
      y.onclick = () => done(true); $("cf-no").onclick = () => done(false);
      d.oncancel = () => resolve(false);
      d.showModal(); setTimeout(() => $("cf-no").focus(), 0);
    });
  }
  $$("dialog").forEach(d => {
    d.addEventListener("click", (e) => { if (e.target === d && d.id !== "dlg-confirm") d.close(); });
    $$("[data-close]", d).forEach(b => b.addEventListener("click", () => d.close()));
  });

  // ================================================================ ayarlar (bu cihazda saklanır)
  const DEFAULTS = { theme: "system", density: "normal", showDates: true, tapAction: "mark", haptics: true, sound: true, season: false, hintSeen: false };
  let prefs = { ...DEFAULTS };
  try {
    prefs = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("plaka-ayarlar") || "{}") };
    const old = localStorage.getItem("plaka-tema"); if (old && !localStorage.getItem("plaka-ayarlar")) prefs.theme = old;
  } catch (e) {}
  const savePrefs = () => { try { localStorage.setItem("plaka-ayarlar", JSON.stringify(prefs)); } catch (e) {} };

  function applyPrefs() {
    const root = document.documentElement;
    if (prefs.theme === "light" || prefs.theme === "dark") root.dataset.theme = prefs.theme; else delete root.dataset.theme;
    document.body.classList.toggle("compact", prefs.density === "compact");
    document.body.classList.toggle("no-dates", !prefs.showDates);
    if (typeof recompute === "function" && !$("app").hidden) { recompute(); renderAll(); }
    $$("[data-pref]").forEach(c => {
      const v = prefs[c.dataset.pref];
      if (c.classList.contains("switch")) c.checked = Boolean(v);
      else $$("button", c).forEach(b => b.setAttribute("aria-checked", String(b.dataset.v === v)));
    });
  }
  $$("[data-pref]").forEach(c => {
    if (c.classList.contains("switch")) c.addEventListener("change", () => { prefs[c.dataset.pref] = c.checked; savePrefs(); applyPrefs(); });
    else $$("button", c).forEach(b => b.addEventListener("click", () => { prefs[c.dataset.pref] = b.dataset.v; savePrefs(); applyPrefs(); }));
  });

  // ================================================================ giriş
  function setAuthMode(mode) {
    $("tab-login").setAttribute("aria-selected", String(mode === "login"));
    $("tab-register").setAttribute("aria-selected", String(mode === "register"));
    $("form-login").hidden = mode !== "login"; $("form-register").hidden = mode !== "register";
    $$(".auth .form-msg").forEach(m => { m.textContent = ""; });
    const f = mode === "login" ? $("form-login") : $("form-register");
    setTimeout(() => f.username.focus(), 0);
  }
  $$("[data-auth]").forEach(b => b.addEventListener("click", () => setAuthMode(b.dataset.auth)));
  $$(".pw-toggle").forEach(b => b.addEventListener("click", () => {
    const i = b.previousElementSibling, show = i.type === "password";
    i.type = show ? "text" : "password"; b.textContent = show ? "Gizle" : "Göster";
  }));
  async function submitAuth(form, path, body, remember) {
    const msg = form.querySelector(".form-msg"), btn = form.querySelector("button[type=submit]");
    msg.textContent = ""; btn.disabled = true;
    try {
      const data = await api(path, { method: "POST", body });
      session.set("token", data.token, remember); session.set("username", data.username, remember);
      form.reset(); if (form.remember) form.remember.checked = true;
      await enterApp(data);
    } catch (e) { msg.textContent = e.message; }
    finally { btn.disabled = false; }
  }
  $("form-login").addEventListener("submit", (e) => {
    e.preventDefault(); const f = e.target, msg = f.querySelector(".form-msg");
    if (!f.username.value.trim() || !f.password.value) { msg.textContent = "Kullanıcı adını ve şifreni yaz."; return; }
    submitAuth(f, "/api/login", { username: f.username.value.trim(), password: f.password.value }, f.remember.checked);
  });
  $("form-register").addEventListener("submit", (e) => {
    e.preventDefault(); const f = e.target, msg = f.querySelector(".form-msg"), u = f.username.value.trim();
    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(u)) { msg.textContent = "Kullanıcı adı 3-20 karakter olmalı; yalnız harf, rakam, nokta, alt çizgi ve tire."; return; }
    if (f.password.value.length < 6) { msg.textContent = "Şifre en az 6 karakter olmalı."; return; }
    if (f.password.value !== f.password2.value) { msg.textContent = "Şifreler aynı değil."; return; }
    submitAuth(f, "/api/register", { username: u, password: f.password.value }, true);
  });
  function showAuth(message) {
    $("app").hidden = true; $("auth").hidden = false;
    $$("dialog[open]").forEach(d => d.close());
    setAuthMode("login"); hideSplash();
    if (message) $("form-login").querySelector(".form-msg").textContent = message;
  }

  // ---------------------------------------------------------------- ses efektleri (tarayıcıda üretilir)
  let audio = null;
  function sfx(kind) {
    if (!prefs.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const t = audio.currentTime;
      const note = (freq, start, dur, type = "sine", vol = .16) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t + start);
        g.gain.setValueAtTime(0.0001, t + start); g.gain.exponentialRampToValueAtTime(vol, t + start + .012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
        o.connect(g).connect(audio.destination); o.start(t + start); o.stop(t + start + dur + .02);
      };
      if (kind === "mark") { note(660, 0, .12, "triangle", .14); note(990, .06, .16, "sine", .12); }
      else if (kind === "unmark") { note(520, 0, .1, "triangle", .1); note(390, .06, .14, "sine", .08); }
      else if (kind === "undo") { note(440, 0, .08, "sine", .08); }
      else if (kind === "milestone") { [523, 659, 784, 1047].forEach((f, i) => note(f, i * .09, .28, "triangle", .13)); }
      else if (kind === "region") { [784, 988, 1175, 1568].forEach((f, i) => note(f, i * .07, .32, "sine", .12)); note(1568, .3, .5, "triangle", .06); }
      else if (kind === "complete") { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => note(f, i * .1, .4, "triangle", .14)); }
      else if (kind === "tap") { note(880, 0, .05, "sine", .05); }
    } catch (e) {}
  }

  // ---------------------------------------------------------------- konfeti
  function confetti(big) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = el("canvas", { class: "confetti", "aria-hidden": "true" }); document.body.append(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext("2d"); g.scale(dpr, dpr);
    const colors = ["#ffcc33", "#f5b800", "#1d4fd8", "#4ade80", "#f87171", "#ffffff"];
    const parts = Array.from({ length: big ? 220 : 120 }, () => ({
      x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4,
      s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now(), life = big ? 2600 : 1800;
    (function frame(t) {
      const k = (t - t0) / life; g.clearRect(0, 0, W, H);
      for (const p of parts) { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.globalAlpha = Math.max(0, 1 - k); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      if (k < 1) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  // ---------------------------------------------------------------- il bilgileri (nüfus, yüzölçümü, komşular)
  let ILLER = null;
  async function loadIller() {
    if (ILLER) return ILLER;
    try { const r = await fetch("/assets/iller.json"); if (r.ok) ILLER = await r.json(); } catch (e) {}
    return ILLER;
  }

  // ---------------------------------------------------------------- seri: art arda yeni il görülen günler
  function streaks() {
    const days = new Set(Object.values(state).map(v => { const d = parseDate(v); return d ? isoDay(d) : null; }).filter(Boolean));
    if (!days.size) return { current: 0, best: 0 };
    const sorted = [...days].sort();
    let best = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]), cur = new Date(sorted[i]);
      run = (cur - prev) / 86400000 === 1 ? run + 1 : 1; best = Math.max(best, run);
    }
    const day = new Date(); let current = 0;
    if (!days.has(isoDay(day))) day.setDate(day.getDate() - 1);   // bugün henüz yoksa dünden say
    while (days.has(isoDay(day))) { current++; day.setDate(day.getDate() - 1); }
    return { current, best };
  }

  // ================================================================ durum
  // H: yıllara göre geçmiş { yıl: { kod: "gg.aa.yyyy" } }. state: ekranda gösterilen görünüm
  //   - yıllık sezon kapalıysa: her il için en son görüldüğü tarih (tüm zamanlar)
  //   - açıksa: yalnız bu yılın işaretleri
  let H = {}, startYear = new Date().getFullYear(), pending = [];
  let state = {};
  let me = { username: "", isAdmin: false };
  const ui = { status: "all", region: "", sort: "code", q: "", view: "plates" };
  const curYear = () => new Date().getFullYear();
  const dayVal = (v) => { const d = parseDate(v); return d ? d.getTime() : 0; };
  function latestOf(hist) {
    const out = {};
    for (const y of Object.keys(hist)) for (const [c, v] of Object.entries(hist[y])) if (!out[c] || dayVal(v) >= dayVal(out[c])) out[c] = v;
    return out;
  }
  function recompute() { state = prefs.season ? { ...(H[curYear()] || {}) } : latestOf(H); }
  function applyOps(hist, ops) {
    for (const o of ops) {
      if (o.op === "set") { const y = parseDate(o.d).getFullYear(); (hist[y] = hist[y] || {})[o.c] = o.d; }
      else if (o.op === "del") { if (hist[o.y]) { delete hist[o.y][o.c]; if (!Object.keys(hist[o.y]).length) delete hist[o.y]; } }
      else for (const y of Object.keys(hist)) { delete hist[y][o.c]; if (!Object.keys(hist[y]).length) delete hist[y]; }
    }
  }
  const normHist = (hist) => {
    const out = {};
    for (const [y, codes] of Object.entries(hist || {})) for (const [k, v] of Object.entries(codes || {})) {
      const c = parseInt(k, 10); if (c >= 1 && c <= 81 && parseDate(v)) (out[y] = out[y] || {})[c] = String(v);
    }
    return out;
  };

  const cacheKey = () => `plaka-veri:${me.username}`;
  const readCache = () => { try { return JSON.parse(localStorage.getItem(cacheKey()) || "null"); } catch (e) { return null; } };
  const writeCache = () => { try { localStorage.setItem(cacheKey(), JSON.stringify({ v: 2, H, startYear, pending })); } catch (e) {} };

  function hideSplash() { const sp = $("splash"); if (!sp || sp.classList.contains("gone")) return; sp.classList.add("gone"); setTimeout(() => sp.remove(), 450); }
  setTimeout(hideSplash, 5000);   // ne olursa olsun açılış ekranı takılı kalmasın

  function takeServer(data) {
    H = normHist(data.history); if (data.startYear) startYear = data.startYear;
    if (pending.length) applyOps(H, pending);   // henüz gönderilmemiş değişiklikler üstte kalsın
    recompute(); writeCache();
  }

  async function enterApp(info, offline) {
    me = { username: info.username || session.get("username") || "", isAdmin: Boolean(info.isAdmin) };
    $("auth").hidden = true; $("app").hidden = false;
    $("acc-name").textContent = me.username;
    $("acc-role").textContent = me.isAdmin ? "Yönetici hesabı" : "Kullanıcı hesabı";
    $("group-admin").hidden = !me.isAdmin;
    $("btn-delete").closest(".row").hidden = me.isAdmin;   // yönetici hesabı buradan silinmez
    const cached = readCache();
    H = {}; pending = []; startYear = curYear();
    if (cached && cached.v === 2) { H = normHist(cached.H); pending = Array.isArray(cached.pending) ? cached.pending : []; startYear = cached.startYear || startYear; }
    recompute();
    routeFromHash(); renderAll(); hideSplash(); updateInstallUI();
    if (offline) { setSave("Çevrimdışı · değişiklikler saklanıyor", "err"); return; }
    try {
      if (pending.length) { await save(); if (!pending.length) toast("Çevrimdışı yaptığın değişiklikler kaydedildi"); renderAll(); return; }
      takeServer(await api("/api/plates")); renderAll();
    } catch (e) { toast(e.message); }
  }

  // ================================================================ kaydetme (akıllı eşitleme)
  // Yalnız değişiklikler gönderilir; sunucu il il ve sırayla uygular, sonra birleşik geçmişi döndürür.
  let saveTimer = null, saving = false, okTimer = null;
  const isDirty = () => pending.length > 0;
  function setSave(text, cls) { const s = $("save"); s.textContent = text; s.className = "save" + (cls ? " " + cls : ""); }
  let epoch = 0;   // her yerel değişiklik ve kayıtta artar; eski "pull" cevapları atılır
  function queue(ops) {
    const bad = ops.filter(o => o.op === "set" && !okDate(o.d)).length;
    if (bad) { ops = ops.filter(o => o.op !== "set" || okDate(o.d)); toast(`${bad} işaret geçersiz tarih yüzünden atlandı`); }
    if (!ops.length) return;
    epoch++;
    applyOps(H, ops); pending.push(...ops); recompute(); writeCache();
    setSave(navigator.onLine ? "Kaydediliyor…" : "Çevrimdışı · değişiklikler saklanıyor", navigator.onLine ? "" : "err");
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 400);
  }
  let inflight = null;
  // Bekleyen değişiklikleri gönderir; true = hepsi kaydedildi
  function save() {
    if (inflight) return inflight.then(() => (pending.length ? save() : true));
    if (!pending.length) return Promise.resolve(true);
    clearTimeout(saveTimer);
    inflight = (async () => {
      saving = true;
      const batch = pending.slice(0, 500);
      try {
        const data = await api("/api/plates/ops", { method: "POST", body: { ops: batch } });
        pending = pending.slice(batch.length); epoch++;
        takeServer(data); renderAll();
        return true;
      } catch (e) {
        if (e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429) {
          // Sunucu bu değişiklikleri hiçbir zaman kabul etmeyecek: kuyruğu kilitlemesin
          pending = pending.slice(batch.length); writeCache();
          try { takeServer(await api("/api/plates")); renderAll(); } catch (e2) {}
          toast("Bazı değişiklikler kaydedilemedi: " + e.message);
          return true;
        }
        setSave(navigator.onLine ? "Kaydedilemedi · tekrar denenecek" : "Bağlantı yok · tekrar denenecek", "err");
        saveTimer = setTimeout(save, 5000);
        return false;
      } finally { saving = false; }
    })();
    return inflight.then(async (ok) => {
      inflight = null;
      if (ok && pending.length) return save();
      if (ok) { setSave("Kaydedildi", "ok"); clearTimeout(okTimer); okTimer = setTimeout(() => { if (!isDirty()) setSave(""); }, 2000); }
      return ok && !pending.length;
    });
  }
  window.addEventListener("online", () => { if (isDirty()) save(); });
  window.addEventListener("beforeunload", (e) => { if (isDirty() || saving) { e.preventDefault(); e.returnValue = ""; } });
  // Başka bir cihazdaki değişiklikleri görmek için: sekmeye geri dönülünce sunucudan tazele
  let lastPull = 0;
  async function pull(force) {
    if ($("app").hidden || isDirty() || saving || !navigator.onLine) return;
    if (!force && Date.now() - lastPull < 5000) return;
    lastPull = Date.now();
    const e0 = epoch;
    try { const data = await api("/api/plates"); if (e0 === epoch && !isDirty() && !saving) { takeServer(data); renderAll(); } } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
  window.addEventListener("focus", () => pull());
  setInterval(() => { if (document.visibilityState === "visible") pull(); }, 60000);   // açık dururken dakikada bir

  // Ekrandaki bir değişikliği (il, yeni tarih ya da kaldırma) sunucu işlemlerine çevirir
  function opsFor(c, date, prev) {
    if (prefs.season) {
      if (date) return [{ op: "set", c, d: date }];
      return [{ op: "del", c, y: curYear() }];
    }
    if (!date) return [{ op: "delAll", c }];
    const ops = [];
    if (prev && parseDate(prev).getFullYear() !== parseDate(date).getFullYear()) ops.push({ op: "del", c, y: parseDate(prev).getFullYear() });
    ops.push({ op: "set", c, d: date });
    return ops;
  }

  function celebrate(c) {
    if (Object.keys(state).length === 81) return "Tebrikler! 81 ilin hepsini gördün! 🎉";
    const r = REGION_OF[c];
    if (REGIONS[r].every(x => state[x])) return `🎉 ${r} bölgesinin tamamını gördün!`;
    return "";
  }
  function milestone(before, after) {
    for (const p of [25, 50, 75]) { const need = Math.ceil(81 * p / 100); if (before < need && after >= need) return true; }
    return false;
  }
  // Bir ilin bütün yıllardaki kayıtları → geri almak için işlem listesi
  const snapshotOps = (codes) => codes.flatMap(c => [{ op: "delAll", c }, ...Object.keys(H).filter(y => H[y][c]).map(y => ({ op: "set", c, d: H[y][c] }))]);
  function restore(ops) { queue(ops); renderAll(); sfx("undo"); if (prefs.haptics && navigator.vibrate) navigator.vibrate([8, 40, 8]); }
  function setMark(c, date, opts = {}) {
    const prev = state[c], before = Object.keys(state).length;
    if (prev === date || (!prev && !date)) return;
    const snap = snapshotOps([c]);
    queue(opsFor(c, date, prev)); renderAll(c);
    if (prefs.haptics && navigator.vibrate) navigator.vibrate(date ? 14 : [8, 40, 8]);
    if (opts.silent) { sfx("undo"); return; }
    const undo = { label: "Geri al", run: () => restore(snap) };
    const after = Object.keys(state).length;
    const party = date && !prev ? celebrate(c) : "";
    if (party) { toast(party, undo); confetti(after === 81); sfx(after === 81 ? "complete" : "region"); }
    else if (date && !prev && milestone(before, after)) { toast(`Tebrikler! 81 ilin ${acc(after)} gördün (%${Math.round(100 * after / 81)})`, undo); confetti(false); sfx("milestone"); }
    else if (opts.quick && date) { toast(`${label(c)} işaretlendi`, { label: "Tarihi değiştir", run: () => openPlate(c) }); sfx("mark"); }
    else { toast(date ? (prev ? `${label(c)} · tarih güncellendi` : `${label(c)} işaretlendi`) : `${label(c)} işareti kaldırıldı`, undo); sfx(date ? "mark" : "unmark"); }
  }

  // ================================================================ gezinme
  function go(view, push = true) {
    if (!(view in VIEWS)) view = "plates";
    ui.view = view;
    $$(".view").forEach(v => { v.hidden = v.dataset.view !== view; });
    $$(".top-nav [data-go], .bottom-nav [data-go]").forEach(b => { if (b.dataset.go === view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    if (push && location.hash !== VIEWS[view]) history.pushState(null, "", VIEWS[view] || location.pathname);
    if (view === "map") renderMap();
    if (view === "stats") renderStats();
    if (view === "history") renderHistory();
    window.scrollTo(0, 0);
  }
  function routeFromHash() { const v = Object.keys(VIEWS).find(k => VIEWS[k] && VIEWS[k] === location.hash) || "plates"; go(v, false); }
  $$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  window.addEventListener("popstate", routeFromHash);

  // ================================================================ çizim
  function renderAll(changed) {
    renderProgress(changed != null); renderQuick(); renderFilters(); renderGrid(changed);
    if (ui.view === "map") renderMap();
    if (ui.view === "stats") renderStats();
    if (ui.view === "history") renderHistory();
  }
  const seenList = () => Object.entries(state).map(([k, v]) => ({ c: +k, v, d: parseDate(v) }));

  function renderProgress(animate) {
    const n = Object.keys(state).length, pct = Math.round(100 * n / 81);
    $("pc-num").textContent = n; $("pc-pct").textContent = `%${pct}`;
    const fill = $("pbar-fill"), w = (100 * n / 81) + "%";
    if (animate) fill.style.width = w;
    else { fill.style.transition = "none"; fill.style.width = w; fill.getBoundingClientRect(); fill.style.transition = ""; }
    $("pbar").setAttribute("aria-valuenow", n); $("pbar").setAttribute("aria-label", `81 ilin ${n} tanesi görüldü`);
    const sub = $("pc-sub"); sub.textContent = "";
    if (prefs.season) sub.append(el("span", { class: "season-tag", text: `${curYear()} sezonu` }));
    const list = seenList().filter(x => x.d).sort((a, b) => b.d - a.d);
    const now = new Date(), month = list.filter(x => x.d.getMonth() === now.getMonth() && x.d.getFullYear() === now.getFullYear()).length;
    if (!n) sub.append("Henüz plaka işaretlemedin. Gördüğün ilk plakaya dokun!");
    else if (n === 81) sub.append("Tebrikler, 81 ilin hepsini gördün! 🎉");
    else {
      if (list[0]) sub.append("Son: ", el("b", { text: label(list[0].c) }), ` · ${pretty(list[0].v)}`);
      if (month) sub.append(` · Bu ay ${month} yeni`);
      sub.append(` · ${81 - n} il kaldı`);
    }
    $("hint").hidden = prefs.hintSeen;
  }
  $("hint-x").addEventListener("click", () => { prefs.hintSeen = true; savePrefs(); $("hint").hidden = true; });

  function renderQuick() {
    const box = $("quick"); box.textContent = "";
    const today = todayStr(), n = Object.values(state).filter(v => v === today).length;
    box.append(el("button", { type: "button", "aria-pressed": String(ui.status === "today"), disabled: !n && ui.status !== "today" ? true : null,
      onclick: () => { ui.status = ui.status === "today" ? "all" : "today"; renderAll(); } }, "Bugün görülenler ", el("b", { text: String(n) })));
    const st = streaks();
    if (st.current > 0) box.append(el("span", { class: "streak", title: `En uzun seri: ${st.best} gün` }, "🔥 ", el("b", { text: `${st.current} günlük seri` })));
  }
  function renderFilters() {
    const box = $("active-filters"); box.textContent = "";
    const chip = (text, clear) => el("span", { class: "af" }, text, el("button", { type: "button", "aria-label": `${text} filtresini kaldır`, text: "×", onclick: () => { clear(); renderAll(); } }));
    if (ui.status !== "all") box.append(chip({ seen: "Görülenler", left: "Eksikler", today: "Bugün görülenler" }[ui.status], () => { ui.status = "all"; }));
    if (ui.region) box.append(chip(ui.region, () => { ui.region = ""; }));
    if (ui.sort !== "code") box.append(chip(ui.sort === "name" ? "İl adına göre" : "Son görülene göre", () => { ui.sort = "code"; }));
    box.hidden = !box.children.length;
    $("filter-dot").hidden = !box.children.length;
    $$("[data-ui]").forEach(g => $$("button", g).forEach(b => b.setAttribute("aria-checked", String(ui[g.dataset.ui] === b.dataset.v))));
    const rl = $("flt-regions"); rl.textContent = "";
    const opt = (name, key, codes) => el("button", { type: "button", role: "radio", "aria-checked": String(ui.region === key), onclick: () => { ui.region = key; renderAll(); } },
      el("span", { text: name }), el("small", { text: `${codes.filter(c => state[c]).length}/${codes.length}` }));
    rl.append(opt("Tüm bölgeler", "", Array.from({ length: 81 }, (_, i) => i + 1)));
    for (const [r, codes] of Object.entries(REGIONS)) rl.append(opt(r, r, codes));
  }
  $$("[data-ui]").forEach(g => $$("button", g).forEach(b => b.addEventListener("click", () => { ui[g.dataset.ui] = b.dataset.v; renderAll(); })));
  $("btn-filter").addEventListener("click", () => $("dlg-filter").showModal());
  const clearFilters = () => { ui.status = "all"; ui.region = ""; ui.sort = "code"; ui.q = ""; $("q").value = ""; renderAll(); };
  $("flt-reset").addEventListener("click", clearFilters);
  $("btn-clear-filters").addEventListener("click", clearFilters);
  $("q").addEventListener("input", (e) => { ui.q = e.target.value; renderGrid(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !$("app").hidden && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.querySelector("dialog[open]")) {
      e.preventDefault(); go("plates"); $("q").focus();
    }
  });

  function visibleCodes() {
    const q = norm(ui.q.trim());
    const codes = [];
    for (let c = 1; c <= 81; c++) {
      if (ui.region && REGION_OF[c] !== ui.region) continue;
      if (ui.status === "seen" && !state[c]) continue;
      if (ui.status === "left" && state[c]) continue;
      if (ui.status === "today" && state[c] !== todayStr()) continue;
      if (q && !(norm(city(c)).includes(q) || pad(c).startsWith(q) || String(c) === q)) continue;
      codes.push(c);
    }
    if (ui.sort === "name") codes.sort((a, b) => city(a).localeCompare(city(b), "tr"));
    if (ui.sort === "recent") codes.sort((a, b) => ((parseDate(state[b]) || 0) - (parseDate(state[a]) || 0)) || a - b);
    return codes;
  }

  const TICK = "m5 12 5 5 9-10";
  function renderGrid(changed) {
    const g = $("grid"); g.textContent = "";
    const codes = visibleCodes();
    for (const c of codes) {
      const on = Boolean(state[c]);
      const t = el("button", {
        class: "tile" + (on ? " on" : "") + (changed === c ? " just" : ""), type: "button", "data-c": c,
        "aria-pressed": String(on), "aria-label": `${label(c)}, ${on ? "görüldü " + pretty(state[c]) : "henüz görülmedi"}`,
      }, el("span", { class: "code", "aria-hidden": "true", text: pad(c) }), el("span", { class: "name", text: city(c) }), el("span", { class: "meta", text: on ? pretty(state[c]) : "Henüz görülmedi" }));
      const tick = el("span", { class: "tick", "aria-hidden": "true" }); tick.append(svgIcon(TICK)); t.append(tick);
      g.append(t);
    }
    $("empty").hidden = codes.length > 0;
  }

  // Plakaya dokun: işaretle / kaldır. Basılı tut ya da sağ tık: ayrıntı (tarih).
  let pressTimer = null, longFired = false, startXY = null;
  const grid = $("grid");
  grid.addEventListener("pointerdown", (e) => {
    longFired = false;
    const t = e.target.closest(".tile"); if (!t || e.button > 0) return;
    startXY = [e.clientX, e.clientY];
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { longFired = true; openPlate(+t.dataset.c); }, 480);
  });
  const cancelPress = () => clearTimeout(pressTimer);
  grid.addEventListener("pointermove", (e) => { if (startXY && Math.hypot(e.clientX - startXY[0], e.clientY - startXY[1]) > 10) cancelPress(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => grid.addEventListener(ev, cancelPress));
  grid.addEventListener("contextmenu", (e) => {
    const t = e.target.closest(".tile"); if (!t) return;
    e.preventDefault(); cancelPress();
    if (!longFired) openPlate(+t.dataset.c);   // basılı tutma zaten açtıysa ikinci kez açma
  });
  grid.addEventListener("click", (e) => {
    const t = e.target.closest(".tile"); if (!t) return;
    if (longFired) { longFired = false; return; }
    const c = +t.dataset.c;
    if (prefs.tapAction === "ask") { openPlate(c); return; }
    if (state[c]) setMark(c, null); else setMark(c, todayStr(), { quick: true });
  });
  grid.addEventListener("keydown", (e) => {
    const t = e.target.closest(".tile"); if (!t) return;
    if ((e.key === "Enter" && e.shiftKey) || e.key === "i" || e.key === "ContextMenu") { e.preventDefault(); openPlate(+t.dataset.c); }
  });

  // ================================================================ il penceresi
  let plateCode = null;
  function openPlate(c) {
    plateCode = c;
    const on = Boolean(state[c]);
    $("pl-code").textContent = pad(c);
    $("pl-code").classList.toggle("off", !on);
    $("pl-name").textContent = city(c);
    $("pl-sub").textContent = `${REGION_OF[c]} Bölgesi · ${on ? "Görüldü" : "Henüz görülmedi"}`;
    $("pl-date-label").textContent = on ? "Görüldüğü tarih" : "Ne zaman gördün?";
    $("pl-date").value = toInput(on ? state[c] : todayStr());
    $("pl-date").max = toInput(todayStr());
    if (prefs.season) $("pl-date").min = `${curYear()}-01-01`; else $("pl-date").removeAttribute("min");
    $("pl-save").textContent = on ? "Tarihi kaydet" : "Gördüm";
    $("pl-remove").hidden = !on;
    $("pl-facts").textContent = ""; $("pl-neighbors").textContent = ""; $("pl-src").textContent = "";
    const d = $("dlg-plate"); if (!d.open) d.showModal();
    setTimeout(() => $("pl-save").focus(), 0);
    loadIller().then(data => {
      if (plateCode !== c || !data || !data.iller[c]) return;
      const i = data.iller[c];
      const fact = (k, v) => el("div", { class: "fact" }, el("span", { text: k }), el("b", { text: v }));
      $("pl-facts").append(fact("Nüfus", i.nufus.toLocaleString("tr-TR")), fact("Yüzölçümü", `${i.alan.toLocaleString("tr-TR")} km²`), fact("Alan kodu", i.alanKodu || "—"));
      if (i.merkez && i.merkez !== city(c)) $("pl-sub").textContent += ` · Merkez: ${i.merkez}`;
      if (i.komsu && i.komsu.length) {
        $("pl-neighbors").append(el("h3", { text: `Komşu iller · ${i.komsu.filter(k => state[k]).length}/${i.komsu.length} görüldü` }),
          el("div", null, i.komsu.map(k => el("button", { type: "button", class: state[k] ? "seen" : "", title: state[k] ? "Görüldü" : "Henüz görülmedi", onclick: () => openPlate(k) }, el("i"), label(k)))));
      }
      $("pl-src").textContent = "Nüfus: TÜİK 2021 tahmini · Yüzölçümü: Wikipedia";
    });
  }
  $("pl-save").addEventListener("click", () => {
    let d = fromInput($("pl-date").value);
    if (parseDate(d) > new Date()) d = todayStr();                                  // gelecek tarih olmasın
    if (prefs.season && parseDate(d).getFullYear() !== curYear()) { toast(`Yıllık sezonda yalnız ${curYear()} tarihleri seçilebilir`); return; }
    setMark(plateCode, d); $("dlg-plate").close();
  });
  $("pl-remove").addEventListener("click", () => { setMark(plateCode, null); $("dlg-plate").close(); });

  // ================================================================ harita
  let mapReady = false, mapLoading = false;
  async function renderMap() {
    const box = $("map");
    if (!mapReady) {
      if (mapLoading) return;
      mapLoading = true;
      try {
        const res = await fetch("/assets/turkiye.svg"); if (!res.ok) throw new Error();
        const doc = new DOMParser().parseFromString(await res.text(), "image/svg+xml");
        const svg = doc.querySelector("svg"); if (!svg) throw new Error();
        svg.querySelectorAll("script, foreignObject").forEach(n => n.remove());   // yalnız şekiller
        box.textContent = ""; box.append(document.importNode(svg, true)); box.removeAttribute("aria-busy");
        $$("path[data-kod]", box).forEach(p => {
          const c = +p.dataset.kod;
          p.setAttribute("tabindex", "0"); p.setAttribute("role", "button");
          p.addEventListener("click", () => openPlate(c));
          p.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPlate(c); } });
          p.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") showTip(e, c); });
          p.addEventListener("pointerleave", () => { $("map-tip").hidden = true; });
        });
        mapReady = true;
      } catch (e) {
        box.textContent = ""; box.append(el("p", { class: "muted", text: "Harita yüklenemedi. Sayfayı yenilemeyi dene." }));
        mapLoading = false; return;
      }
    }
    $$("path[data-kod]", box).forEach(p => {
      const c = +p.dataset.kod, on = Boolean(state[c]);
      p.classList.toggle("on", on); p.setAttribute("aria-label", `${label(c)}${on ? ", görüldü" : ""}`);
    });
    // ilk çizimde, renkler uygulandıktan sonra haritanın etrafındaki boşluğu kırp
    const inner = box.querySelector("svg");
    if (inner && !inner.dataset.cropped) {
      try { const bb = inner.getBBox(); if (bb.width) { inner.setAttribute("viewBox", `${bb.x - 4} ${bb.y - 4} ${bb.width + 8} ${bb.height + 8}`); inner.dataset.cropped = "1"; } } catch (e) {}
    }
    $("map-n").textContent = `${Object.keys(state).length} / 81 il görüldü`;
    renderRegionPanel();
  }
  const pinned = new Set();
  function highlightRegion(hover) {
    const active = new Set(pinned); if (hover) active.add(hover);
    $$("#map path[data-kod]").forEach(p => p.classList.toggle("dim", active.size > 0 && !active.has(REGION_OF[+p.dataset.kod])));
    $("rp-clear").hidden = pinned.size === 0;
  }
  $("rp-clear").addEventListener("click", () => { pinned.clear(); renderRegionPanel(); });
  function renderRegionPanel() {
    const ul = $("map-regions"); ul.textContent = "";
    for (const [r, codes] of Object.entries(REGIONS)) {
      const k = codes.filter(c => state[c]).length, fill = el("i"); fill.style.width = (100 * k / codes.length) + "%";
      const b = el("button", { type: "button", "aria-pressed": String(pinned.has(r)),
        onmouseenter: () => highlightRegion(r), onmouseleave: () => highlightRegion(), onfocus: () => highlightRegion(r), onblur: () => highlightRegion(),
        onclick: () => { if (pinned.has(r)) pinned.delete(r); else pinned.add(r); sfx("tap"); renderRegionPanel(); } },
        el("span", { text: r }), el("small", { text: `${k}/${codes.length}` }), el("span", { class: "bar", "aria-hidden": "true" }, fill));
      ul.append(el("li", null, b));
    }
    highlightRegion();
  }
  function showTip(e, c) {
    const tip = $("map-tip"), card = tip.parentElement.getBoundingClientRect();
    tip.textContent = `${label(c)}${state[c] ? " · " + pretty(state[c]) : ""}`;
    tip.style.left = (e.clientX - card.left) + "px"; tip.style.top = (e.clientY - card.top) + "px"; tip.hidden = false;
  }

  // ================================================================ istatistik
  function renderStats() {
    const list = seenList(), dated = list.filter(x => x.d).sort((a, b) => a.d - b.d), now = new Date();
    const n = list.length;
    const kpis = $("kpis"); kpis.textContent = "";
    const kpi = (k, v, s) => el("div", { class: "kpi" }, el("span", { text: k }), el("b", { text: v }), s ? el("small", { text: s }) : null);
    const byMonth = {};
    dated.forEach(x => { const key = `${x.d.getFullYear()}-${x.d.getMonth()}`; byMonth[key] = (byMonth[key] || 0) + 1; });
    const best = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];
    $("sh-count").textContent = `${n} / 81`; $("sh-pct").textContent = `%${Math.round(100 * n / 81)}`;
    const shf = $("sh-bar-fill"); shf.style.transition = "none"; shf.style.width = (100 * n / 81) + "%"; shf.getBoundingClientRect(); shf.style.transition = ""; $("sh-bar").setAttribute("aria-valuenow", n);
    const st = streaks();
    kpis.append(
      kpi("Seri", `${st.current} gün`, `En uzun: ${st.best} gün`),
      kpi("Bu yıl", String(dated.filter(x => x.d.getFullYear() === now.getFullYear()).length), "yeni il"),
      kpi("İlk plaka", dated[0] ? pad(dated[0].c) : "—", dated[0] ? `${city(dated[0].c)} · ${pretty(dated[0].v)}` : "henüz yok"),
      kpi("En iyi ay", best ? `${best[1]} il` : "—", best ? `${MONTH[+best[0].split("-")[1]]} ${best[0].split("-")[0]}` : "henüz yok")
    );
    const bars = $("region-bars"); bars.textContent = "";
    for (const [r, codes] of Object.entries(REGIONS)) {
      const k = codes.filter(c => state[c]).length, fill = el("i"); fill.style.width = (100 * k / codes.length) + "%";
      bars.append(el("div", { class: "bar-row" + (k === codes.length ? " done" : "") },
        el("span", { text: r }), el("span", { class: "bar", role: "img", "aria-label": `${r}: ${k}/${codes.length}` }, fill),
        el("span", { class: "n", text: k === codes.length ? "Tamam ✓" : `${k}/${codes.length} · %${Math.round(100 * k / codes.length)}` })));
    }
    const months = $("months"); months.textContent = "";
    const cols = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); cols.push({ l: MON[d.getMonth()], n: byMonth[`${d.getFullYear()}-${d.getMonth()}`] || 0, full: `${MONTH[d.getMonth()]} ${d.getFullYear()}` }); }
    const max = Math.max(1, ...cols.map(c => c.n));
    cols.forEach(c => {
      const b = el("div", { class: "mb" + (c.n ? "" : " zero"), title: `${c.full}: ${c.n}` }, c.n ? el("span", { text: c.n }) : null);
      b.style.height = (c.n ? Math.max(6, 100 * c.n / max) : 3) + "%";
      months.append(el("div", { class: "mcol" }, b, el("small", { text: c.l })));
    });
    const rec = $("recent"); rec.textContent = "";
    const recent = dated.slice().reverse().slice(0, 8);
    if (!recent.length) rec.append(el("li", { class: "muted", text: "Henüz işaretli plaka yok." }));
    recent.forEach(x => rec.append(el("li", null, el("span", { class: "rc", text: pad(x.c) }), el("b", { text: city(x.c) }), el("span", { class: "when", text: pretty(x.v) }))));
    const miss = $("missing"); miss.textContent = "";
    let any = false;
    for (const [r, codes] of Object.entries(REGIONS)) {
      const left = codes.filter(c => !state[c]); if (!left.length) continue; any = true;
      miss.append(el("div", null, el("h3", { text: `${r} · ${left.length}` }),
        el("div", { class: "tags" }, left.map(c => el("button", { type: "button", text: label(c), onclick: () => openPlate(c) })))));
    }
    if (!any) miss.append(el("p", { class: "done-msg", text: "Eksik il yok, hepsini gördün! 🎉" }));
  }

  // ================================================================ ayarlar: eylemler
  const actions = {
    password() { const f = $("form-pw"); f.reset(); const m = f.querySelector(".form-msg"); m.textContent = ""; m.classList.remove("ok"); $("dlg-password").showModal(); setTimeout(() => f.current.focus(), 0); },
    async logout() {
      if (isDirty() || saving) {
        const ok = await save();
        if (!ok && !(await confirmDlg({ title: "Kaydedilmemiş değişiklikler var", text: `${pending.length} değişiklik henüz sunucuya gönderilemedi. Çıkış yaparsan bunlar kaybolur.`, yes: "Yine de çık" }))) return;
      }
      clearTimeout(saveTimer);
      try { localStorage.removeItem(cacheKey()); } catch (e) {}
      session.clear(); state = {}; H = {}; pending = []; me = { username: "", isAdmin: false }; setSave(""); showAuth();
    },
    export() {
      const data = { uygulama: "plaka", surum: 3, kullanici: me.username, tarih: new Date().toISOString(), plakalar: latestOf(H), yillar: H };
      const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })), download: `plaka-yedek-${toInput(todayStr())}.json` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      toast("Yedek dosyası indirildi");
    },
    import() { $("import-file").click(); },
    async reset() {
      const n = Object.keys(state).length;
      if (!n) { toast("Sıfırlanacak işaret yok"); return; }
      if (!(await confirmDlg({ title: "Tüm işaretler silinsin mi?", text: `${n} ilin işareti kaldırılacak. Hesabın silinmez. Birkaç saniye içinde geri alabilirsin.`, yes: "Sıfırla" }))) return;
      const prev = { ...state }, snap = snapshotOps(Object.keys(prev).map(Number));
      queue(Object.keys(prev).map(k => prefs.season ? { op: "del", c: +k, y: curYear() } : { op: "delAll", c: +k })); renderAll();
      toast(prefs.season ? "Bu yılın işaretleri kaldırıldı" : "Tüm işaretler kaldırıldı", { label: "Geri al", run: () => restore(snap) });
    },
    delete() { const f = $("form-delete"); f.reset(); f.querySelector(".form-msg").textContent = ""; $("dlg-delete").showModal(); setTimeout(() => f.password.focus(), 0); },
    admin: () => openAdmin(),
    share: () => openShare(),
    install: () => doInstall(),
  };
  $$("[data-act]").forEach(b => b.addEventListener("click", () => actions[b.dataset.act]()));

  $("import-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      if (f.size > 100000) throw new Error("Dosya çok büyük.");
      const j = JSON.parse(await f.text());
      const src = j && typeof j === "object" ? (j.plakalar || j.plates_data || j) : null;
      const next = {};
      for (const [k, v] of Object.entries(src || {})) { const n = parseInt(k, 10); if (n >= 1 && n <= 81 && okDate(v)) next[n] = v; }
      const extra = [];   // yeni yedeklerde yıllara göre geçmiş de var
      if (j && j.yillar && typeof j.yillar === "object") for (const codes of Object.values(j.yillar)) for (const [k, v] of Object.entries(codes || {})) { const n = parseInt(k, 10); if (n >= 1 && n <= 81 && okDate(v) && next[n] !== v) extra.push({ op: "set", c: n, d: v }); }
      const count = Object.keys(next).length;
      if (!count) throw new Error("Dosyada geçerli işaret bulunamadı.");
      if (!(await confirmDlg({ title: "Yedek yüklensin mi?", text: `Dosyada ${count} il var. Bunlar mevcut işaretlerine eklenecek; aynı ilde dosyadaki tarih kullanılır.`, yes: "Ekle", danger: false }))) return;
      queue([...extra, ...Object.entries(next).map(([k, v]) => ({ op: "set", c: +k, d: v }))]); renderAll();
      toast(`${count} il yedekten eklendi`);
    } catch (err) { toast("Yüklenemedi: " + (err.message || "geçersiz dosya")); }
  });

  $("form-pw").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target, msg = f.querySelector(".form-msg"), btn = f.querySelector("button[type=submit]");
    msg.classList.remove("ok");
    if (!f.current.value) { msg.textContent = "Mevcut şifreni yaz."; return; }
    if (f.next.value.length < 6) { msg.textContent = "Yeni şifre en az 6 karakter olmalı."; return; }
    if (f.next.value !== f.next2.value) { msg.textContent = "Yeni şifreler aynı değil."; return; }
    btn.disabled = true;
    try {
      const d = await api("/api/settings", { method: "POST", body: { currentPassword: f.current.value, newPassword: f.next.value } });
      f.reset(); msg.classList.add("ok"); msg.textContent = d.message;
      setTimeout(() => $("dlg-password").close(), 1200);
    } catch (err) { msg.textContent = err.message; } finally { btn.disabled = false; }
  });
  $("form-delete").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target, msg = f.querySelector(".form-msg"), btn = f.querySelector("button[type=submit]");
    if (!f.password.value) { msg.textContent = "Şifreni yaz."; return; }
    btn.disabled = true;
    try {
      await api("/api/me", { method: "DELETE", body: { password: f.password.value } });
      $("dlg-delete").close(); pending = []; clearTimeout(saveTimer); try { localStorage.removeItem(cacheKey()); } catch (e) {} session.clear(); state = {}; setSave("");
      showAuth(); toast("Hesabın ve tüm verilerin silindi");
    } catch (err) { msg.textContent = err.message; } finally { btn.disabled = false; }
  });

  // ================================================================ geçmiş yıllar
  let mapTextCache = null;
  async function mapText() { if (!mapTextCache) { const r = await fetch("/assets/turkiye.svg"); if (!r.ok) throw new Error(); mapTextCache = await r.text(); } return mapTextCache; }
  async function renderHistory() {
    const box = $("years"); box.textContent = "";
    const now = curYear(), years = Object.keys(H).map(Number).filter(y => y >= 2000), first = Math.min(startYear || now, now, ...years);
    $("hist-sub").textContent = first === now ? `Kullanmaya ${now} yılında başladın. Yıllar geçtikçe sonuçların burada birikecek.` : `${first}'den bu yana her yıl hangi illeri gördüğün.`;
    let txt = null; try { txt = await mapText(); } catch (e) {}
    for (let y = now; y >= first; y--) {
      const data = H[y] || {}, codes = Object.keys(data).map(Number), n = codes.length;
      const fill = el("i"); fill.style.width = (100 * n / 81) + "%";
      const dates = codes.map(c => parseDate(data[c])).filter(Boolean).sort((a, b) => a - b);
      const best = Object.entries(REGIONS).map(([r, cs]) => [r, cs.filter(c => data[c]).length / cs.length]).sort((a, b) => b[1] - a[1])[0];
      const left = el("div", null,
        el("h2", null, String(y), y === now ? el("span", { class: "badge", text: "Devam ediyor" }) : null, n === 81 ? el("span", { class: "badge done", text: "Tamamlandı 🎉" }) : null),
        el("p", { class: "yc-num" }, el("b", { text: String(n) }), ` / 81 il · %${Math.round(100 * n / 81)}`),
        el("div", { class: "pbar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "81", "aria-valuenow": String(n) }, fill),
        n ? el("div", { class: "yc-meta" },
              el("span", { text: `İlk: ${label(codes.find(c => parseDate(data[c]) && parseDate(data[c]).getTime() === dates[0].getTime()) || codes[0])} · ${pretty(data[codes.find(c => parseDate(data[c]) && parseDate(data[c]).getTime() === dates[0].getTime()) || codes[0]])}` }),
              el("span", { text: `En iyi bölge: ${best[0]} (%${Math.round(best[1] * 100)})` }))
          : el("p", { class: "empty-year", text: y === now ? "Bu yıl henüz işaret yok." : "Bu yıl işaret yok." }));
      const mapBox = el("div", { class: "mini-map", "aria-hidden": "true" });
      if (txt) {
        const svg = new DOMParser().parseFromString(txt, "image/svg+xml").querySelector("svg");
        svg.querySelectorAll("path[data-kod]").forEach(p => { if (data[+p.dataset.kod]) p.setAttribute("class", "on"); });
        mapBox.append(document.importNode(svg, true));
      }
      box.append(el("article", { class: "year-card", "aria-label": `${y}: ${n} il` }, left, mapBox));
    }
  }

  // ================================================================ paylaşılabilir kart
  let shareBlob = null;
  async function makeCard() {
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    try { await Promise.all(["800 120px Inter", "700 40px Inter", "500 30px Inter"].map(f => document.fonts.load(f))); } catch (e) {}
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#14181f"); bg.addColorStop(1, "#0b0d11"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const n = Object.keys(state).length, pct = Math.round(100 * n / 81);
    g.fillStyle = "#9ba1ac"; g.font = "600 34px Inter, sans-serif"; g.fillText("plaka", 80, 130);
    g.fillStyle = "#ffffff"; g.font = "800 190px Inter, sans-serif"; g.fillText(String(n), 72, 330);
    const nw = g.measureText(String(n)).width;
    g.fillStyle = "#9ba1ac"; g.font = "700 64px Inter, sans-serif"; g.fillText("/ 81 il", 92 + nw, 330);
    g.fillStyle = "#ffcc33"; g.font = "800 64px Inter, sans-serif"; g.textAlign = "right"; g.fillText(`%${pct}`, W - 80, 330); g.textAlign = "left";
    g.fillStyle = "#262b35"; g.beginPath(); g.roundRect(80, 380, W - 160, 22, 11); g.fill();
    g.fillStyle = "#ffcc33"; g.beginPath(); g.roundRect(80, 380, Math.max(22, (W - 160) * n / 81), 22, 11); g.fill();
    // yerleşim alttan yukarı: alt bilgi, bölgeler, kalan alana harita
    const footY = H - 56, rowH = 66, regTop = footY - 48 - 4 * rowH + 28, mapTop = 450, mapMaxH = regTop - 60 - mapTop;
    try {
      const txt = await (await fetch("/assets/turkiye.svg")).text();
      const doc = new DOMParser().parseFromString(txt, "image/svg+xml"), svg = doc.querySelector("svg");
      const [vx, vy, vw, vh] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
      const scale = Math.min((W - 120) / vw, mapMaxH / vh), mw = vw * scale, mh = vh * scale, ox = (W - mw) / 2, oy = mapTop + (mapMaxH - mh) / 2;
      g.save(); g.translate(ox, oy); g.scale(scale, scale); g.translate(-vx, -vy);
      g.lineWidth = 1.3 / scale; g.strokeStyle = "#9aa1ad"; g.lineJoin = "round";
      svg.querySelectorAll("path[data-kod]").forEach(p => { const path = new Path2D(p.getAttribute("d")); g.fillStyle = state[+p.dataset.kod] ? "#ffcc33" : "#1d2128"; g.fill(path); g.stroke(path); });
      g.restore();
    } catch (e) {}
    // bölgeler
    const y = regTop; const colW = (W - 160) / 2;
    Object.entries(REGIONS).forEach(([r, codes], i) => {
      const k = codes.filter(c => state[c]).length, x = 80 + (i % 2) * (colW + 0), yy = y + Math.floor(i / 2) * rowH;
      g.fillStyle = "#eceef2"; g.font = "600 28px Inter, sans-serif"; g.fillText(r, x, yy);
      g.fillStyle = "#9ba1ac"; g.font = "500 26px Inter, sans-serif"; g.textAlign = "right"; g.fillText(`${k}/${codes.length}`, x + colW - 40, yy); g.textAlign = "left";
      g.fillStyle = "#262b35"; g.beginPath(); g.roundRect(x, yy + 14, colW - 40, 10, 5); g.fill();
      g.fillStyle = k === codes.length ? "#4ade80" : "#ffcc33"; g.beginPath(); g.roundRect(x, yy + 14, Math.max(10, (colW - 40) * k / codes.length), 10, 5); g.fill();
    });
    g.fillStyle = "#262b35"; g.fillRect(80, footY - 40, W - 160, 2);
    g.fillStyle = "#7d8490"; g.font = "500 26px Inter, sans-serif"; g.fillText(`${me.username} · ${pretty(todayStr())}`, 80, footY);
    g.textAlign = "right"; g.fillText(location.host, W - 80, footY); g.textAlign = "left";
    return cv;
  }
  async function openShare() {
    const d = $("dlg-share"); $("share-img").removeAttribute("src"); d.showModal();
    const cv = await makeCard();
    $("share-img").src = cv.toDataURL("image/png");
    shareBlob = await new Promise(r => cv.toBlob(r, "image/png"));
  }
  $("share-download").addEventListener("click", () => {
    if (!shareBlob) return;
    const a = el("a", { href: URL.createObjectURL(shareBlob), download: `plaka-ilerleme-${toInput(todayStr())}.png` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  });
  $("share-send").addEventListener("click", async () => {
    if (!shareBlob) return;
    const n = Object.keys(state).length;
    const file = new File([shareBlob], "plaka-ilerleme.png", { type: "image/png" });
    const text = `81 ilin ${acc(n)} gördüm (%${Math.round(100 * n / 81)})! plaka`;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text });
      else { $("share-download").click(); toast("Paylaşım desteklenmiyor; görsel indirildi"); }
    } catch (e) { if (e.name !== "AbortError") toast("Paylaşılamadı"); }
  });

  // ================================================================ telefona yükleme
  let installEvt = null;
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; updateInstallUI(); });
  window.addEventListener("appinstalled", () => { installEvt = null; toast("Uygulama yüklendi"); updateInstallUI(); });
  function updateInstallUI() {
    const can = !isStandalone() && (installEvt || isIOS());
    $("btn-install").closest(".row").hidden = isStandalone();
    $("install-hint").textContent = isStandalone() ? "" : installEvt || isIOS() ? "Uygulama gibi aç; internet yokken de çalışır." : "Tarayıcının menüsünden \"Uygulamayı yükle\" ya da \"Ana ekrana ekle\"yi seç.";
    $("install-banner").hidden = !(can && !prefs.installDismissed && innerWidth <= 760);
  }
  async function doInstall() {
    if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); if (r && r.outcome === "accepted") installEvt = null; updateInstallUI(); return; }
    if (isIOS()) { $("dlg-ios").showModal(); return; }
    toast("Tarayıcının menüsünden \"Uygulamayı yükle\"yi seç");
  }
  $("install-x").addEventListener("click", () => { prefs.installDismissed = true; savePrefs(); updateInstallUI(); });

  // ================================================================ yönetici
  async function openAdmin() {
    const list = $("adm-list"); list.textContent = ""; $("adm-sum").textContent = "Yükleniyor…";
    if (!$("dlg-admin").open) $("dlg-admin").showModal();
    api("/api/admin/summary").then(sm => {
      const box = $("adm-kpis"); box.textContent = "";
      const kpi = (k, v, s) => el("div", { class: "kpi" }, el("span", { text: k }), el("b", { text: v }), s ? el("small", { text: s }) : null);
      box.append(kpi("Kullanıcı", String(sm.users), `${sm.activeLast7} kişi son 7 günde aktif`), kpi("Toplam işaret", sm.totalMarks.toLocaleString("tr-TR"), `kişi başı ${sm.avg} il`),
        kpi("Son 7 gün", String(sm.last7), `son 30 gün: ${sm.last30}`), kpi("81'i tamamlayan", String(sm.completed), "kişi"));
      $("adm-extra").textContent = sm.mostSeen.length ? "En çok görülen: " + sm.mostSeen.map(x => `${label(x.code)} (${x.n})`).join(", ") : "";
    }).catch(e => { $("adm-extra").textContent = e.message; });
    try {
      const users = await api("/api/admin/users");
      $("adm-sum").textContent = `${users.length} kullanıcı. Şifresini unutan biri için geçici şifre oluşturabilirsin; kullanıcı girdikten sonra Ayarlar'dan değiştirmeli.`;
      users.forEach(u => {
        const li = el("li", null, el("span", { class: "u", text: u.username }), u.is_admin ? el("span", { class: "tag", text: "Yönetici" }) : null, el("span", { class: "c", text: `${u.marked}/81` }));
        if (!u.is_admin) {
          li.append(
            el("button", { type: "button", text: "Geçici şifre", onclick: async () => {
              if (!(await confirmDlg({ title: "Geçici şifre oluşturulsun mu?", text: `"${u.username}" kullanıcısının şifresi değişecek. Yeni şifreyi ona sen ileteceksin.`, yes: "Oluştur", danger: false }))) return;
              try {
                const r = await api(`/api/admin/users/${u.id}/password`, { method: "POST" });
                const old = li.querySelector(".temp-pw"); if (old) old.remove();
                li.append(el("div", { class: "temp-pw" }, "Geçici şifre: ", el("code", { text: r.tempPassword }), " · yalnız bir kez gösterilir"));
              } catch (err) { toast(err.message); }
            } }),
            el("button", { type: "button", class: "del", text: "Sil", onclick: async () => {
              if (!(await confirmDlg({ title: "Kullanıcı silinsin mi?", text: `"${u.username}" ve bütün işaretleri kalıcı olarak silinecek.`, yes: "Sil" }))) return;
              try { await api(`/api/admin/users/${u.id}`, { method: "DELETE" }); toast(`${u.username} silindi`); openAdmin(); } catch (err) { toast(err.message); }
            } })
          );
        }
        list.append(li);
      });
    } catch (err) { $("adm-sum").textContent = err.message; }
  }

  // ================================================================ başlangıç
  applyPrefs();
  const mq = matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) mq.addEventListener("change", applyPrefs);
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("/sw.js").catch(() => {});
  (async function init() {
    if (!session.get("token")) { showAuth(); return; }
    try { await enterApp(await api("/api/me")); }
    catch (e) {
      const offline = e.message.includes("ulaşılamadı");
      me.username = session.get("username") || "";
      if (offline && me.username && readCache()) { await enterApp({ username: me.username, isAdmin: false }, true); return; }
      if ($("auth").hidden) showAuth(offline ? e.message : "");
    }
  })();
})();
