/* auth.js — Login, logout, session management
   Fungsi: showLogin, hideLogin, swapLogin, togglePass, doLogin,
           doAdminLogin, logout, loadForLogin, loadThenShow,
           updateUserUI, restoreSesi, showSelesai,
           showAppLoading, hideAppLoading, showLoadError,
           updateLoadStep, getWithTimeout, getWithRetry, retryLoad,
           resetPasswordDosen
*/


function showLogin(){document.getElementById('login-screen').classList.add('show');}
function hideLogin(){document.getElementById('login-screen').classList.remove('show');}

function swapLogin(v) {
  document.getElementById('login-err').textContent='';
  if(v === 'admin') {
    document.getElementById('login-dosen-view').style.display = 'none';
    document.getElementById('login-admin-view').style.display = 'block';
  } else {
    document.getElementById('login-dosen-view').style.display = 'block';
    document.getElementById('login-admin-view').style.display = 'none';
  }
}

async function loadForLogin(){
  try {
    var results = await Promise.all([
      get({action:'getDosen'}),
      get({action:'getSettings'})
    ]);
    D = results[0].data || [];
    var cfg = results[1].data || {};
    SISTEM_AKTIF     = cfg.liburAktif === true ? false : true;
    PESAN_LIBUR      = cfg.pesanLibur      || '';
    PENGUMUMAN_LOGIN = cfg.pengumumanLogin || '';
    OVERRIDE_CODE    = cfg.overrideCode    || '';
  } catch(e) {}
  showLogin();
}

function tampilkanPengumumanLogin() {
  var el = document.getElementById('papan-pengumuman-login');
  if (!el) return;
  var teks = PENGUMUMAN_LOGIN.trim();
  if (!teks) { el.style.display = 'none'; return; }
  el.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:10px">'
    + '<span style="font-size:20px;flex-shrink:0">📢</span>'
    + '<div style="flex:1">'
      + '<div style="font-size:12px;font-weight:700;color:#7a4f00;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Pengumuman</div>'
      + '<div style="font-size:13px;color:#7a4f00;line-height:1.6;white-space:pre-wrap">' + teks + '</div>'
    + '</div>'
    + '</div>';
  el.style.display = 'block';
}

function togglePass(){
  var i=document.getElementById('login-pass'),e=document.getElementById('pass-eye');
  if(i.type==='password'){i.type='text';e.textContent='🙈';}else{i.type='password';e.textContent='👁';}
}

async function doLogin(){
  var idEl   = document.getElementById('login-id');
  var passEl = document.getElementById('login-pass');
  var err    = document.getElementById('login-err');
  err.textContent = '';

  var id   = idEl.value.trim().toLowerCase();
  var pass = passEl.value.trim();

  if (!id)   { err.textContent = 'Masukkan ID dosen.'; return; }
  if (!pass) { err.textContent = 'Masukkan password.'; return; }

  var btn = document.getElementById('btn-login-dosen');
  btn.disabled = true;
  btn.textContent = 'Memeriksa...';

  try {
    var r = await get({ action: 'doLogin', id: id, pass: pass });
    if (!r.success) {
      err.textContent = '❌ ' + (r.error || 'Login gagal.');
      passEl.value = '';
      passEl.focus();
      return;
    }
    currentUser = r.data;
    isAdmin = false;
    sessionStorage.setItem('userRole', 'dosen');
    sessionStorage.setItem('current_user', JSON.stringify(r.data));
    hideLogin();
    loadThenShow();
  } catch(e) {
    err.textContent = '❌ Gagal terhubung ke server. Coba lagi.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk →';
  }
}

// Reset password dosen oleh admin
async function resetPasswordDosen(dosenId, namaDosen) {
  if (!isAdmin) { alert('Hanya admin yang dapat mereset password.'); return; }
  var pw = prompt('Reset password untuk:\n' + namaDosen + ' (' + dosenId + ')\n\nMasukkan password baru (minimal 4 karakter):');
  if (pw === null) return;
  pw = pw.trim();
  if (pw.length < 4) { alert('❌ Password minimal 4 karakter.'); return; }
  var konfirmasi = prompt('Konfirmasi — masukkan ulang password baru:');
  if (konfirmasi === null) return;
  if (konfirmasi.trim() !== pw) { alert('❌ Password tidak cocok. Reset dibatalkan.'); return; }

  setSB('sy');
  try {
    var r = await post({ action: 'resetPassword', dosenId: dosenId, passwordBaru: pw });
    if (!r.success) throw new Error(r.error || 'Gagal reset');
    setSB('ok');
    alert('✅ Password ' + namaDosen + ' berhasil direset.\nSampaikan password baru ke dosen yang bersangkutan.');
  } catch(e) {
    setSB('er');
    alert('❌ Gagal: ' + e.message);
  }
}

