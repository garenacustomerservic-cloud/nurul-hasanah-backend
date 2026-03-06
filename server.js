/**
 * Backend Nurul Hasanah — Railway.app + Supabase
 * v3.0 — PostgreSQL via Supabase REST API (no npm install needed)
 */

const http  = require('http');
const https = require('https');

const PORT        = process.env.PORT || 3000;
const SUPA_URL    = process.env.SUPABASE_URL    || 'https://frtmgafoxlooimfuxtyv.supabase.co';
const SUPA_KEY    = process.env.SUPABASE_KEY    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydG1nYWZveGxvb2ltZnV4dHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODQxNTYsImV4cCI6MjA4ODM2MDE1Nn0.Rc5QdISe8Odofo2b3RxqdxYUkBSNqsJbWRd3P_sHC68';

// ── Supabase REST helper ──
function supa(method, table, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    let path = '/rest/v1/' + table;
    const params = [];
    if (opts.select)  params.push('select=' + encodeURIComponent(opts.select));
    if (opts.filter)  params.push(opts.filter);
    if (opts.order)   params.push('order=' + opts.order);
    if (opts.limit)   params.push('limit=' + opts.limit);
    if (params.length) path += '?' + params.join('&');

    const body = opts.body ? JSON.stringify(opts.body) : null;
    const headers = {
      'apikey':        SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type':  'application/json',
      'Prefer':        opts.prefer || 'return=representation'
    };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);

    const req = https.request({
      hostname: SUPA_URL.replace('https://',''),
      path, method,
      headers
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const parsed = d ? JSON.parse(d) : null;
          if (res.statusCode >= 400) reject(new Error(JSON.stringify(parsed)));
          else resolve(parsed);
        } catch(e) { resolve(d); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Shorthand helpers
const db = {
  select: (table, filter, order) => supa('GET', table, { select:'*', filter, order }),
  insert: (table, body)          => supa('POST', table, { body, prefer:'return=representation' }),
  update: (table, filter, body)  => supa('PATCH', table, { filter, body, prefer:'return=representation' }),
  delete: (table, filter)        => supa('DELETE', table, { filter, prefer:'return=minimal' }),
  upsert: (table, body)          => supa('POST', table, { body, prefer:'resolution=merge-duplicates,return=representation' }),
};

// ── App data cache (pengumuman, galeri, konten, dll) ──
let _cache = {};

async function getAppData(key) {
  try {
    const rows = await db.select('app_data', 'key=eq.' + key);
    if (rows && rows.length) return rows[0].value;
  } catch(e) { console.error('getAppData error:', e.message); }
  return null;
}

async function setAppData(key, value) {
  try {
    await db.upsert('app_data', { key, value, updated_at: new Date().toISOString() });
    return true;
  } catch(e) { console.error('setAppData error:', e.message); return false; }
}

async function getAllAppData() {
  try {
    const rows = await db.select('app_data');
    const result = {};
    (rows||[]).forEach(r => { result[r.key] = r.value; });
    return result;
  } catch(e) { console.error('getAllAppData:', e.message); return {}; }
}

// ── HTTP helpers ──
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch(e) { reject(new Error('JSON tidak valid')); } });
    req.on('error', reject);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function json(res, data, status) {
  cors(res);
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── Server ──
const server = http.createServer(async (req, res) => {
  try {
    const url  = new URL(req.url, 'http://localhost');
    const p    = url.pathname;
    const meth = req.method;

    if (meth === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

    // Health
    if (p === '/' || p === '/health' || p === '/ping') {
      return json(res, { status:'ok', db:'supabase', uptime:Math.floor(process.uptime()) });
    }

    // ── POST /api/login ──
    if (p === '/api/login' && meth === 'POST') {
      try {
        const { nip, password } = await parseBody(req);
        if (!nip || !password) return json(res, { ok:false, error:'NIP dan password wajib diisi' }, 400);
        const rows = await db.select('users', 'nip=eq.' + nip);
        const user = (rows||[])[0];
        if (!user)            return json(res, { ok:false, error:'NIP tidak ditemukan' }, 401);
        if (!user.aktif)      return json(res, { ok:false, error:'Akun nonaktif' }, 401);
        if (user.password !== password) return json(res, { ok:false, error:'Password salah' }, 401);
        const { password:_, ...safe } = user;
        return json(res, { ok:true, user:safe });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // ── GET /api/users ──
    if (p === '/api/users' && meth === 'GET') {
      try {
        const rows = await db.select('users', null, 'grade.asc');
        return json(res, (rows||[]).map(({ password, ...u }) => u));
      } catch(e) { return json(res, [], 200); }
    }

    // ── POST /api/users ──
    if (p === '/api/users' && meth === 'POST') {
      try {
        const { nama, nip, grade, password } = await parseBody(req);
        if (!nama||!nip||!grade||!password) return json(res, { ok:false, error:'Semua field wajib diisi' }, 400);
        const u = { id:'USR'+Date.now(), nama, nip, grade:parseInt(grade), password, aktif:true };
        await db.insert('users', u);
        const { password:_, ...safe } = u;
        return json(res, { ok:true, user:safe });
      } catch(e) {
        if (e.message.includes('duplicate') || e.message.includes('unique')) {
          return json(res, { ok:false, error:'NIP sudah terdaftar' }, 409);
        }
        return json(res, { ok:false, error:e.message }, 400);
      }
    }

    // ── PATCH /api/users/:id ──
    if (p.match(/^\/api\/users\/[^/]+$/) && meth === 'PATCH') {
      const id = p.split('/')[3];
      try {
        const body = await parseBody(req);
        const update = {};
        if (body.password) update.password = body.password;
        if (body.nama)     update.nama     = body.nama;
        await db.update('users', 'id=eq.' + id, update);
        return json(res, { ok:true });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // ── DELETE /api/users/:id ──
    if (p.match(/^\/api\/users\/[^/]+$/) && meth === 'DELETE') {
      const id = p.split('/')[3];
      try {
        const rows = await db.select('users', 'id=eq.' + id);
        const u = (rows||[])[0];
        if (!u) return json(res, { ok:false, error:'User tidak ditemukan' }, 404);
        if (u.grade === 1) return json(res, { ok:false, error:'Kepala Sekolah tidak bisa dihapus' }, 403);
        await db.delete('users', 'id=eq.' + id);
        return json(res, { ok:true });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // ── POST /api/users/:id/toggle ──
    if (p.match(/^\/api\/users\/[^/]+\/toggle$/) && meth === 'POST') {
      const id = p.split('/')[3];
      try {
        const rows = await db.select('users', 'id=eq.' + id);
        const u = (rows||[])[0];
        if (!u) return json(res, { ok:false, error:'User tidak ditemukan' }, 404);
        if (u.grade === 1) return json(res, { ok:false, error:'Status Kepala Sekolah tidak bisa diubah' }, 403);
        const { aktif } = await parseBody(req);
        await db.update('users', 'id=eq.' + id, { aktif });
        return json(res, { ok:true, aktif });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // ── GET /api/data ──
    if (p === '/api/data' && meth === 'GET') {
      try {
        const appData = await getAllAppData();
        // Ambil pengumuman, galeri, dll dari app_data
        const result = {
          maintenance:  appData.maintenance  ?? false,
          maintConfig:  appData.maintConfig  ?? {},
          pengumuman:   appData.pengumuman   ?? [],
          galeri:       appData.galeri       ?? [],
          konten:       appData.konten       ?? {},
          customHtml:   appData.customHtml   ?? null,
          laporan:      [],
          ppdb:         [],
          visitors:     [],
        };
        // Ambil laporan
        try {
          const laps = await db.select('laporan', null, 'created_at.desc');
          result.laporan = (laps||[]).map(r => ({ ...r.data, id:r.id, status:r.status }));
        } catch(e) {}
        // Ambil ppdb
        try {
          const ppdbRows = await db.select('ppdb', null, 'created_at.desc');
          result.ppdb = (ppdbRows||[]).map(r => ({ ...r.data, id:r.id, status:r.status }));
        } catch(e) {}
        return json(res, result);
      } catch(e) { return json(res, { error:e.message }, 500); }
    }

    // ── POST /api/data ──
    if (p === '/api/data' && meth === 'POST') {
      try {
        const { users, laporan, ppdb, visitors, ...body } = await parseBody(req);
        // Simpan tiap key ke app_data
        for (const [key, value] of Object.entries(body)) {
          await setAppData(key, value);
        }
        return json(res, { ok:true });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // ── POST /api/laporan ──
    if (p === '/api/laporan' && meth === 'POST') {
      try {
        const data = await parseBody(req);
        const id   = 'LAP-' + Date.now();
        data.waktu = new Date().toISOString();
        await db.insert('laporan', { id, data, status:'baru', created_at: data.waktu });
        return json(res, { ok:true, id });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // ── GET /api/ppdb ──
    if (p === '/api/ppdb' && meth === 'GET') {
      try {
        const rows = await db.select('ppdb', null, 'created_at.desc');
        return json(res, (rows||[]).map(r => ({ ...r.data, id:r.id, status:r.status })));
      } catch(e) { return json(res, [], 200); }
    }

    // ── POST /api/ppdb ──
    if (p === '/api/ppdb' && meth === 'POST') {
      try {
        const data   = await parseBody(req);
        const id     = data.id || ('PPDB-' + Date.now());
        const waktu  = new Date().toISOString();
        data.waktuServer = waktu;
        await db.upsert('ppdb', { id, data, status: data.status||'baru', created_at: waktu });
        return json(res, { ok:true, id });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // ── PATCH /api/ppdb/:id ──
    if (p.match(/^\/api\/ppdb\/[^/]+$/) && meth === 'PATCH') {
      const id = p.split('/')[3];
      try {
        const { status } = await parseBody(req);
        await db.update('ppdb', 'id=eq.' + id, { status });
        return json(res, { ok:true });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // ── POST /api/visitor ──
    if (p === '/api/visitor' && meth === 'POST') {
      try {
        const { page, ua } = await parseBody(req);
        await db.insert('visitors', { page: page||'/', ua: (ua||'').slice(0,100), waktu: new Date().toISOString() });
        return json(res, { ok:true });
      } catch(e) { return json(res, { ok:false }, 400); }
    }

    // ── GET /api/stats ──
    if (p === '/api/stats' && meth === 'GET') {
      try {
        const vs    = await db.select('visitors') || [];
        const now   = new Date();
        const today = now.toDateString();
        const week  = now - 7*864e5;
        const month = now - 30*864e5;
        const pages = {}, byDay = {};
        vs.forEach(v => { pages[v.page]=(pages[v.page]||0)+1; });
        vs.filter(v => new Date(v.waktu)>week).forEach(v => {
          const d = new Date(v.waktu).toLocaleDateString('id-ID',{weekday:'short'});
          byDay[d] = (byDay[d]||0)+1;
        });
        const ppdbCount = await db.select('ppdb');
        return json(res, {
          total: vs.length,
          today: vs.filter(v => new Date(v.waktu).toDateString()===today).length,
          week:  vs.filter(v => new Date(v.waktu)>week).length,
          month: vs.filter(v => new Date(v.waktu)>month).length,
          ppdb:  (ppdbCount||[]).length,
          pages, byDay
        });
      } catch(e) { return json(res, { total:0,today:0,week:0,month:0,ppdb:0,pages:{},byDay:{} }); }
    }

    json(res, { error:'Not found' }, 404);

  } catch(err) {
    console.error('[ERROR]', err.message);
    try { cors(res); res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:false,error:'Server error'})); } catch(e) {}
  }
});

process.on('uncaughtException',   err => console.error('[CRASH]', err.message));
process.on('unhandledRejection',  r   => console.error('[REJECT]', r));

server.listen(PORT, () => {
  console.log('[OK] Nurul Hasanah Backend - port', PORT);
  console.log('[OK] Supabase:', SUPA_URL);
});
