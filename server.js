require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- ayarlar
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'yedekler');
const BACKUP_KEEP_DAYS = parseInt(process.env.BACKUP_KEEP_DAYS || '14', 10);

if (!SECRET_KEY || SECRET_KEY.length < 32) {
    console.error('SECRET_KEY eksik ya da çok kısa (en az 32 karakter). .env dosyasını kontrol edin.');
    process.exit(1);
}

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;
// Olmayan kullanıcıda da şifre kontrolü yapılır; yanıt süresinden kullanıcı adının varlığı anlaşılmasın.
const DUMMY_HASH = bcrypt.hashSync('plaka-dummy-password', 10);
const isAdmin = (username) => Boolean(ADMIN_USERNAME) && username === ADMIN_USERNAME;
const isStr = (...v) => v.every(x => typeof x === 'string' && x.length > 0 && x.length <= 200);
const issueSession = (user) => ({
    token: jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' }),
    username: user.username,
    isAdmin: isAdmin(user.username),
});

// Hesap başına yanlış şifre kilidi: 10 yanlış denemeden sonra hesap 15 dakika kilitlenir.
const LOCK_AFTER = 10;
const LOCK_MS = 15 * 60 * 1000;
const loginFails = new Map();
const isLocked = (username) => {
    const f = loginFails.get(username);
    if (!f || !f.until) return false;
    if (Date.now() > f.until) { loginFails.delete(username); return false; }
    return true;
};
const recordFail = (username) => {
    if (loginFails.size > 10000) loginFails.clear(); // bellek sınırı
    const f = loginFails.get(username) || { n: 0, until: 0 };
    f.n += 1;
    if (f.n >= LOCK_AFTER) { f.until = Date.now() + LOCK_MS; f.n = 0; }
    loginFails.set(username, f);
};

// ---------------------------------------------------------------- uygulama
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = [process.env.ALLOWED_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new Error('CORS kuralları gereği bu isteğe izin verilmiyor.'));
    }
}));

app.use(express.json({ limit: '50kb' }));
// Yalnız public/ klasörü internete açıktır (kod, veritabanı ve .env asla sunulmaz).
// Yazı tipi, harita ve simgeler uzun süre önbellekte kalır; uygulama dosyaları (js/css/manifest)
// her açılışta "değişti mi" diye kontrol edilir, böylece güncellemeler hemen görünür.
app.get('/sw.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
    dotfiles: 'ignore', maxAge: '7d',
    setHeaders: (res, file) => { if (/\.(js|css|webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); }
}));
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'ignore', index: 'index.html', setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

// Gerçek ziyaretçi adresi: uygulama yalnız Cloudflare üzerinden erişilebilir, başlığı Cloudflare yazar.
const clientKey = (req) => req.headers['cf-connecting-ip'] || req.ip;
const authLimiter = rateLimit({
    keyGenerator: clientKey,
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Çok fazla deneme yaptınız, lütfen 15 dakika sonra tekrar deneyin." }
});
const apiLimiter = rateLimit({
    keyGenerator: clientKey,
    windowMs: 5 * 60 * 1000,
    max: 150,
    message: { error: "Çok fazla istek atıldı, lütfen bekleyin." }
});

const db = new sqlite3.Database('./veritabani.sqlite');
db.serialize(() => {
    // email/otp sütunları eski sürümle uyum için duruyor; artık kullanılmıyor.
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, otp TEXT, otp_expiry INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS plates (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, plates_data TEXT)");
    // Yıllara göre işaret geçmişi (yıllık sezon ve geçmiş yıllar için)
    db.run("CREATE TABLE IF NOT EXISTS plate_history (user_id INTEGER NOT NULL, year INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (user_id, year))");
    db.all("PRAGMA table_info(users)", (err, cols) => {
        if (!err && cols && !cols.some(c => c.name === 'created_at')) db.run("ALTER TABLE users ADD COLUMN created_at INTEGER");
    });
});

// ---------------------------------------------------------------- veritabanı yardımcıları
const dbGet = (q, p = []) => new Promise((ok, no) => db.get(q, p, (e, r) => e ? no(e) : ok(r)));
const dbAll = (q, p = []) => new Promise((ok, no) => db.all(q, p, (e, r) => e ? no(e) : ok(r)));
const dbRun = (q, p = []) => new Promise((ok, no) => db.run(q, p, function (e) { e ? no(e) : ok(this); }));