// [V10] jalankanMigrasiPassword() dihapus — berisi 21 password dosen
//       dalam bentuk plaintext di dalam kode. Migrasi sudah selesai
//       sejak V8.0, jadi fungsi ini tidak diperlukan lagi.

async function doAdminLogin(){
  var pin = document.getElementById('admin-pin').value.trim();
  var err = document.getElementById('login-err');
  err.textContent = '';
  if (!pin) { err.textContent = 'Masukkan PIN.'; return; }

  var btn = document.getElementById('btn-admin-login');
  btn.disabled = true;
  btn.textContent = 'Memeriksa...';

  try {
    var r = await get({ action: 'doAdminLogin', pin: pin });
    if (!r.success) {
      err.textContent = '❌ ' + (r.error || 'PIN salah.');
      document.getElementById('admin-pin').value = '';
      document.getElementById('admin-pin').focus();
      return;
    }
    isAdmin = true; currentUser = null;
    sessionStorage.setItem('userRole', 'admin');
    hideLogin();
    loadThenShow();
  } catch(e) {
    err.textContent = '❌ Gagal terhubung ke server. Coba lagi.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk Portal Admin →';
  }
}

function logout(){
  if(!confirm('Yakin ingin keluar dari aplikasi?'))return;
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('current_user');
  currentUser=null; actId=null; actJad=null; isAdmin=false;
  document.getElementById('csel').style.display='none';
  document.getElementById('resume-banner').style.display='none';
  document.getElementById('admin-pin').value='';
  document.getElementById('login-pass').value='';
  loadForLogin();
}

async function refreshDataLokal() {
  setSB('sy');
  try {
    var r = await Promise.all([
      get({action:'getDosen'}), 
      get({action:'getJadwal'}), 
      get({action:'getPresensi'}), 
      get({action:'getGanti'}),
      get({action:'getMaju'}),
      get({action:'getMataKuliah'})
    ]);
    D = r[0].data || [];
    J = r[1].data || [];
    P = r[2].data || [];
    G = r[3].data || [];
    M = r[4].data || [];
    MK= r[5].data || [];
    // Normalisasi format semester agar konsisten di seluruh dropdown
    P.forEach(function(p){ if(p.semester) p.semester = normalisasiSemester(p.semester); });
    setSB('ok'); 
    
    var oldRd = document.getElementById('rd') ? document.getElementById('rd').value : 'all';
    var oldJfd = document.getElementById('jfd') ? document.getElementById('jfd').value : 'all';
    
    fillJadwalDosen();
    var rd = document.getElementById('rd'); 
    if(rd) { rd.innerHTML='<option value="all">Semua dosen</option>'; D.forEach(function(d){var o=document.createElement('option');o.value=d.id;o.textContent=d.nama;rd.appendChild(o);}); rd.value = oldRd; }
    
    var jfd = document.getElementById('jfd'); 
    if(jfd) { jfd.innerHTML='<option value="all">Semua dosen</option>'; D.forEach(function(d){var o=document.createElement('option');o.value=d.id;o.textContent=d.nama;jfd.appendChild(o);}); jfd.value = oldJfd; }
    
    renderD(); 
    renderJ(); 
    renderHari(); 
    renderG();
    renderM();
    renderRiwayatSaya();
    renderMK();
    
    if(document.getElementById('page-report').classList.contains('active')) {
       renderR();
    }
    cekNotifGanti();
  } catch(e) {
    setSB('er');
    alert('Gagal menyegarkan data: ' + e.message);
  }
}

// ── Loading overlay helpers ──
function showAppLoading(msg) {
  var el = document.getElementById('app-loading');
  if (!el) return;
  el.style.display = 'flex';
  document.getElementById('load-msg').textContent = msg || 'Memuat data...';
  document.getElementById('load-steps').innerHTML = '';
  document.getElementById('load-error').style.display = 'none';
  document.getElementById('load-spinner').style.display = 'flex';
}

function updateLoadStep(text) {
  var el = document.getElementById('load-steps');
  if (!el) return;
  var line = document.createElement('div');
  line.textContent = text;
  line.style.cssText = 'animation:fadeIn .2s ease';
  el.appendChild(line);
  while (el.children.length > 5) el.removeChild(el.firstChild);
}

