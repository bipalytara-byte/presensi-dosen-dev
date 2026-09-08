/* flex.js — Flex Class: blok waktu mingguan
   Kelas flex tidak punya jam tetap. Tiap minggu dosen menetapkan
   sendiri satu blok waktu, paling lambat H-1.

   Fungsi: renderFlex, simpanBlokFlex, hapusBlokFlex, editBlokFlex,
           mingguBerjalan, blokUntukHariIni, renderNotifFlexBeranda,
           renderRekapFlexAdmin
*/

var MODA_SUMBU_A = ['Tatap Muka Terjadwal','Hybrid Sinkronus',
                    'Blended Terstruktur','Kompensasi Asinkronus'];
var METODE_SUMBU_B = ['Flipped Classroom','Problem-Based Learning',
                      'Project-Based Learning','Case-Based Teaching'];
var MODA_UJIAN = ['Ujian Sinkronus (diawasi)',
                  'Ujian Asinkronus (take-home / project)'];
var MAKS_KOMPENSASI = 5;

var _editBlokId = null;

// Minggu ke berapa hari ini, dihitung dari tanggal mulai kuliah.
function mingguBerjalan(tanggal) {
  if (!TGL_MULAI_KULIAH) return 0;
  var mulai = new Date(TGL_MULAI_KULIAH + 'T00:00:00');
  if (isNaN(mulai)) return 0;
  var d = tanggal ? new Date(tanggal + 'T00:00:00') : new Date();
  d.setHours(0,0,0,0);
  var selisih = Math.floor((d - mulai) / 86400000);
  if (selisih < 0) return 0;
  return Math.floor(selisih / 7) + 1;
}

// Minggu ini minggu ujian atau bukan — untuk jadwal tertentu.
// Paralel tidak punya UTS: minggu UTS/UAS-nya adalah UAS batch itu.
function mingguLiburList() {
  return String(MINGGU_LIBUR || '').split(/[,;\s]+/)
    .map(function(x){ return parseInt(x,10); }).filter(function(x){ return x > 0; });
}

function jenisMinggu(jad, minggu) {
  if (!minggu) return 'Tatap Muka';
  if (jad && jad.tipe === 'paralel') {
    return (minggu === MINGGU_UTS || minggu === MINGGU_UAS) ? 'UAS' : 'Tatap Muka';
  }
  if (minggu === MINGGU_UTS) return 'UTS';
  if (minggu === MINGGU_UAS) return 'UAS';
  return 'Tatap Muka';
}

// Blok flex yang berlaku hari ini untuk sebuah jadwal — dipakai hadir.js
function blokUntukHariIni(jadwalId) {
  var d = new Date();
  var ymd = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
          + '-' + String(d.getDate()).padStart(2,'0');
  return FLEX_BLOK.find(function(b){
    return b.jadwalId === jadwalId && b.tanggal === ymd && b.status !== 'batal';
  }) || null;
}

function jadwalFlexSaya() {
  if (!currentUser) return [];   // admin memakai renderFlexAdmin()
  return J.filter(function(j){
    return j.polaJadwal === 'flex' && j.dosenId === currentUser.id;
  });
}