// Aynı kullanıcının istekleri sırayla işlenir: iki cihazdan aynı anda gelen değişiklikler birbirini ezmez.
const userLocks = new Map();
function withUserLock(uid, fn) {
    const prev = userLocks.get(uid) || Promise.resolve();
    const run = prev.catch(() => {}).then(fn);
    userLocks.set(uid, run.finally(() => { if (userLocks.get(uid) === run) userLocks.delete(uid); }));
    return run;
}

const DATE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const yearOf = (v) => { const m = DATE_RE.exec(v || ''); return m ? +m[3] : null; };
const dayValue = (v) => { const m = DATE_RE.exec(v || ''); return m ? (+m[3]) * 10000 + (+m[2]) * 100 + (+m[1]) : 0; };
// Geçerli tarih: metin, takvimde gerçekten olan bir gün (31.02 olmaz), 2000'den yarına kadar (saat dilimi payı)
const validDate = (v) => {
    if (typeof v !== 'string') return false;
    const m = DATE_RE.exec(v); if (!m) return false;
    const d = +m[1], mo = +m[2], y = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return false;
    return y >= 2000 && dt.getTime() <= Date.now() + 2 * 24 * 60 * 60 * 1000;
};
const validCode = (c) => Number.isInteger(c) && c >= 1 && c <= 81;

// Geçmişten "tüm zamanlar" görünümü: her il için en son görüldüğü tarih
function latestOf(history) {
    const out = {};
    for (const y of Object.keys(history)) for (const [c, v] of Object.entries(history[y])) if (!out[c] || dayValue(v) >= dayValue(out[c])) out[c] = v;
    return out;
}

async function loadHistory(uid) {
    const rows = await dbAll("SELECT year, data FROM plate_history WHERE user_id = ?", [uid]);
    const history = {};
    for (const r of rows) { try { const d = JSON.parse(r.data); if (Object.keys(d).length) history[r.year] = d; } catch (e) {} }
    if (rows.length) return history;
    // Eski düz kayıttan ilk geçiş: her işaret kendi tarihinin yılına konur
    const p = await dbGet("SELECT plates_data FROM plates WHERE user_id = ?", [uid]);
    let flat = {}; try { flat = JSON.parse((p && p.plates_data) || '{}'); } catch (e) {}
    const thisYear = new Date().getFullYear();
    for (const [c, v] of Object.entries(flat)) {
        const code = parseInt(c, 10); if (!validCode(code) || !v) continue;
        const y = yearOf(v) || thisYear; (history[y] = history[y] || {})[code] = String(v).slice(0, 32);
    }
    if (Object.keys(history).length) await saveHistory(uid, history);
    return history;
}

// Önce yeni yıllar yazılır, sonra artık boş olan yıllar silinir: yarıda kesilse bile geçmiş toptan kaybolmaz.
// Yıl 0 satırı "göç yapıldı" işaretidir; tüm işaretler kaldırılsa da eski düz kayıttan yeniden göç yapılmaz.
async function saveHistory(uid, history) {
    const years = Object.keys(history).filter(y => Object.keys(history[y]).length).map(Number);
    await dbRun("INSERT INTO plate_history (user_id, year, data) VALUES (?, 0, '{}') ON CONFLICT(user_id, year) DO NOTHING", [uid]);
    for (const y of years) await dbRun("INSERT INTO plate_history (user_id, year, data) VALUES (?, ?, ?) ON CONFLICT(user_id, year) DO UPDATE SET data = excluded.data", [uid, y, JSON.stringify(history[y])]);
    await dbRun(`DELETE FROM plate_history WHERE user_id = ? AND year <> 0${years.length ? ` AND year NOT IN (${years.map(() => '?').join(',')})` : ''}`, [uid, ...years]);
    const flat = JSON.stringify(latestOf(history));
    const row = await dbGet("SELECT id FROM plates WHERE user_id = ?", [uid]);
    if (row) await dbRun("UPDATE plates SET plates_data = ? WHERE user_id = ?", [flat, uid]);
    else await dbRun("INSERT INTO plates (user_id, plates_data) VALUES (?, ?)", [uid, flat]);
}

// Kullanmaya başlama yılı: kayıt tarihi
async function startYearOf(uid, history) {
    const u = await dbGet("SELECT created_at FROM users WHERE id = ?", [uid]);
    if (u && u.created_at) return new Date(u.created_at).getFullYear();
    // Kayıt tarihi tutulmayan eski hesaplar: bu sürümün hesabı ilk gördüğü an başlangıç sayılır
    const now = Date.now();
    await dbRun("UPDATE users SET created_at = ? WHERE id = ?", [now, uid]);
    return new Date(now).getFullYear();
}
// Başlangıç yılı: kayıt yılı ya da (eski hesaplarda / eski tarihli yedekte) en eski işaretin yılı
const platesPayload = async (uid, history) => ({ plates_data: latestOf(history), history, startYear: Math.min(await startYearOf(uid, history), ...Object.keys(history).map(Number).filter(y => y >= 2000)) });
// Hesap silindiyse (ör. başka cihazdan) eski oturum veri yaratamasın
async function mustExist(uid) { const u = await dbGet("SELECT id FROM users WHERE id = ?", [uid]); if (!u) { const e = new Error("gone"); e.gone = true; throw e; } }
const goneOr500 = (res, e, msg) => e && e.gone ? res.status(401).json({ error: "Hesap bulunamadı." }) : res.status(500).json({ error: msg });