function hideAppLoading() {
  var el = document.getElementById('app-loading');
  if (!el) return;
  el.style.opacity = '0';
  el.style.transition = 'opacity .3s ease';
  setTimeout(function() {
    el.style.display = 'none';
    el.style.opacity = '1';
    el.style.transition = '';
  }, 300);
}

function showLoadError(msg) {
  document.getElementById('load-spinner').style.display = 'none';
  document.getElementById('load-msg').textContent = 'Gagal memuat';
  document.getElementById('load-err-msg').textContent = msg;
  document.getElementById('load-error').style.display = 'block';
}

function getWithTimeout(params, ms) {
  ms = ms || 15000;
  return Promise.race([
    get(params),
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('Timeout')); }, ms);
    })
  ]);
}

function getWithRetry(params) {
  return getWithTimeout(params, 15000).catch(function() {
    updateLoadStep('⚠️ Server lambat, mencoba ulang...');
    return getWithTimeout(params, 20000);
  });
}

function retryLoad() {
  document.getElementById('load-error').style.display = 'none';
  document.getElementById('load-spinner').style.display = 'flex';
  document.getElementById('load-msg').textContent = 'Mencoba ulang...';
  document.getElementById('load-steps').innerHTML = '';
  loadThenShow();
}

async function loadThenShow() {
  showAppLoading('Menghubungi server...');
  setSB('sy');

  try {
    updateLoadStep('🔄 Menghubungi server...');

    // V9.1: 1 request getAll menggantikan 7 request paralel
    var r = await getWithRetry({ action: 'getAll' });

    updateLoadStep('✅ Data diterima, menyiapkan aplikasi...');

    D  = r.dosen      || [];
    J  = r.jadwal     || [];
    P  = r.presensi   || [];
    G  = r.ganti      || [];
    M  = r.maju       || [];
    MK = r.mataKuliah || [];

    // Normalisasi format semester agar konsisten di seluruh dropdown
    P.forEach(function(p){ if(p.semester) p.semester = normalisasiSemester(p.semester); });

    var cfg          = r.settings    || {};
    SISTEM_AKTIF     = cfg.liburAktif === true ? false : true;
    PESAN_LIBUR      = cfg.pesanLibur      || '';
    PENGUMUMAN_LOGIN = cfg.pengumumanLogin || '';
    SEMESTER_AKTIF   = cfg.semesterAktif   || '';
    TAHUN_AKADEMIK   = cfg.tahunAkademik   || '';
    OVERRIDE_CODE    = cfg.overrideCode    || '';
    ARSIP_LIST       = r.arsip || [];
    periksaVersiBackend(r.versi);
    FLEX_BLOK        = r.flexBlok || [];
    TGL_MULAI_KULIAH = cfg.tglMulaiKuliah || '';
    MINGGU_UTS       = Number(cfg.mingguUTS || 8);
    MINGGU_UAS       = Number(cfg.mingguUAS || 16);
    MINGGU_LIBUR     = cfg.mingguLibur || '';

    // Libur nasional dari sheet Libur_Nasional → objek Date
    LIBUR_NASIONAL = (r.libur || []).map(function(l){
      return { tgl: new Date(l.tgl + 'T00:00:00'), nama: l.nama };
    }).filter(function(l){ return !isNaN(l.tgl); });

    renderBannerArsip();

    updateLoadStep('✅ Siap! Membuka aplikasi...');
    setSB('ok');

    setTimeout(function() {
      hideAppLoading();
      fillAll();
      restoreSesi();
      if (isAdmin) {
        pg('beranda-admin', document.getElementById('tab-beranda'));
      } else if (currentUser) {
        tampilkanPengumumanLogin();
        pg('beranda', document.getElementById('tab-beranda'));
      }
    }, 500);

  } catch(e) {
    setSB('er');
    var msg = e.message === 'Timeout'
      ? 'Server tidak merespons. Periksa koneksi internet, lalu coba lagi.'
      : 'Gagal memuat data: ' + (e.message || 'Error tidak diketahui');
    showLoadError(msg);
  }
}

