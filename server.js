/**
 * Backend Nurul Hasanah — Railway.app
 * Multi-grade auth + user management di database (file JSON)
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT      = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Seed users awal
const DEFAULT_USERS = [
  { id:'USR001', nama:'Drs. Ahmad Fauzi, M.Pd',  nip:'196501011990031001', grade:1, password:'kepsek123',     aktif:true },
  { id:'USR002', nama:'Budi Santoso, S.Kom',      nip:'197203152000121002', grade:2, password:'superadmin123', aktif:true },
  { id:'USR003', nama:'Siti Aminah, S.Pd.I',      nip:'198506202010012003', grade:3, password:'guruntu123',    aktif:true },
  { id:'USR004', nama:'Ustdzh. Fatimah Az-Zahra', nip:'199012102015042004', grade:4, password:'guruummi123',   aktif:true },
  { id:'USR005', nama:'Muhamad Rizki, S.Pd',      nip:'199505052020011005', grade:5, password:'gurubiasa123',  aktif:true },
];

const DEFAULT_DATA = {
  pengumuman: [
    { id:1, judul:'PPDB 2025/2026 Resmi Dibuka',         kategori:'📢 Pengumuman', tanggal:'2025-12-01', status:'Aktif', isi:'Pendaftaran dibuka mulai 1 Desember 2025.' },
    { id:2, judul:'Maulid Nabi SAW Berlangsung Khidmat',  kategori:'🎓 Kegiatan',   tanggal:'2025-11-20', status:'Aktif', isi:'Acara berlangsung khidmat dan penuh hikmah.' },
    { id:3, judul:'Jadwal Ujian Akhir Semester Ganjil',   kategori:'📚 Akademik',   tanggal:'2025-11-10', status:'Aktif', isi:'Ujian dilaksanakan 15-20 Desember 2025.' },
  ],
  galeri:[], maintenance:false,
  maintConfig:{ msgId:'Website sedang dalam pemeliharaan.', msgEn:'Under maintenance.', eta:'2 jam lagi', contact:'+62 812-3456-7890' },
  konten:{
    tagline:'Mendidik Generasi Qurani, Berakhlak Mulia, dan Berprestasi — sejak 1999.',
    quote:'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ', badge:'✦ Sekolah Model Ummi ✦',
    tahun:'25+', alumni:'1200+', guru:'50+', lulus:'98%', berdiri:'1999',
    deskripsi:'Madrasah Nurul Hasanah berdiri sejak 1999.',
    deskripsi2:'Ribuan alumni telah berkiprah membawa nilai-nilai Islam.',
    visi:'"Menjadi Madrasah Unggulan yang Melahirkan Generasi Islami, Berprestasi, dan Berakhlak Mulia di Tingkat Nasional"',
    misi1:"Menyelenggarakan pembelajaran Al-Qur'an dan Sunnah secara konsisten",
    misi2:'Mengembangkan kemampuan akademik siswa secara optimal',
    misi3:'Membentuk karakter Islami dalam seluruh aspek kehidupan',
    misi4:'Menjalin kemitraan dengan orang tua dan masyarakat',
    alamat:'Jl. Nurul Hasanah No. 1, Kecamatan Contoh, Kabupaten Contoh 12345',
    telp:'(021) 1234-5678', wa:'+62 812-3456-7890',
    jam:'Senin–Jumat: 07.00–16.00 WIB', jamSabtu:'Sabtu: 07.00–12.00 WIB'
  },
  laporan:[], ppdb:[], visitors:[], users:DEFAULT_USERS, customHtml:null
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const merged = Object.assign({}, DEFAULT_DATA, JSON.parse(fs.readFileSync(DATA_FILE,'utf8')));
      if (!merged.users || !merged.users.length) merged.users = DEFAULT_USERS;
      return merged;
    }
  } catch(e) { console.error('Load error:', e.message); }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data,null,2),'utf8'); return true; }
  catch(e) { console.error('Save error:', e.message); return false; }
}

let store = loadData();
console.log('Users loaded:', store.users.length);
setInterval(() => saveData(store), 60000);

function parseBody(req) {
  return new Promise((resolve,reject) => {
    let b='';
    req.on('data',c=>{ b+=c; if(b.length>5e6) req.destroy(); });
    req.on('end',()=>{ try{resolve(JSON.parse(b));}catch(e){reject(e);} });
    req.on('error',reject);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}

function json(res,data,status=200) {
  cors(res);
  res.writeHead(status,{'Content-Type':'application/json'});
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req,res) => {
  const url=new URL(req.url,'http://localhost');
  const p=url.pathname, meth=req.method;

  if (meth==='OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // POST /api/login
  if (p==='/api/login' && meth==='POST') {
    try {
      const {nip,password} = await parseBody(req);
      const user = (store.users||[]).find(u=>u.nip===nip && u.aktif!==false);
      if (!user)                    return json(res,{ok:false,error:'NIP/NUPTK tidak ditemukan atau nonaktif'},401);
      if (user.password!==password) return json(res,{ok:false,error:'Password salah'},401);
      const {password:_,...safe}=user;
      return json(res,{ok:true,user:safe});
    } catch(e) { return json(res,{ok:false,error:e.message},400); }
  }

  // GET /api/users
  if (p==='/api/users' && meth==='GET') {
    return json(res,(store.users||[]).map(({password,...u})=>u));
  }

  // POST /api/users (tambah)
  if (p==='/api/users' && meth==='POST') {
    try {
      const {nama,nip,grade,password} = await parseBody(req);
      if (!nama||!nip||!grade||!password) return json(res,{ok:false,error:'Semua field wajib diisi'},400);
      if (!store.users) store.users=[];
      if (store.users.find(u=>u.nip===nip)) return json(res,{ok:false,error:'NIP/NUPTK sudah terdaftar'},409);
      const u={id:'USR'+Date.now(),nama,nip,grade:parseInt(grade),password,aktif:true};
      store.users.push(u);
      saveData(store);
      const {password:_,...safe}=u;
      return json(res,{ok:true,user:safe});
    } catch(e) { return json(res,{ok:false,error:e.message},400); }
  }

  // DELETE /api/users/:id
  if (p.startsWith('/api/users/') && !p.includes('/toggle') && meth==='DELETE') {
    const id=p.split('/')[3];
    const u=(store.users||[]).find(x=>x.id===id);
    if (!u)          return json(res,{ok:false,error:'User tidak ditemukan'},404);
    if (u.grade===1) return json(res,{ok:false,error:'Kepala Sekolah tidak bisa dihapus'},403);
    store.users=store.users.filter(x=>x.id!==id);
    saveData(store);
    return json(res,{ok:true});
  }

  // POST /api/users/:id/toggle
  if (p.match(/^\/api\/users\/[^/]+\/toggle$/) && meth==='POST') {
    const id=p.split('/')[3];
    const u=(store.users||[]).find(x=>x.id===id);
    if (!u)          return json(res,{ok:false,error:'User tidak ditemukan'},404);
    if (u.grade===1) return json(res,{ok:false,error:'Status Kepala Sekolah tidak bisa diubah'},403);
    try {
      const {aktif}=await parseBody(req);
      u.aktif=aktif; saveData(store);
      return json(res,{ok:true,aktif:u.aktif});
    } catch(e) { return json(res,{ok:false,error:e.message},400); }
  }

  // GET /api/data
  if (p==='/api/data' && meth==='GET') {
    const {users,...pub}=store; return json(res,pub);
  }

  // POST /api/data
  if (p==='/api/data' && meth==='POST') {
    try {
      const {users,...body}=await parseBody(req);
      store=Object.assign({},store,body); saveData(store);
      return json(res,{ok:true});
    } catch(e) { return json(res,{ok:false,error:e.message},400); }
  }

  // POST /api/laporan
  if (p==='/api/laporan' && meth==='POST') {
    try {
      const lap=await parseBody(req);
      lap.id='LAP-'+Date.now(); lap.waktu=new Date().toISOString(); lap.status='baru';
      if(!store.laporan) store.laporan=[];
      store.laporan.unshift(lap); saveData(store);
      return json(res,{ok:true,id:lap.id});
    } catch(e) { return json(res,{ok:false,error:e.message},400); }
  }

  // POST /api/ppdb
  if (p==='/api/ppdb' && meth==='POST') {
    try {
      const data=await parseBody(req);
      data.id='PPDB-'+Date.now(); data.waktu=new Date().toISOString(); data.status='baru';
      if(!store.ppdb) store.ppdb=[];
      store.ppdb.unshift(data); saveData(store);
      return json(res,{ok:true,id:data.id,noReg:data.id});
    } catch(e) { return json(res,{ok:false,error:e.message},400); }
  }

  // POST /api/visitor
  if (p==='/api/visitor' && meth==='POST') {
    try {
      const v=await parseBody(req);
      v.waktu=new Date().toISOString();
      if(!store.visitors) store.visitors=[];
      store.visitors.push(v);
      if(store.visitors.length>1000) store.visitors=store.visitors.slice(-1000);
      saveData(store); return json(res,{ok:true});
    } catch(e) { return json(res,{ok:false},400); }
  }

  // GET /api/stats
  if (p==='/api/stats' && meth==='GET') {
    const vs=store.visitors||[], now=new Date();
    const today=now.toDateString(), week=now-7*864e5, month=now-30*864e5;
    const pages={}, byDay={};
    vs.forEach(v=>{ pages[v.page]=(pages[v.page]||0)+1; });
    vs.filter(v=>new Date(v.waktu)>week).forEach(v=>{
      const d=new Date(v.waktu).toLocaleDateString('id-ID',{weekday:'short'});
      byDay[d]=(byDay[d]||0)+1;
    });
    return json(res,{
      total:vs.length,
      today:vs.filter(v=>new Date(v.waktu).toDateString()===today).length,
      week:vs.filter(v=>new Date(v.waktu)>week).length,
      month:vs.filter(v=>new Date(v.waktu)>month).length,
      pages, byDay
    });
  }

  if (p==='/'||p==='/health') {
    cors(res); res.writeHead(200,{'Content-Type':'text/plain'});
    res.end('Nurul Hasanah Backend OK'); return;
  }

  res.writeHead(404); res.end('Not Found');
});

server.listen(PORT,()=>{
  console.log('Backend OK port',PORT,'| Users:',store.users.length);
});