const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Yetkisiz!" });
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Geçersiz token" });
        req.user = decoded;
        next();
    });
};
const adminOnly = (req, res, next) => {
    if (!isAdmin(req.user.username)) return res.status(403).json({ error: "Yetkisiz erişim!" });
    next();
};

// ---------------------------------------------------------------- gecelik yedek (sunucu içinde)
cron.schedule('0 3 * * *', () => {
    try {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        const dateStr = new Date().toISOString().split('T')[0];
        const target = path.join(BACKUP_DIR, `plaka_${dateStr}.sqlite`);
        if (fs.existsSync(target)) fs.unlinkSync(target);
        db.run("VACUUM INTO ?", [target], (err) => {
            if (err) return console.error('Yedekleme hatası:', err.message);
            console.log('Gecelik yedek alındı:', path.basename(target));
            const cutoff = Date.now() - BACKUP_KEEP_DAYS * 24 * 60 * 60 * 1000;
            for (const f of fs.readdirSync(BACKUP_DIR)) {
                const p = path.join(BACKUP_DIR, f);
                if (/^plaka_\d{4}-\d{2}-\d{2}\.sqlite$/.test(f) && fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
            }
        });
    } catch (e) {
        console.error('Yedekleme hatası:', e.message);
    }
}, { timezone: 'Europe/Istanbul' });

// ---------------------------------------------------------------- hesap
app.post('/api/register', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!isStr(username, password)) return res.status(400).json({ error: "Eksik bilgi girdiniz!" });
    if (!USERNAME_RE.test(username)) return res.status(400).json({ error: "Kullanıcı adı 3-20 karakter olmalı; yalnız harf, rakam, nokta, alt çizgi ve tire kullanılabilir." });
    if (password.length < 6) return res.status(400).json({ error: "Şifre en az 6 karakter olmalı!" });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run("INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)", [username, hashedPassword, Date.now()], function (err) {
            if (err) return res.status(400).json({ error: "Bu kullanıcı adı zaten kullanımda!" });
            res.json(issueSession({ id: this.lastID, username }));
        });
    } catch (e) {
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

app.post('/api/login', authLimiter, (req, res) => {
    const { username, password } = req.body;
    const WRONG = "Kullanıcı adı veya şifre hatalı!";
    if (!isStr(username, password)) return res.status(400).json({ error: WRONG });
    if (isLocked(username)) return res.status(429).json({ error: "Bu hesap çok fazla hatalı deneme nedeniyle 15 dakika kilitlendi." });
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        try {
            const match = await bcrypt.compare(password, !err && user ? user.password : DUMMY_HASH) && !err && Boolean(user);
            if (!match) { recordFail(username); return res.status(400).json({ error: WRONG }); }
            loginFails.delete(username);
            res.json(issueSession(user));
        } catch (e) {
            res.status(500).json({ error: "Sunucu hatası" });
        }
    });
});

app.use('/api/', apiLimiter);

app.get('/api/me', auth, (req, res) => {
    res.json({ username: req.user.username, isAdmin: isAdmin(req.user.username) });
});