function updateUserUI(){
  var btnBeranda = document.getElementById('tab-beranda');
  var btnH = document.getElementById('tab-hadir');
  var btnG = document.getElementById('tab-ganti');
  var btnMaju = document.getElementById('tab-maju');
  var btnR = document.getElementById('tab-riwayat');
  var btnRapor = document.getElementById('tab-rapor');
  var btnD = document.getElementById('tab-dosen');
  var btnJ = document.getElementById('tab-jadwal');
  var btnMK = document.getElementById('tab-mk');
  var btnL = document.getElementById('tab-report');
  
  if (isAdmin) {
    document.getElementById('user-avatar').textContent = 'AD';
    document.getElementById('user-name').textContent = 'Administrator';
    document.getElementById('login-info').style.display = 'none';

    btnBeranda.style.display = 'inline-block';
    btnBeranda.textContent = '🏠 Beranda';
    btnH.style.display = 'none';
    btnR.style.display = 'none';
    btnRapor.style.display = 'none';
    btnD.style.display = 'inline-block';
    btnJ.style.display = 'inline-block';
    if(btnMK) btnMK.style.display = 'inline-block';
    btnL.style.display = 'inline-block';
    btnMaju.style.display = 'inline-block';

    document.getElementById('form-pengajuan-ganti').style.display = 'none';
    document.getElementById('ganti-title-list').textContent = 'Daftar Seluruh Pengajuan (Admin)';
    document.getElementById('form-pengajuan-maju').style.display = 'none';
    document.getElementById('maju-title-list').textContent = 'Daftar Seluruh Pengajuan Jadwal Maju (Admin)';

    // pg() dipanggil dari loadThenShow() setelah data siap
    
  } else if (currentUser) {
    var parts=currentUser.nama.split(' ');
    var init=(parts[0]?parts[0][0]:'')+(parts[1]?parts[1][0]:'');
    document.getElementById('user-avatar').textContent=init.toUpperCase();
    document.getElementById('user-name').textContent=currentUser.nama.split(',')[0];
    
    var info=document.getElementById('login-info');
    info.textContent='Login sebagai: '+currentUser.nama;
    info.style.display='block';
    
    var gi=document.getElementById('ganti-info');
    gi.textContent='Pengajuan atas nama: '+currentUser.nama;
    gi.style.display='block';
    
    var mi=document.getElementById('maju-info');
    mi.textContent='Pengajuan atas nama: '+currentUser.nama;
    mi.style.display='block';
    
    var gmk=document.getElementById('gmk');
    gmk.innerHTML='<option value="">— Pilih mata kuliah —</option>';
    (currentUser.mk||[]).forEach(function(m){var o=document.createElement('option');o.textContent=m;gmk.appendChild(o);});
    
    var mmk=document.getElementById('mmk');
    mmk.innerHTML='<option value="">— Pilih mata kuliah —</option>';
    (currentUser.mk||[]).forEach(function(m){var o=document.createElement('option');o.textContent=m;mmk.appendChild(o);});
    
    btnBeranda.style.display = 'inline-block';
    btnH.style.display = 'inline-block';
    btnR.style.display = 'inline-block';
    btnRapor.style.display = 'inline-block';
    btnD.style.display = 'none';
    btnJ.style.display = 'none';
    if(btnMK) btnMK.style.display = 'none';
    btnL.style.display = 'none';
    btnMaju.style.display = 'inline-block';
    
    document.getElementById('form-pengajuan-ganti').style.display = 'block';
    document.getElementById('ganti-title-list').textContent = 'Riwayat Pengajuan Saya';
    document.getElementById('form-pengajuan-maju').style.display = 'block';
    document.getElementById('maju-title-list').textContent = 'Riwayat Pengajuan Jadwal Maju Saya';
    
    // pg() dipanggil dari loadThenShow() setelah data siap
    fillBerandaDosen();
  }
}

function restoreSesi(){
  if(!currentUser)return;
  var todayStr=new Date().toLocaleDateString('id-ID');
  var todayTs=parseTanggal(todayStr);
  var sg=P.find(function(p){return parseTanggal(p.tanggal)===todayTs&&p.dosenId===currentUser.id&&(!p.waktuSelesai||p.waktuSelesai==='');});

  // [V12.2] Sesi tertinggal dari hari SEBELUMNYA. Versi lama hanya
  // memeriksa hari ini, sehingga sesi yang lupa ditutup kemarin tidak
  // muncul di mana pun — dan itu penyebab utama sesi menggantung.
  if(!sg){
    var tertinggal = P.filter(function(p){
      return p.dosenId===currentUser.id && (!p.waktuSelesai||p.waktuSelesai==='')
             && parseTanggal(p.tanggal) < todayTs;
    }).sort(function(x,y){ return parseTanggal(y.tanggal)-parseTanggal(x.tanggal); });
    if(tertinggal.length){
      var t=tertinggal[0];
      actId=t.id; actJad=J.find(function(j){return j.id===t.jadwalId;});
      var b2=document.getElementById('resume-banner');
      document.getElementById('resume-title').textContent =
        'Sesi ' + t.tanggal + ' belum direkam selesai'
        + (tertinggal.length>1 ? ' (dan ' + (tertinggal.length-1) + ' sesi lain)' : '');
      document.getElementById('resume-info').textContent =
        t.mk + (t.kelas?' ('+t.kelas+')':'') + ' · Mulai ' + t.waktuHadir
        + ' · Akan ditutup otomatis oleh sistem bila dibiarkan';
      b2.style.display='flex';
      tampilKartuSelesai(t, actJad);
      return;
    }
  }

  if(sg){
    actId=sg.id;actJad=J.find(function(j){return j.id===sg.jadwalId;});
    var banner=document.getElementById('resume-banner');
    document.getElementById('resume-title').textContent='Sesi mengajar belum direkam selesai';
    document.getElementById('resume-info').textContent=sg.mk+(sg.kelas?' ('+sg.kelas+')':'')+' · Mulai '+sg.waktuHadir;
    banner.style.display='flex';
    tampilKartuSelesai(sg,actJad);
  }else{
    document.getElementById('resume-banner').style.display='none';
    document.getElementById('csel').style.display='none';
  }
}


