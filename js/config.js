/* config.js — Konstanta, state global, dan data libur nasional
   Semua variabel di sini bersifat global (window scope) agar bisa
   diakses oleh semua file JS lain tanpa module bundler.
*/


const API = 'https://script.google.com/macros/s/AKfycbxGKxl4M9NdTNZTJu1xSvdDulR0PkQRRiIihjDSp_VKxHETmstZ0qXSGDhlLljDRpJDlA/exec';
// Versi backend yang diharapkan. Kalau server menjawab dengan versi
// lain, berarti URL /exec menunjuk deployment lama — penyebab paling
// sering dari "action tidak dikenal" dan "data lama muncul lagi".
const VERSI_DIHARAPKAN = 'V12.1';
const HARI = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
let D=[],J=[],P=[],G=[],M=[],MK=[];
let eDos=null,eJad=null,eMk=null,tempMk=[];
let actId=null,actJad=null;

let isAdmin=false;
let currentUser=null;

// ── Status sistem presensi (diisi dari GAS Pengaturan) ──
let SISTEM_AKTIF       = true;  // true = presensi berjalan normal
let PESAN_LIBUR        = '';    // pesan banner saat sistem nonaktif (untuk dosen)
let PENGUMUMAN_LOGIN   = '';    // pengumuman di halaman login (untuk semua)
let SEMESTER_AKTIF     = '';    // misal: "2025/2026 Genap"
let TAHUN_AKADEMIK     = '';    // misal: "2025/2026"
let OVERRIDE_CODE      = '';    // kode override sementara saat sistem nonaktif (kosong = tidak aktif)
// ── Kalender akademik (untuk Flex Class) ──
let TGL_MULAI_KULIAH = '';   // YYYY-MM-DD, minggu 1 dimulai di sini
let MINGGU_UTS       = 8;
let MINGGU_UAS       = 16;
let MINGGU_LIBUR     = '';   // nomor minggu tanpa perkuliahan, mis. "5, 12"
let FLEX_BLOK        = [];   // blok waktu mingguan kelas flex

// ── Arsip (per-request, bukan mode global) ──
let ARSIP_LIST   = [];   // [{nama, id, catatan}] dari sheet Arsip
let ARSIP_AKTIF  = null; // null = database semester berjalan
                         // {nama,id} = sedang melihat arsip (read-only)

// Libur nasional — diisi dari sheet Libur_Nasional saat loadThenShow().
// Format tiap item: { tgl: Date, nama: string }
let LIBUR_NASIONAL     = [];

window.onload=function(){
  tick(); setInterval(tick,1000);
  
  var role = sessionStorage.getItem('userRole');
  if (role === 'admin') {
     isAdmin = true; currentUser = null; loadThenShow();
  } else if (role === 'dosen') {
     var savedUser = sessionStorage.getItem('current_user');
     if(savedUser) { currentUser = JSON.parse(savedUser); isAdmin = false; loadThenShow(); }
     else { loadForLogin(); }
  } else {
     loadForLogin();
  }
};

function tick(){
  var el=document.getElementById('clk');if(!el)return;
  var n=new Date();
  el.textContent=n.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' — '+n.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function todayHari(){return['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];}

// [V10] setSB() dipindah ke sini dari api.js (file itu dihapus).
// Indikator status sinkronisasi di pojok header — dipakai 95x di seluruh app.
function setSB(s){
  var el=document.getElementById('sb');
  if(!el) return;
  el.textContent = s==='ok' ? 'Tersinkron' : s==='sy' ? 'Menyinkron...' : 'Error';
  el.className   = 'sb'+(s==='sy'?' sy':s==='er'?' se':'');
}

// [V10] get() otomatis menyertakan arsipId kalau sedang melihat arsip.
async function get(p){
  var q = {};
  Object.keys(p).forEach(function(k){ q[k] = p[k]; });
  if (ARSIP_AKTIF && !q.arsipId) q.arsipId = ARSIP_AKTIF.id;
  var r = await fetch(API+'?'+new URLSearchParams(q).toString(),{redirect:'follow'});
  return JSON.parse(await r.text());
}

// [V10.9] postBesar() — untuk kiriman besar seperti foto bukti.
// post() biasa menempelkan seluruh data di URL, dan foto tidak muat
// di situ. Ini memakai POST sungguhan. Content-Type sengaja text/plain
// supaya browser tidak melakukan preflight (yang akan ditolak GAS).
async function postBesar(b){
  if (ARSIP_AKTIF) {
    alert('📁 Anda sedang melihat arsip ' + ARSIP_AKTIF.nama + '.\n\nData arsip tidak bisa diubah.');
    throw new Error('Mode arsip: penulisan ditolak.');
  }
  var r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(b),
    redirect: 'follow'
  });
  return JSON.parse(await r.text());
}

// [V10] post() diblokir saat melihat arsip. Server juga menolak,
// ini lapis kedua supaya pengguna dapat pesan jelas tanpa menunggu server.
async function post(b){
  if (ARSIP_AKTIF && b.action !== 'saveArsip' && b.action !== 'deleteArsip') {
    alert('📁 Anda sedang melihat arsip ' + ARSIP_AKTIF.nama + '.\n\n'
        + 'Data arsip tidak bisa diubah. Kembali ke semester berjalan dulu.');
    throw new Error('Mode arsip: penulisan ditolak.');
  }
  var r = await fetch(API+'?method=POST&payload='+encodeURIComponent(JSON.stringify(b)),{redirect:'follow'});
  return JSON.parse(await r.text());
}