// Kullanıcı kendi hesabını ve tüm verisini siler (şifre onayıyla)
app.delete('/api/me', auth, (req, res) => {
    const { password } = req.body || {};
    if (!isStr(password)) return res.status(400).json({ error: "Şifrenizi girmelisiniz!" });
    if (isAdmin(req.user.username)) return res.status(400).json({ error: "Yönetici hesabı buradan silinemez." });
    db.get("SELECT * FROM users WHERE id = ?", [req.user.id], async (err, user) => {
        try {
            if (err || !user) return res.status(400).json({ error: "Kullanıcı bulunamadı!" });
            if (!(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Şifreniz hatalı!" });
            await withUserLock(user.id, async () => {
                await dbRun("DELETE FROM users WHERE id = ?", [user.id]);
                await dbRun("DELETE FROM plates WHERE user_id = ?", [user.id]);
                await dbRun("DELETE FROM plate_history WHERE user_id = ?", [user.id]);
            });
            res.json({ message: "Hesabınız ve tüm verileriniz silindi." });
        } catch (e) {
            res.status(500).json({ error: "Sunucu hatası." });
        }
    });
});

// ---------------------------------------------------------------- plakalar
app.get('/api/plates', auth, async (req, res) => {
    try {
        const out = await withUserLock(req.user.id, async () => { await mustExist(req.user.id); return platesPayload(req.user.id, await loadHistory(req.user.id)); });
        res.json(out);
    } catch (e) { goneOr500(res, e, "Veriler okunamadı."); }
});

// Akıllı eşitleme: cihazlar yalnız değişikliklerini gönderir, sunucu il il ve sırayla uygular.
//   { op: "set", c, d }    → d tarihinin yılına c ilini ekler/günceller
//   { op: "del", c, y }    → y yılından c ilini kaldırır
//   { op: "delAll", c }    → c ilini bütün yıllardan kaldırır
app.post('/api/plates/ops', auth, async (req, res) => {
    const ops = req.body && req.body.ops;
    if (!Array.isArray(ops) || ops.length === 0 || ops.length > 500) return res.status(400).json({ error: "Geçersiz değişiklik listesi." });
    for (const o of ops) {
        if (!o || typeof o !== 'object' || !validCode(o.c)) return res.status(400).json({ error: "Geçersiz il kodu." });
        if (o.op === "set" && !validDate(o.d)) return res.status(400).json({ error: "Geçersiz tarih." });
        if (o.op === "del" && !(Number.isInteger(o.y) && o.y >= 2000 && o.y <= 2100)) return res.status(400).json({ error: "Geçersiz yıl." });
        if (!["set", "del", "delAll"].includes(o.op)) return res.status(400).json({ error: "Geçersiz işlem." });
    }
    try {
        const out = await withUserLock(req.user.id, async () => {
            await mustExist(req.user.id);
            const h = await loadHistory(req.user.id);
            for (const o of ops) {
                if (o.op === "set") { const y = yearOf(o.d); (h[y] = h[y] || {})[o.c] = o.d; }
                else if (o.op === "del") { if (h[o.y]) { delete h[o.y][o.c]; if (!Object.keys(h[o.y]).length) delete h[o.y]; } }
                else for (const y of Object.keys(h)) { delete h[y][o.c]; if (!Object.keys(h[y]).length) delete h[y]; }
            }
            await saveHistory(req.user.id, h);
            return platesPayload(req.user.id, h);
        });
        res.json({ message: "Kaydedildi", ...out });
    } catch (e) { goneOr500(res, e, "Kaydedilemedi."); }
});

// Eski sürümle uyum: tüm listeyi gönderen istemciler (yalnız "tüm zamanlar" görünümünü değiştirir)
app.post('/api/plates', auth, async (req, res) => {
    const { plates_data } = req.body || {};
    try {
        await withUserLock(req.user.id, async () => {
            await mustExist(req.user.id);
            const h = await loadHistory(req.user.id), latest = latestOf(h);
            for (const c of Object.keys(latest)) if (!plates_data || !plates_data[c]) for (const y of Object.keys(h)) { delete h[y][c]; if (!Object.keys(h[y]).length) delete h[y]; }
            for (const [k, v] of Object.entries(plates_data || {})) {
                const c = parseInt(k, 10); if (!validCode(c) || !validDate(String(v))) continue;
                if (latest[c] === v) continue;
                for (const yy of Object.keys(h)) { delete h[yy][c]; if (!Object.keys(h[yy]).length) delete h[yy]; }   // tek kayıt: gönderilen tarih
                const y = yearOf(v); (h[y] = h[y] || {})[c] = String(v);
            }
            await saveHistory(req.user.id, h);
        });
        res.json({ message: "Kaydedildi" });
    } catch (e) { goneOr500(res, e, "Kaydedilemedi."); }
});

// ---------------------------------------------------------------- ayarlar (şifre değiştirme)
app.post('/api/settings', auth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!isStr(currentPassword)) return res.status(400).json({ error: "Mevcut şifrenizi girmelisiniz!" });
    if (!isStr(newPassword) || newPassword.length < 6) return res.status(400).json({ error: "Yeni şifre en az 6 karakter olmalı!" });
    db.get("SELECT * FROM users WHERE id = ?", [req.user.id], async (err, user) => {
        try {
            if (err || !user) return res.status(400).json({ error: "Kullanıcı bulunamadı!" });
            if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ error: "Mevcut şifreniz hatalı!" });
            const hash = await bcrypt.hash(newPassword, 10);
            db.run("UPDATE users SET password = ? WHERE id = ?", [hash, req.user.id], (err) => {
                if (err) return res.status(500).json({ error: "Şifre güncellenemedi." });
                res.json({ message: "Şifreniz başarıyla güncellendi." });
            });
        } catch (e) {
            res.status(500).json({ error: "Sunucu hatası." });
        }
    });
});