// =====================================================
// [V10] ARSIP — lihat data semester lalu (READ-ONLY)
// -----------------------------------------------------
// Sifatnya per-pengguna: hanya browser ini yang membaca
// database lama. Dosen lain tetap bisa presensi normal.
// =====================================================

function renderBannerArsip() {
  var b = document.getElementById('banner-arsip');
  if (!ARSIP_AKTIF) {
    if (b) { b.remove(); document.body.style.paddingTop = ''; }
    return;
  }
  if (!b) {
    b = document.createElement('div');
    b.id = 'banner-arsip';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;'
      + 'background:#633806;color:#fff;text-align:center;padding:8px 12px;'
      + 'font-size:12px;font-weight:600;display:flex;align-items:center;'
      + 'justify-content:center;gap:10px;flex-wrap:wrap';
    document.body.appendChild(b);
    document.body.style.paddingTop = '34px';
  }
  b.innerHTML = '📁 ARSIP: <b>' + ARSIP_AKTIF.nama + '</b> — data hanya bisa dibaca'
    + '<button onclick="keluarArsip()" style="background:#fff;color:#633806;border:none;'
    + 'border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer">'
    + '← Kembali ke semester berjalan</button>';
}

// Buka arsip. id === '' berarti kembali ke semester berjalan.
async function bukaArsip(id) {
  if (!id) return keluarArsip();
  var arsip = ARSIP_LIST.find(function(a){ return a.id === id; });
  if (!arsip) { alert('Arsip tidak ditemukan.'); return; }

  if (!confirm('Buka arsip "' + arsip.nama + '"?\n\n'
    + 'Semua data yang tampil akan berasal dari semester tersebut '
    + 'dan tidak bisa diubah.\n\n'
    + 'Dosen lain TIDAK terpengaruh — mereka tetap bisa presensi seperti biasa.')) return;

  ARSIP_AKTIF = { id: arsip.id, nama: arsip.nama };
  renderBannerArsip();
  await loadThenShow();
}

async function keluarArsip() {
  ARSIP_AKTIF = null;
  renderBannerArsip();
  await loadThenShow();
}



// =====================================================
// [V10.9] PERIKSA VERSI BACKEND
// Membandingkan versi kode di server dengan yang diharapkan
// frontend. Kalau beda, URL /exec kemungkinan besar menunjuk
// deployment lama — dan itu menjelaskan data lama yang muncul
// kembali serta fitur yang "tidak dikenal".
// =====================================================
function periksaVersiBackend(versiServer) {
  var el = document.getElementById('banner-versi');
  if (versiServer === VERSI_DIHARAPKAN) { if (el) el.remove(); return; }

  if (!el) {
    el = document.createElement('div');
    el.id = 'banner-versi';
    el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9998;'
      + 'background:#791f1f;color:#fff;padding:9px 14px;font-size:12px;'
      + 'line-height:1.5;text-align:center';
    document.body.appendChild(el);
  }
  el.innerHTML = '⚠️ <b>Backend versi lama terdeteksi</b> — server menjawab '
    + '<b>' + (versiServer || 'tanpa versi') + '</b>, seharusnya <b>' + VERSI_DIHARAPKAN + '</b>. '
    + 'URL server kemungkinan menunjuk deployment lama. Data yang tampil bisa salah. '
    + '<span style="opacity:.8">Hubungi pengelola sistem.</span>';
}
