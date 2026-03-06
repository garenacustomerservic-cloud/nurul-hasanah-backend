/**
 * Backend Nurul Hasanah — Railway.app
 * v2.1 — Fix: crash protection, backup otomatis, error handling
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT      = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const BAK_FILE  = path.join(__dirname, 'data.bak.json');

const DEFAULT_USERS = [
  { id:'USR001', nama:'Drs. Ahmad Fauzi, M.Pd',  nip:'196501011990031001', grade:1, password:'kepsek123',     aktif:true },
  { id:'USR002', nama:'Budi Santoso, S.Kom',      nip:'197203152000121002', grade:2, password:'superadmin123', aktif:true },
  { id:'USR003', nama:'Siti Aminah, S.Pd.I',      nip:'198506202010012003', grade:3, password:'guruntu123',    aktif:true },
  { id:'USR004', nama:'Ustdzh. Fatimah Az-Zahra', nip:'199012102015042004', grade:4, password:'guruummi123',   aktif:true },
  { id:'USR005', nama:'Muhamad Rizki, S.Pd',      nip:'199505052020011005', grade:5, password:'gurubiasa123',  aktif:true },
];

const DEFAULT_DATA = {
  pengumuman: [
    { id:1, judul:'PPDB 2025/2026 Resmi Dibuka',        kategori:'Pengumuman', tanggal:'2025-12-01', status:'Aktif', isi:'Pendaftaran dibuka mulai 1 Desember 2025.' },
    { id:2, judul:'Maulid Nabi SAW Berlangsung Khidmat', kategori:'Kegiatan',  tanggal:'2025-11-20', status:'Aktif', isi:'Acara berlangsung khidmat dan penuh hikmah.' },
    { id:3, judul:'Jadwal Ujian Akhir Semester Ganjil',  kategori:'Akademik',  tanggal:'2025-11-10', status:'Aktif', isi:'Ujian dilaksanakan 15-20 Desember 2025.' },
  ],
  galeri:[], maintenance:false,
  maintConfig:{ msgId:'Website sedang dalam pemeliharaan.', msgEn:'Under maintenance.', eta:'2 jam lagi', contact:'+62 812-3456-7890' },
  konten:{
    tagline:'Mendidik Generasi Qurani, Berakhlak Mulia, dan Berprestasi - sejak 1999.',
    tahun:'25+', alumni:'1200+', guru:'50+', lulus:'98%', berdiri:'1999',
    alamat:'Jl. Nurul Hasanah No. 1, Kecamatan Contoh, Kabupaten Contoh 12345',
    telp:'(021) 1234-5678', wa:'+62 812-3456-7890',
    jam:'Senin-Jumat: 07.00-16.00 WIB', jamSabtu:'Sabtu: 07.00-12.00 WIB'
  },
  laporan:[], ppdb:[], visitors:[], users:DEFAULT_USERS, customHtml:null
};

function loadData() {
  for (const file of [DATA_FILE, BAK_FILE]) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        if (raw && raw.trim()) {
          const merged = Object.assign({}, DEFAULT_DATA, JSON.parse(raw));
          if (!merged.users || !merged.users.length) merged.users = DEFAULT_USERS;
          console.log('[DB] Loaded', file, '- users:', merged.users.length);
          return merged;
        }
      }
    } catch(e) { console.error('[DB] Failed', file, e.message); }
  }
  console.log('[DB] Using defaults');
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveData(data) {
  try {
    if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, BAK_FILE);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch(e) { console.error('[DB] Save error:', e.message); return false; }
}

let store = loadData();
setInterval(() => saveData(store), 30000);

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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname, meth = req.method;

    if (meth === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

    // Health
    if (p === '/' || p === '/health' || p === '/ping') {
      return json(res, { status:'ok', uptime:Math.floor(process.uptime()), users:(store.users||[]).length, ppdb:(store.ppdb||[]).length });
    }

    // Login
    if (p === '/api/login' && meth === 'POST') {
      try {
        const { nip, password } = await parseBody(req);
        if (!nip || !password) return json(res, { ok:false, error:'NIP dan password wajib diisi' }, 400);
        const user = (store.users||[]).find(u => u.nip === nip && u.aktif !== false);
        if (!user) return json(res, { ok:false, error:'NIP tidak ditemukan atau nonaktif' }, 401);
        if (user.password !== password) return json(res, { ok:false, error:'Password salah' }, 401);
        const { password:_, ...safe } = user;
        return json(res, { ok:true, user:safe });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // Users
    if (p === '/api/users' && meth === 'GET') {
      return json(res, (store.users||[]).map(({ password, ...u }) => u));
    }
    if (p === '/api/users' && meth === 'POST') {
      try {
        const { nama, nip, grade, password } = await parseBody(req);
        if (!nama||!nip||!grade||!password) return json(res, { ok:false, error:'Semua field wajib diisi' }, 400);
        if (!store.users) store.users = [];
        if (store.users.find(u => u.nip === nip)) return json(res, { ok:false, error:'NIP sudah terdaftar' }, 409);
        const u = { id:'USR'+Date.now(), nama, nip, grade:parseInt(grade), password, aktif:true };
        store.users.push(u); saveData(store);
        const { password:_, ...safe } = u;
        return json(res, { ok:true, user:safe });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }
    if (p.match(/^\/api\/users\/[^/]+$/) && meth === 'PATCH') {
      const id = p.split('/')[3];
      const u = (store.users||[]).find(x => x.id === id);
      if (!u) return json(res, { ok:false, error:'User tidak ditemukan' }, 404);
      try {
        const body = await parseBody(req);
        if (body.password) u.password = body.password;
        if (body.nama) u.nama = body.nama;
        saveData(store);
        const { password:_, ...safe } = u;
        return json(res, { ok:true, user:safe });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }
    if (p.match(/^\/api\/users\/[^/]+$/) && meth === 'DELETE') {
      const id = p.split('/')[3];
      const u = (store.users||[]).find(x => x.id === id);
      if (!u) return json(res, { ok:false, error:'User tidak ditemukan' }, 404);
      if (u.grade === 1) return json(res, { ok:false, error:'Kepala Sekolah tidak bisa dihapus' }, 403);
      store.users = store.users.filter(x => x.id !== id); saveData(store);
      return json(res, { ok:true });
    }
    if (p.match(/^\/api\/users\/[^/]+\/toggle$/) && meth === 'POST') {
      const id = p.split('/')[3];
      const u = (store.users||[]).find(x => x.id === id);
      if (!u) return json(res, { ok:false, error:'User tidak ditemukan' }, 404);
      if (u.grade === 1) return json(res, { ok:false, error:'Status Kepala Sekolah tidak bisa diubah' }, 403);
      try {
        const { aktif } = await parseBody(req);
        u.aktif = aktif; saveData(store);
        return json(res, { ok:true, aktif:u.aktif });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // Data
    if (p === '/api/data' && meth === 'GET') {
      const { users, ...pub } = store; return json(res, pub);
    }
    if (p === '/api/data' && meth === 'POST') {
      try {
        const { users, ...body } = await parseBody(req);
        store = Object.assign({}, store, body);
        if (!store.users || !store.users.length) store.users = DEFAULT_USERS;
        saveData(store); return json(res, { ok:true });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // Laporan
    if (p === '/api/laporan' && meth === 'POST') {
      try {
        const lap = await parseBody(req);
        lap.id = 'LAP-'+Date.now(); lap.waktu = new Date().toISOString(); lap.status = 'baru';
        if (!store.laporan) store.laporan = [];
        store.laporan.unshift(lap); saveData(store);
        return json(res, { ok:true, id:lap.id });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // PPDB
    if (p === '/api/ppdb' && meth === 'GET') {
      return json(res, store.ppdb || []);
    }
    if (p === '/api/ppdb' && meth === 'POST') {
      try {
        const data = await parseBody(req);
        if (!data.id) data.id = 'PPDB-'+Date.now();
        data.waktuServer = new Date().toISOString();
        data.status = data.status || 'baru';
        if (!store.ppdb) store.ppdb = [];
        const idx = store.ppdb.findIndex(x => x.id === data.id);
        if (idx >= 0) store.ppdb[idx] = data; else store.ppdb.unshift(data);
        saveData(store);
        return json(res, { ok:true, id:data.id });
      } catch(e) { return json(res, { ok:false, error:e.message }, 400); }
    }

    // Visitor
    if (p === '/api/visitor' && meth === 'POST') {
      try {
        const v = await parseBody(req);
        v.waktu = new Date().toISOString();
        if (!store.visitors) store.visitors = [];
        store.visitors.push(v);
        if (store.visitors.length > 1000) store.visitors = store.visitors.slice(-1000);
        saveData(store); return json(res, { ok:true });
      } catch(e) { return json(res, { ok:false }, 400); }
    }

    // Stats
    if (p === '/api/stats' && meth === 'GET') {
      const vs = store.visitors||[], now = new Date();
      const today = now.toDateString(), week = now-7*864e5, month = now-30*864e5;
      const pages={}, byDay={};
      vs.forEach(v => { pages[v.page]=(pages[v.page]||0)+1; });
      vs.filter(v => new Date(v.waktu)>week).forEach(v => {
        const d = new Date(v.waktu).toLocaleDateString('id-ID',{weekday:'short'});
        byDay[d]=(byDay[d]||0)+1;
      });
      return json(res, {
        total:vs.length,
        today:vs.filter(v=>new Date(v.waktu).toDateString()===today).length,
        week:vs.filter(v=>new Date(v.waktu)>week).length,
        month:vs.filter(v=>new Date(v.waktu)>month).length,
        ppdb:(store.ppdb||[]).length, pages, byDay
      });
    }

    json(res, { error:'Not found' }, 404);

  } catch(err) {
    console.error('[ERROR]', err.message);
    try { cors(res); res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:false,error:'Server error'})); } catch(e) {}
  }
});

process.on('uncaughtException', err => { console.error('[CRASH]', err.message); saveData(store); });
process.on('unhandledRejection', r => { console.error('[REJECTION]', r); });

server.listen(PORT, () => {
  console.log('[OK] Backend port', PORT, '| Users:', store.users.length, '| PPDB:', (store.ppdb||[]).length);
});