// ---------------------------------------------------------------- yönetici
// Yönetici için kullanım özeti
app.get('/api/admin/summary', auth, adminOnly, (req, res) => {
    db.all("SELECT u.id, u.username, p.plates_data FROM users u LEFT JOIN plates p ON p.user_id = u.id", (err, rows) => {
        if (err) return res.status(500).json({ error: "Hata oluştu" });
        const now = Date.now(), DAY = 86400000;
        const parse = (v) => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v || ''); return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : null; };
        let total = 0, last7 = 0, last30 = 0, completed = 0, active = 0;
        const perCode = {};
        const users = rows.map(r => {
            let data = {}; try { data = JSON.parse(r.plates_data || '{}'); } catch (e) { data = {}; }
            const codes = Object.keys(data); total += codes.length; if (codes.length === 81) completed++;
            let recent = 0;
            for (const k of codes) {
                perCode[k] = (perCode[k] || 0) + 1;
                const t = parse(data[k]);
                if (t !== null && now - t <= 7 * DAY) { last7++; recent++; }
                if (t !== null && now - t <= 30 * DAY) last30++;
            }
            if (recent) active++;
            return { username: r.username, marked: codes.length };
        });
        const ranked = Object.entries(perCode).sort((a, b) => b[1] - a[1]);
        res.json({
            users: rows.length, totalMarks: total, avg: rows.length ? Math.round(total / rows.length) : 0,
            completed, last7, last30, activeLast7: active,
            top: users.sort((a, b) => b.marked - a.marked).slice(0, 3),
            mostSeen: ranked.slice(0, 5).map(([k, n]) => ({ code: +k, n })),
        });
    });
});

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
    db.all("SELECT u.id, u.username, p.plates_data FROM users u LEFT JOIN plates p ON p.user_id = u.id ORDER BY u.id", (err, rows) => {
        if (err) return res.status(500).json({ error: "Hata oluştu" });
        res.json(rows.map(r => {
            let marked = 0;
            try { marked = Object.keys(JSON.parse(r.plates_data || '{}')).length; } catch (e) { marked = 0; }
            return { id: r.id, username: r.username, marked, is_admin: isAdmin(r.username) };
        }));
    });
});

// Şifresini unutan kullanıcıya yönetici geçici şifre verir (tek seferlik gösterilir)
app.post('/api/admin/users/:id/password', auth, adminOnly, async (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    if (!Number.isInteger(targetId) || targetId === req.user.id) return res.status(400).json({ error: "Kendi şifreni Ayarlar'dan değiştir." });
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    const temp = Array.from(require('crypto').randomBytes(10), b => alphabet[b % alphabet.length]).join('');
    try {
        const hash = await bcrypt.hash(temp, 10);
        db.get("SELECT username FROM users WHERE id = ?", [targetId], (e1, row) => {
            if (e1 || !row) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
            db.run("UPDATE users SET password = ? WHERE id = ?", [hash, targetId], (err) => {
                if (err) return res.status(500).json({ error: "Şifre güncellenemedi." });
                loginFails.delete(row.username);   // kilitliyse açılsın
                res.json({ tempPassword: temp });
            });
        });
    } catch (e) {
        res.status(500).json({ error: "Sunucu hatası." });
    }
});

app.delete('/api/admin/users/:id', auth, adminOnly, (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    if (!Number.isInteger(targetId) || targetId === req.user.id) return res.status(400).json({ error: "Bu kullanıcı silinemez." });
    withUserLock(targetId, async () => {
        await dbRun("DELETE FROM users WHERE id = ?", [targetId]);
        await dbRun("DELETE FROM plates WHERE user_id = ?", [targetId]);
        await dbRun("DELETE FROM plate_history WHERE user_id = ?", [targetId]);
    }).then(() => res.json({ message: "Kullanıcı başarıyla silindi." }), () => res.status(500).json({ error: "Silinemedi." }));
});

// Gözden kaçan bir hata tüm sunucuyu düşürmesin
process.on('unhandledRejection', (e) => console.error('Yakalanmamış hata:', e && e.message ? e.message : e));
process.on('uncaughtException', (e) => console.error('Yakalanmamış istisna:', e && e.message ? e.message : e));

app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor.`));