// =====================================================
// [V12.1] STATUS PELAKSANAAN BLOK
// Mencocokkan blok dengan data presensi, supaya kartu Flex Class
// menunjukkan bukan hanya rencana, tetapi juga realisasinya.
// =====================================================
function _ymdKeId(ymd) {
  var p = String(ymd || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
}

function presensiBlok(b) {
  var tglId = _ymdKeId(b.tanggal);
  return P.find(function(p){
    return p.jadwalId === b.jadwalId && p.tanggal === tglId;
  }) || null;
}

// Kembalikan { label, warna, bg, detail } untuk sebuah blok.
function statusBlok(b) {
  var p = presensiBlok(b);
  var hariIni = new Date(); hariIni.setHours(0,0,0,0);
  var tglBlok = new Date(b.tanggal + 'T00:00:00');

  if (!p) {
    if (tglBlok > hariIni) return { label:'Terjadwal', warna:'#185fa5', bg:'#e6f1fb', detail:'' };
    if (tglBlok.getTime() === hariIni.getTime())
      return { label:'Belum direkam', warna:'#633806', bg:'#faeeda', detail:'hari ini' };
    return { label:'Tidak direkam', warna:'#791f1f', bg:'#fcebeb', detail:'sudah lewat' };
  }
  if (!p.waktuSelesai) {
    return { label:'Sedang berjalan', warna:'#633806', bg:'#faeeda',
             detail:'mulai ' + p.waktuHadir + ' · ' + (p.status || '') + ' — belum rekam selesai' };
  }
  var otomatis = String(p.statusSelesai || '').indexOf('otomatis') > -1;
  return { label: otomatis ? 'Terlaksana (tutup otomatis)' : 'Terlaksana',
           warna: otomatis ? '#633806' : '#27500a',
           bg:    otomatis ? '#faeeda' : '#eaf3de',
           detail:p.waktuHadir + '–' + p.waktuSelesai + ' · ' + (p.status || '')
                  + (p.statusSelesai ? ' · ' + p.statusSelesai : '') };
}

function _lencana(s) {
  return '<span style="display:inline-block;background:' + s.bg + ';color:' + s.warna
    + ';border-radius:20px;padding:2px 9px;font-size:10px;font-weight:700;white-space:nowrap">'
    + s.label + '</span>';
}

// =====================================================
// HALAMAN FLEX CLASS (dosen)
// =====================================================
function renderFlex() {
  var el = document.getElementById('flex-list');
  if (!el) return;
  if (isAdmin) return renderFlexAdmin(el);

  if (!TGL_MULAI_KULIAH) {
    el.innerHTML = '<div class="card"><p class="empty">🗓️ Kalender akademik belum diisi admin.'
      + '<br>Flex Class belum bisa dipakai. Hubungi WK I / Ka BAAK.</p></div>';
    return;
  }

  var jadwal = jadwalFlexSaya();
  if (!jadwal.length) {
    el.innerHTML = '<div class="card"><p class="empty">Anda tidak punya kelas Flex Class semester ini.</p></div>';
    return;
  }

  var mb = mingguBerjalan();
  var mulai = new Date(TGL_MULAI_KULIAH + 'T00:00:00');
  var tglMulai = mulai.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  var info = mb < 1
    ? '📌 Perkuliahan dimulai <b>' + tglMulai + '</b> (minggu 1). '
      + 'Anda sudah bisa menetapkan blok untuk minggu-minggu ke depan.'
    : '📌 Sekarang <b>minggu ke-' + mb + '</b>. Blok waktu ditetapkan paling lambat <b>H-1</b>. '
      + 'Selama belum lewat, Anda bisa mengubah atau membatalkannya sendiri.';
  el.innerHTML = '<div style="background:#e6f1fb;color:#185fa5;border-radius:10px;padding:10px 14px;'
      + 'font-size:12px;margin-bottom:14px;line-height:1.6">' + info + '</div>'
    + jadwal.map(kartuJadwalFlex).join('');
}

function kartuJadwalFlex(j) {
  var blok = FLEX_BLOK.filter(function(b){ return b.jadwalId === j.id && b.status !== 'batal'; })
                      .sort(function(a,b){ return a.minggu - b.minggu; });
  var kompensasi = blok.filter(function(b){ return b.modaSumbuA === 'Kompensasi Asinkronus'; }).length;
  var mb = mingguBerjalan();
  var hariIni = new Date(); hariIni.setHours(0,0,0,0);

  var daftar = blok.length ? blok.map(function(b){
    var lewat = new Date(b.tanggal + 'T00:00:00') < hariIni;
    var st = statusBlok(b);
    var stA = statusBlok(b);
    var isUjian = MODA_UJIAN.indexOf(b.modaSumbuA) > -1;
    var warna = isUjian ? '#e6f1fb' : b.modaSumbuA === 'Kompensasi Asinkronus' ? '#faeeda' : '#eaf3de';
    var tx    = isUjian ? '#185fa5' : b.modaSumbuA === 'Kompensasi Asinkronus' ? '#633806' : '#27500a';
    return '<div style="background:'+warna+';border-radius:8px;padding:8px 10px;margin-bottom:6px">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
        + '<div style="min-width:0">'
          + '<div style="font-size:12px;font-weight:700;color:'+tx+'">'
            + (isUjian ? '📝 ' : '') + 'Minggu ' + b.minggu
            + ' · ' + b.tanggal + ' · ' + b.jamMulai + '–' + b.jamSelesai + '</div>'
          + '<div style="font-size:11px;color:#555;margin-top:2px">' + b.modaSumbuA + ' · ' + b.metodeSumbuB + '</div>'
          + '<div style="margin-top:5px">' + _lencana(st)
            + (st.detail ? '<span style="font-size:10px;color:#555;margin-left:6px">' + st.detail + '</span>' : '')
          + '</div>'
          + (b.direvisiOleh ? '<div style="font-size:10px;color:#a32d2d;margin-top:2px">✏️ Direvisi ' + b.direvisiOleh + ' · ' + b.direvisiPada + '</div>' : '')
        + '</div>'
        + (lewat
          ? '<span style="font-size:10px;color:#888;flex-shrink:0">terkunci</span>'
          : '<div style="display:flex;gap:4px;flex-shrink:0">'
            + '<button class="btn btn-sm" style="font-size:10px" onclick="editBlokFlex(\'' + b.id + '\')">Ubah</button>'
            + '<button class="btn btn-danger btn-sm" style="font-size:10px" onclick="hapusBlokFlex(\'' + b.id + '\')">Batal</button>'
          + '</div>')
      + '</div></div>';
  }).join('') : '<p class="empty" style="font-size:12px">Belum ada blok yang ditetapkan.</p>';

  var liburW = mingguLiburList();
  var tertinggal = [];
  for (var w = 1; w <= Math.min(mb, 16); w++) {
    if (liburW.indexOf(w) > -1) continue;
    if (!blok.some(function(b){ return b.minggu === w; })) tertinggal.push(w);
  }

  return '<div class="card" style="margin-bottom:14px">'
    + '<div style="font-size:14px;font-weight:700;color:#1a1a1a">' + j.mk + '</div>'
    + '<div style="font-size:11px;color:#888;margin-bottom:10px">'
      + (j.kelas ? 'Kelas ' + j.kelas + ' · ' : '') + 'Target ' + j.maxPertemuan + ' pertemuan · '
      + 'Ditetapkan ' + blok.length + ' · Terlaksana '
      + blok.filter(function(x){ return statusBlok(x).label.indexOf('Terlaksana') === 0; }).length + '</div>'

    + (tertinggal.length
      ? '<div style="background:#fcebeb;color:#791f1f;border-radius:8px;padding:7px 10px;font-size:11px;margin-bottom:10px">'
        + '⚠️ Minggu belum ditetapkan: ' + tertinggal.join(', ') + '</div>' : '')

    + '<div style="background:#f8f8f7;border-radius:8px;padding:7px 10px;font-size:11px;color:#555;margin-bottom:10px">'
      + 'Kompensasi Asinkronus: <b>' + kompensasi + '</b> dari maksimal <b>' + MAKS_KOMPENSASI + '</b>'
      + (kompensasi >= MAKS_KOMPENSASI ? ' — sudah penuh' : '') + '</div>'

    + daftar
    + '<button class="btn btn-primary btn-sm" style="font-size:12px;margin-top:8px" '
      + 'onclick="bukaFormBlok(\'' + j.id + '\')">➕ Tetapkan Blok Minggu Ini</button>'
  + '</div>';
}

// =====================================================
// FORM TETAPKAN / UBAH BLOK
// =====================================================
function bukaFormBlok(jadwalId, blokId) {
  _editBlokId = blokId || null;
  var b = blokId ? FLEX_BLOK.find(function(x){ return x.id === blokId; }) : null;

  // Default tanggal: besok (aturan H-1)
  var besok = new Date(); besok.setDate(besok.getDate() + 1);
  var def = besok.getFullYear() + '-' + String(besok.getMonth()+1).padStart(2,'0')
          + '-' + String(besok.getDate()).padStart(2,'0');

  document.getElementById('fb-jadwal').value  = jadwalId;

  // Tunjukkan blok ini milik mata kuliah yang mana — dosen bisa punya
  // beberapa kelas flex, dan modal tanpa konteks bikin salah ubah.
  var jad = J.find(function(x){ return x.id === jadwalId; });
  var elMk = document.getElementById('fb-mk');
  var elMeta = document.getElementById('fb-meta');
  if (elMk) elMk.textContent = jad ? jad.mk : '—';
  if (elMeta && jad) {
    var dipakai = FLEX_BLOK.filter(function(x){ return x.jadwalId === jadwalId && x.status !== 'batal'; });
    var komp = dipakai.filter(function(x){ return x.modaSumbuA === 'Kompensasi Asinkronus'; }).length;
    elMeta.textContent = (jad.kelas ? 'Kelas ' + jad.kelas + ' · ' : '')
      + dipakai.length + ' dari ' + jad.maxPertemuan + ' blok ditetapkan'
      + ' · Kompensasi asinkronus ' + komp + '/' + MAKS_KOMPENSASI;
  }
  document.getElementById('fb-tanggal').value = b ? b.tanggal : def;
  document.getElementById('fb-mulai').value   = b ? b.jamMulai : '';
  document.getElementById('fb-selesai').value = b ? b.jamSelesai : '';
  document.getElementById('fb-moda').value    = b ? b.modaSumbuA : MODA_SUMBU_A[0];
  document.getElementById('fb-metode').value  = b ? b.metodeSumbuB : METODE_SUMBU_B[0];
  document.getElementById('fb-title').textContent = b ? 'Ubah Blok Waktu' : 'Tetapkan Blok Waktu';
  hitungMingguForm();
  document.getElementById('modal-flex').classList.add('open');
}

function editBlokFlex(id) {
  var b = FLEX_BLOK.find(function(x){ return x.id === id; });
  if (b) bukaFormBlok(b.jadwalId, id);
}

// Tampilkan minggu ke berapa tanggal yang dipilih
function hitungMingguForm() {
  var tgl = document.getElementById('fb-tanggal').value;
  var info = document.getElementById('fb-info');
  if (!info) return;
  var w = mingguBerjalan(tgl);
  if (!w) {
    var m = TGL_MULAI_KULIAH
      ? new Date(TGL_MULAI_KULIAH + 'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})
      : '(belum diset)';
    info.innerHTML = '⚠️ Tanggal ini sebelum perkuliahan dimulai (' + m + ').';
    info.style.color = '#a32d2d';
    return;
  }
  var jad   = J.find(function(x){ return x.id === document.getElementById('fb-jadwal').value; });
  var jenis = jenisMinggu(jad, w);
  var ujian = jenis !== 'Tatap Muka';

  if (mingguLiburList().indexOf(w) > -1) {
    info.innerHTML = '🚫 Minggu ke-' + w + ' ditandai <b>libur</b> — tidak ada perkuliahan. Pilih tanggal lain.';
    info.style.color = '#a32d2d';
    return;
  }
  info.innerHTML = ujian
    ? '📝 Minggu ke-' + w + ' — <b>minggu ' + jenis + '</b>. Yang direkam adalah pelaksanaan ujian, bukan perkuliahan.'
    : '📌 Minggu ke-' + w;
  info.style.color = ujian ? '#633806' : '#185fa5';

  // Minggu ujian punya pilihan moda sendiri.
  var sel = document.getElementById('fb-moda');
  if (sel) {
    var lama = sel.value;
    var opsi = ujian ? MODA_UJIAN : MODA_SUMBU_A;
    sel.innerHTML = opsi.map(function(o){ return '<option>' + o + '</option>'; }).join('');
    if (opsi.indexOf(lama) > -1) sel.value = lama;
  }
  var hintKomp = document.getElementById('fb-hint-komp');
  if (hintKomp) {
    hintKomp.textContent = ujian
      ? 'Ujian asinkronus (take-home / project) tidak memakai kuota kompensasi.'
      : 'Kompensasi Asinkronus maksimal 5x per mata kuliah.';
  }
}

async function simpanBlokFlex() {
  var data = {
    id:           _editBlokId || '',
    jadwalId:     document.getElementById('fb-jadwal').value,
    tanggal:      document.getElementById('fb-tanggal').value,
    jamMulai:     document.getElementById('fb-mulai').value,
    jamSelesai:   document.getElementById('fb-selesai').value,
    modaSumbuA:   document.getElementById('fb-moda').value,
    metodeSumbuB: document.getElementById('fb-metode').value,
    olehAdmin:    isAdmin === true,
    direvisiOleh: isAdmin ? 'Admin / WK I' : ''
  };
  if (!data.tanggal || !data.jamMulai || !data.jamSelesai) {
    alert('Tanggal, jam mulai, dan jam selesai wajib diisi.'); return;
  }

  var btn = document.getElementById('btn-simpan-blok');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  setSB('sy');
  try {
    var r = await post({ action:'saveFlexBlok', data:data });
    if (!r.success) { setSB('er'); alert('❌ ' + r.error); }
    else {
      // Admin tidak punya currentUser — ambil semua blok, bukan milik satu dosen.
      var q = { action:'getFlexBlok' };
      if (currentUser) q.dosenId = currentUser.id;
      FLEX_BLOK = (await get(q)).data || [];
      setSB('ok');
      cm('modal-flex');
      renderFlex();
      alert('✅ Blok minggu ke-' + r.minggu + ' ' + (r.revisi ? 'diperbarui' : 'ditetapkan') + '.');
    }
  } catch(e) { setSB('er'); alert('Gagal: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Simpan';
}

async function hapusBlokFlex(id) {
  var b = FLEX_BLOK.find(function(x){ return x.id === id; });
  if (!b) return;
  if (!confirm('Batalkan blok minggu ke-' + b.minggu + ' (' + b.tanggal + ')?\n\n'
    + 'Anda bisa menetapkan ulang selama belum lewat waktunya.')) return;
  setSB('sy');
  try {
    var r = await post({ action:'deleteFlexBlok', id:id, olehAdmin: isAdmin });
    if (!r.success) { setSB('er'); alert('❌ ' + r.error); return; }
    FLEX_BLOK = FLEX_BLOK.filter(function(x){ return x.id !== id; });
    setSB('ok');
    renderFlex();
  } catch(e) { setSB('er'); alert('Gagal: ' + e.message); }
}

// =====================================================
// BANNER PENGINGAT DI BERANDA (dosen)
// Muncul hanya kalau benar-benar tertinggal, supaya tidak
// jadi banner yang selalu ada dan akhirnya diabaikan.
// =====================================================
function renderNotifFlexBeranda() {
  var el = document.getElementById('notif-flex-beranda');
  if (!el || !currentUser || isAdmin) return;
  if (!TGL_MULAI_KULIAH) { el.style.display = 'none'; return; }

  var mb = mingguBerjalan();
  if (mb < 1) { el.style.display = 'none'; return; }

  var perlu = jadwalFlexSaya().map(function(j){
    var blok = FLEX_BLOK.filter(function(b){ return b.jadwalId === j.id && b.status !== 'batal'; });
    var libur = mingguLiburList();
    var belum = [];
    for (var w = 1; w <= Math.min(mb, 16); w++) {
      if (libur.indexOf(w) > -1) continue;
      if (!blok.some(function(b){ return b.minggu === w; })) belum.push(w);
    }
    return { j:j, belum:belum };
  }).filter(function(x){ return x.belum.length > 0; });

  if (!perlu.length) { el.style.display = 'none'; return; }

  el.innerHTML = perlu.map(function(x){
    return '<div class="libur-banner libur-banner-h2">'
      + '<div class="libur-banner-title">🔀 Flex Class — Blok Belum Ditetapkan</div>'
      + '<div class="libur-banner-sub"><b>' + x.j.mk + '</b>'
        + (x.j.kelas ? ' · Kelas ' + x.j.kelas : '')
        + ' belum punya blok waktu untuk minggu: <b>' + x.belum.join(', ') + '</b>.</div>'
      + '<button class="libur-cta" onclick="pg(\'flex\', document.getElementById(\'tab-flex\'))">🔀 Tetapkan Sekarang</button>'
    + '</div>';
  }).join('');
  el.style.display = 'block';
}

// =====================================================
// PANEL REKAP UNTUK WK I / KA BAAK
// =====================================================
async function renderRekapFlexAdmin() {
  var el = document.getElementById('rekap-flex-admin');
  if (!el || !isAdmin) return;
  el.innerHTML = '<p class="empty">Memuat rekap…</p>';
  try {
    var r = await get({ action:'rekapFlex' });
    if (!r.success) { el.innerHTML = '<p class="empty">' + r.error + '</p>'; return; }
    if (!r.data.length) { el.innerHTML = '<p class="empty">Belum ada kelas Flex Class.</p>'; return; }

    el.innerHTML = '<div style="font-size:12px;color:#888;margin-bottom:10px">'
        + 'Minggu berjalan: <b>' + r.mingguBerjalan + '</b></div>'
      + r.data.map(function(d){
        var parah = d.tertinggal >= 3;
        var bg = d.tertinggal === 0 ? '#eaf3de' : parah ? '#fcebeb' : '#faeeda';
        var tx = d.tertinggal === 0 ? '#27500a' : parah ? '#791f1f' : '#633806';
        return '<div style="background:'+bg+';border-radius:8px;padding:9px 12px;margin-bottom:6px">'
          + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">'
            + '<div style="min-width:0">'
              + '<div style="font-size:12px;font-weight:700;color:#1a1a1a">' + d.dosen + '</div>'
              + '<div style="font-size:11px;color:#555">' + d.mk + (d.kelas ? ' · ' + d.kelas : '') + '</div>'
            + '</div>'
            + '<div style="font-size:11px;color:'+tx+';font-weight:600;text-align:right">'
              + d.ditetapkan + '/' + d.target + ' blok'
              + (d.tertinggal ? '<br>tertinggal ' + d.tertinggal + ' minggu' : '<br>tepat waktu')
            + '</div>'
          + '</div>'
          + (d.mingguBelum.length
            ? '<div style="font-size:10px;color:'+tx+';margin-top:4px">Minggu belum diisi: ' + d.mingguBelum.join(', ') + '</div>' : '')
          + (d.kompensasi >= d.maksKompensasi
            ? '<div style="font-size:10px;color:#791f1f;margin-top:4px">⚠️ Kompensasi asinkronus sudah penuh ('
              + d.kompensasi + '/' + d.maksKompensasi + ')</div>' : '')
        + '</div>';
      }).join('');
  } catch(e) {
    el.innerHTML = '<p class="empty">Gagal memuat: ' + e.message + '</p>';
  }
}


// =====================================================
// TAMPILAN ADMIN (WK I / Ka BAAK)
// Semua kelas flex, semua dosen. Admin boleh mengubah atau
// menghapus blok yang sudah terkunci — tercatat sebagai revisi.
// =====================================================
function renderFlexAdmin(el) {
  if (!TGL_MULAI_KULIAH) {
    el.innerHTML = '<div class="card"><p class="empty">🗓️ Kalender akademik belum diisi.<br>'
      + 'Isi dulu di Pengaturan → Kalender Akademik.</p></div>';
    return;
  }

  var semua = J.filter(function(j){ return j.polaJadwal === 'flex'; });
  if (!semua.length) {
    el.innerHTML = '<div class="card"><p class="empty">Belum ada kelas Flex Class semester ini.</p></div>';
    return;
  }

  var filterEl = document.getElementById('flex-filter-dosen');
  var pilih = filterEl ? filterEl.value : 'all';
  var dosenIds = [];
  semua.forEach(function(j){ if (dosenIds.indexOf(j.dosenId) === -1) dosenIds.push(j.dosenId); });

  var opsi = '<option value="all">Semua dosen (' + dosenIds.length + ')</option>'
    + dosenIds.map(function(id){
        var d = D.find(function(x){ return x.id === id; });
        var n = semua.filter(function(j){ return j.dosenId === id; }).length;
        return '<option value="'+id+'"'+(pilih===id?' selected':'')+'>'
             + (d ? d.nama : id) + ' (' + n + ')</option>';
      }).join('');

  var tampil = pilih === 'all' ? semua : semua.filter(function(j){ return j.dosenId === pilih; });
  var mb = mingguBerjalan();
  var fsEl = document.getElementById('flex-filter-status');
  var fStatus = fsEl ? fsEl.value : 'all';

  el.innerHTML = '<div class="card" style="margin-bottom:14px">'
      + '<label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:5px">Filter dosen</label>'
      + '<select id="flex-filter-dosen" onchange="renderFlex()" '
      + 'style="width:100%;border:1px solid #ddd;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;margin-bottom:10px">'
      + opsi + '</select>'
      + '<label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:5px">Filter status pelaksanaan</label>'
      + '<select id="flex-filter-status" onchange="renderFlex()" '
      + 'style="width:100%;border:1px solid #ddd;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit">'
      + ['all','Terlaksana','Terlaksana (tutup otomatis)','Sedang berjalan','Belum direkam','Tidak direkam','Terjadwal'].map(function(s){
          return '<option value="'+s+'"'+(fStatus===s?' selected':'')+'>'
               + (s==='all'?'Semua status':s) + '</option>'; }).join('')
      + '</select>'
      + '<div style="font-size:11px;color:#888;margin-top:8px">'
        + 'Minggu berjalan: <b>' + mb + '</b> · ' + tampil.length + ' kelas ditampilkan. '
        + 'Sebagai admin, Anda bisa mengubah blok yang sudah terkunci — perubahan tercatat.</div>'
    + '</div>'
    + tampil.map(function(j){ return kartuFlexAdmin(j, fStatus); }).join('');
}

function kartuFlexAdmin(j, fStatus) {
  var dosen = D.find(function(x){ return x.id === j.dosenId; });
  var blok = FLEX_BLOK.filter(function(b){ return b.jadwalId === j.id && b.status !== 'batal'; })
                      .sort(function(a,b){ return a.minggu - b.minggu; });
  var komp = blok.filter(function(b){ return b.modaSumbuA === 'Kompensasi Asinkronus'; }).length;
  var blokTampil = (!fStatus || fStatus === 'all')
    ? blok : blok.filter(function(b){ return statusBlok(b).label === fStatus; });
  var terlaksana = blok.filter(function(b){ return statusBlok(b).label.indexOf('Terlaksana') === 0; }).length;
  var alpa       = blok.filter(function(b){ return statusBlok(b).label === 'Tidak direkam'; }).length;
  var mb = mingguBerjalan();
  var hariIni = new Date(); hariIni.setHours(0,0,0,0);

  var belum = [];
  for (var w = 1; w <= Math.min(mb, 16); w++) {
    if (!blok.some(function(b){ return b.minggu === w; })) belum.push(w);
  }

  var daftar = blok.length ? blok.map(function(b){
    var lewat = new Date(b.tanggal + 'T00:00:00') < hariIni;
    var warna = b.modaSumbuA === 'Kompensasi Asinkronus' ? '#faeeda' : '#eaf3de';
    var tx    = b.modaSumbuA === 'Kompensasi Asinkronus' ? '#633806' : '#27500a';
    return '<div style="background:'+warna+';border-radius:8px;padding:8px 10px;margin-bottom:6px">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">'
        + '<div style="min-width:0">'
          + '<div style="font-size:12px;font-weight:700;color:'+tx+'">Minggu ' + b.minggu
            + ' · ' + b.tanggal + ' · ' + b.jamMulai + '–' + b.jamSelesai
            + (lewat ? ' <span style="font-size:10px;color:#888;font-weight:400">(terkunci)</span>' : '') + '</div>'
          + '<div style="font-size:11px;color:#555;margin-top:2px">' + b.modaSumbuA + ' · ' + b.metodeSumbuB + '</div>'
          + '<div style="margin-top:5px">' + _lencana(stA)
            + (stA.detail ? '<span style="font-size:10px;color:#555;margin-left:6px">' + stA.detail + '</span>' : '')
          + '</div>'
          + (b.direvisiOleh ? '<div style="font-size:10px;color:#a32d2d;margin-top:2px">✏️ Direvisi ' + b.direvisiOleh + ' · ' + b.direvisiPada + '</div>' : '')
        + '</div>'
        + '<div style="display:flex;gap:4px;flex-shrink:0">'
          + '<button class="btn btn-sm" style="font-size:10px" onclick="editBlokFlex(\'' + b.id + '\')">Ubah</button>'
          + '<button class="btn btn-danger btn-sm" style="font-size:10px" onclick="hapusBlokFlex(\'' + b.id + '\')">Hapus</button>'
        + '</div>'
      + '</div></div>';
  }).join('') : '<p class="empty" style="font-size:12px">'
    + (blok.length ? 'Tidak ada blok dengan status tersebut.' : 'Belum ada blok ditetapkan.') + '</p>';

  return '<div class="card" style="margin-bottom:14px">'
    + '<div style="font-size:11px;color:#888">' + (dosen ? dosen.nama : j.dosenId) + '</div>'
    + '<div style="font-size:14px;font-weight:700;color:#1a1a1a">' + j.mk + '</div>'
    + '<div style="font-size:11px;color:#888;margin-bottom:10px">'
      + (j.kelas ? 'Kelas ' + j.kelas + ' · ' : '') + blok.length + ' dari ' + j.maxPertemuan + ' blok'
      + ' · Terlaksana ' + terlaksana
      + (alpa ? ' · <b style="color:#a32d2d">Tidak direkam ' + alpa + '</b>' : '')
      + ' · Kompensasi ' + komp + '/' + MAKS_KOMPENSASI + '</div>'
    + (belum.length
      ? '<div style="background:#fcebeb;color:#791f1f;border-radius:8px;padding:7px 10px;font-size:11px;margin-bottom:10px">'
        + '⚠️ Minggu belum ditetapkan: ' + belum.join(', ') + '</div>' : '')
    + daftar
    + '<button class="btn btn-sm" style="font-size:12px;margin-top:8px" '
      + 'onclick="bukaFormBlok(\'' + j.id + '\')">➕ Tambahkan Blok</button>'
  + '</div>';
}
