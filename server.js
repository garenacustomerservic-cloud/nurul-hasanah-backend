/**
 * Backend Nurul Hasanah — untuk di-deploy ke Render.com
 * Semua data disimpan di memory (Render free tier tidak punya persistent disk)
 * Data akan reset kalau server restart — upgrade ke paid plan untuk persistent storage
 */

const http = require('http');
const PORT = process.env.PORT || 3000;

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
  maintConfig: {
    msgId: 'Website sedang dalam pemeliharaan.',
    msgEn: 'Under maintenance.',
    eta: '2 jam lagi',
    contact: 'admin@nurulhasanah.sch.id'
  },
  konten: {
    namaSekolah: 'Madrasah Nurul Hasanah',
    tagline: 'Mendidik Generasi Qurani, Berakhlak Mulia, Berprestasi Dunia',
    quote: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا',
    badge: 'Sekolah Islam Unggulan',
    tahun: '25+', alumni: '1200+', guru: '50+', lulus: '98%',
    berdiri: '1999',
    deskripsi: 'Madrasah Nurul Hasanah berdiri sejak tahun 1999, berawal dari cita-cita mulia untuk mencetak generasi Muslim yang cerdas, berakhlak, dan bermanfaat bagi agama, bangsa, dan masyarakat.',
    deskripsi2: 'Dengan pengalaman lebih dari dua dekade, kami telah menghasilkan ribuan alumni yang kini berkiprah di berbagai bidang, membawa nilai-nilai Islam dalam setiap langkah kehidupan mereka.',
    visi: '"Menjadi Madrasah Unggulan yang Melahirkan Generasi Islami, Berprestasi, dan Berakhlak Mulia di Tingkat Nasional"',
    misi1: "Menyelenggarakan pembelajaran Al-Qur'an dan Sunnah secara konsisten",
    misi2: 'Mengembangkan kemampuan akademik siswa secara optimal',
    misi3: 'Membentuk karakter Islami dalam seluruh aspek kehidupan',
    misi4: 'Menjalin kemitraan dengan orang tua dan masyarakat',
    alamat: 'Jl. Nurul Hasanah No. 1, Kecamatan Contoh, Kabupaten Contoh, Provinsi, 12345',
    telp: '(021) 1234-5678', wa: '+62 812-3456-7890',
    email1: 'info@nurulhasanah.sch.id', email2: 'admin@nurulhasanah.sch.id',
    jam: 'Senin – Jumat: 07.00 – 16.00 WIB', jamSabtu: 'Sabtu: 07.00 – 12.00 WIB'
  },
  laporan: [],
  customHtml: null
};

// ── In-memory store ──
let store = JSON.parse(JSON.stringify(DEFAULT_DATA));

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch(e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const path = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // GET /api/data
  if (path === '/api/data' && req.method === 'GET') {
    return json(res, store);
  }

  // POST /api/data — simpan semua data dari admin
  if (path === '/api/data' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      store = body;
      return json(res, { ok: true });
    } catch(e) {
      return json(res, { ok: false, error: e.message }, 400);
    }
  }

  // POST /api/laporan — kirim laporan dari web utama
  if (path === '/api/laporan' && req.method === 'POST') {
    try {
      const lap = await parseBody(req);
      lap.id = 'LAP-' + Date.now();
      lap.waktu = new Date().toISOString();
      lap.status = 'baru';
      if (!store.laporan) store.laporan = [];
      store.laporan.unshift(lap);
      return json(res, { ok: true, id: lap.id });
    } catch(e) {
      return json(res, { ok: false, error: e.message }, 400);
    }
  }

  // Health check
  if (path === '/' || path === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Nurul Hasanah Backend OK');
    return;
  }

  res.writeHead(404); res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`✅ Backend Nurul Hasanah berjalan di port ${PORT}`);
});
