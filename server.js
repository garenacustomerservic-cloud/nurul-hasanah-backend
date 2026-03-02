/**
 * Backend Nurul Hasanah — Railway.app
 * Persistent storage menggunakan file JSON di disk Railway
 * Data tidak hilang saat server restart!
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT      = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json'); // persistent di Railway

// ── Default data ──
const DEFAULT_DATA = {
  pengumuman: [
    { id: 1, judul: 'PPDB 2025/2026 Resmi Dibuka', kategori: '📢 Pengumuman', tanggal: '2025-12-01', status: 'Aktif', isi: 'Pendaftaran peserta didik baru dibuka mulai 1 Desember 2025.' },
    { id: 2, judul: 'Maulid Nabi SAW Berlangsung Khidmat', kategori: '🎓 Kegiatan', tanggal: '2025-11-20', status: 'Aktif', isi: 'Acara berlangsung khidmat dan penuh hikmah.' },
    { id: 3, judul: 'Jadwal Ujian Akhir Semester Ganjil', kategori: '📚 Akademik', tanggal: '2025-11-10', status: 'Aktif', isi: 'Ujian dilaksanakan 15-20 Desember 2025.' },
    { id: 4, judul: 'Launching Tahfidz Intensif 30 Juz', kategori: '🌿 Program', tanggal: '2025-11-05', status: 'Aktif', isi: 'Program unggulan baru: Tahfidz 30 Juz.' }
  ],
  galeri: [],
  maintenance: false,
  maintConfig: { msgId: 'Website sedang dalam pemeliharaan.', msgEn: 'Under maintenance.', eta: '2 jam lagi', contact: '+62 812-3456-7890' },
  konten: {
    tagline: 'Mendidik Generasi Qurani, Berakhlak Mulia, dan Berprestasi — sejak 1999.',
    quote: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ',
    badge: '✦ Sekolah Model Ummi ✦',
    tahun: '25+', alumni: '1200+', guru: '50+', lulus: '98%', berdiri: '1999',
    deskripsi: 'Madrasah Nurul Hasanah berdiri sejak 1999.',
    deskripsi2: 'Ribuan alumni telah berkiprah membawa nilai-nilai Islam.',
    visi: '"Menjadi Madrasah Unggulan yang Melahirkan Generasi Islami, Berprestasi, dan Berakhlak Mulia di Tingkat Nasional"',
    misi1: "Menyelenggarakan pembelajaran Al-Qur'an dan Sunnah secara konsisten",
    misi2: 'Mengembangkan kemampuan akademik siswa secara optimal',
    misi3: 'Membentuk karakter Islami dalam seluruh aspek kehidupan',
    misi4: 'Menjalin kemitraan dengan orang tua dan masyarakat',
    alamat: 'Jl. Nurul Hasanah No. 1, Kecamatan Contoh, Kabupaten Contoh 12345',
    telp: '(021) 1234-5678', wa: '+62 812-3456-7890',
    jam: 'Senin–Jumat: 07.00–16.00 WIB', jamSabtu: 'Sabtu: 07.00–12.00 WIB'
  },
  laporan: [],
  ppdb: [],
  visitors: [],
  customHtml: null
};

// ── Load/Save ke file ──
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      // Merge dengan DEFAULT agar field baru selalu ada
      return Object.assign({}, DEFAULT_DATA, parsed);
    }
  } catch(e) { console.error('Load error:', e.message); }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch(e) { console.error('Save error:', e.message); return false; }
}

// ── In-memory store (mirrored ke disk) ──
let store = loadData();
console.log('✅ Data dimuat dari disk:', DATA_FILE);

// Auto-save tiap 60 detik sebagai backup
setInterval(() => { saveData(store); }, 60000);

// ── Helpers ──
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if(body.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, data, status = 200) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── Server ──
const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, 'http://localhost');
  const p    = url.pathname;
  const meth = req.method;

  // CORS preflight
  if (meth === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ── GET /api/data ──
  if (p === '/api/data' && meth === 'GET') {
    return json(res, store);
  }

  // ── POST /api/data — simpan semua dari admin ──
  if (p === '/api/data' && meth === 'POST') {
    try {
      const body = await parseBody(req);
      store = Object.assign({}, store, body);
      saveData(store);
      return json(res, { ok: true });
    } catch(e) { return json(res, { ok: false, error: e.message }, 400); }
  }

  // ── POST /api/laporan ──
  if (p === '/api/laporan' && meth === 'POST') {
    try {
      const lap = await parseBody(req);
      lap.id     = 'LAP-' + Date.now();
      lap.waktu  = new Date().toISOString();
      lap.status = 'baru';
      if (!store.laporan) store.laporan = [];
      store.laporan.unshift(lap);
      saveData(store);
      return json(res, { ok: true, id: lap.id });
    } catch(e) { return json(res, { ok: false, error: e.message }, 400); }
  }

  // ── POST /api/ppdb — daftar PPDB dari web utama ──
  if (p === '/api/ppdb' && meth === 'POST') {
    try {
      const data = await parseBody(req);
      data.id     = 'PPDB-' + Date.now();
      data.waktu  = new Date().toISOString();
      data.status = 'baru';
      if (!store.ppdb) store.ppdb = [];
      store.ppdb.unshift(data);
      saveData(store);
      return json(res, { ok: true, id: data.id, noReg: data.id });
    } catch(e) { return json(res, { ok: false, error: e.message }, 400); }
  }

  // ── POST /api/visitor — catat kunjungan ──
  if (p === '/api/visitor' && meth === 'POST') {
    try {
      const v = await parseBody(req);
      v.waktu = new Date().toISOString();
      if (!store.visitors) store.visitors = [];
      store.visitors.push(v);
      // Batasi 1000 record visitor saja
      if (store.visitors.length > 1000) store.visitors = store.visitors.slice(-1000);
      saveData(store);
      return json(res, { ok: true });
    } catch(e) { return json(res, { ok: false }, 400); }
  }

  // ── GET /api/stats ──
  if (p === '/api/stats' && meth === 'GET') {
    const visitors = store.visitors || [];
    const now = new Date();
    const today = now.toDateString();
    const week  = now.getTime() - 7*24*3600*1000;
    const month = now.getTime() - 30*24*3600*1000;

    // Hitung per halaman
    const pages = {};
    visitors.forEach(v => { pages[v.page] = (pages[v.page]||0) + 1; });

    // Hitung per hari (7 hari terakhir)
    const byDay = {};
    visitors.filter(v => new Date(v.waktu).getTime() > week).forEach(v => {
      const d = new Date(v.waktu).toLocaleDateString('id-ID', {weekday:'short'});
      byDay[d] = (byDay[d]||0) + 1;
    });

    return json(res, {
      total: visitors.length,
      today: visitors.filter(v => new Date(v.waktu).toDateString() === today).length,
      week:  visitors.filter(v => new Date(v.waktu).getTime() > week).length,
      month: visitors.filter(v => new Date(v.waktu).getTime() > month).length,
      pages,
      byDay
    });
  }

  // ── Health check ──
  if (p === '/' || p === '/health') {
    cors(res); res.writeHead(200, {'Content-Type':'text/plain'});
    res.end('Nurul Hasanah Backend OK — Data persisted to disk');
    return;
  }

  res.writeHead(404); res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`✅ Backend Nurul Hasanah berjalan di port ${PORT}`);
  console.log(`📁 Data tersimpan di: ${DATA_FILE}`);
});
