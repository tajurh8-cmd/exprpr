// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_I1HSrulXlPCj9_U_FhSfsYQhz-DxbMk",
  authDomain: "dbplu-62d92.firebaseapp.com",
  projectId: "dbplu-62d92",
  storageBucket: "dbplu-62d92.firebasestorage.app",
  messagingSenderId: "623211397382",
  appId: "1:623211397382:web:db9a7bd4abcc7f44261e87"
};

initializeApp(firebaseConfig);
const db = getFirestore();

// ================= SESSION =================
window.user = JSON.parse(localStorage.getItem("user")) || { username:"UNKNOWN" };

// ================= IZIN NOTIF =================
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

// ================= ELEMENT =================
const rakSelect = document.getElementById("rakSelect");
const rakInput  = document.getElementById("rakInput");
const barcodeEl = document.getElementById("barcode");
const descEl    = document.getElementById("deskripsi");
const expiredEl = document.getElementById("expired");
const qtyEl     = document.getElementById("qty");
const listEl    = document.getElementById("list");
const scannerBox = document.getElementById("scannerBox");
const video = document.getElementById("video");

barcodeEl.focus();

// ================= BARCODE NORMALIZE =================
function normalizeBarcode(v){
  v=v.trim();
  return v.length>1 ? v.slice(0,-1) : v;
}

// ================= RAK =================
async function loadRak(){
  rakSelect.innerHTML="<option value=''>Pilih Rak</option>";
  const s=await getDocs(collection(db,"Rak"));
  s.forEach(d=>{
    rakSelect.innerHTML+=`<option>${d.data().name}</option>`;
  });
}
loadRak();

async function getRakAktif(){
  let r=(rakSelect.value||rakInput.value||"").trim().toUpperCase();
  if(!r) return "";
  if(![...rakSelect.options].some(o=>o.value===r)){
    await addDoc(collection(db,"Rak"),{name:r});
    rakSelect.innerHTML+=`<option>${r}</option>`;
  }
  rakSelect.value=r;
  rakInput.value="";
  return r;
}

// ================= DATASUMBER =================
async function lookupDeskripsi(barcode){
  descEl.value="Mencari data...";
  const q=query(collection(db,"datasumber"),where("BARCODE","==",barcode));
  const s=await getDocs(q);
  if(s.empty){descEl.value="❌ BARCODE TIDAK TERDAFTAR";return;}
  s.forEach(d=>descEl.value=d.data().DESKRIPSI);
}

barcodeEl.addEventListener("change",()=>{
  if(barcodeEl.value.trim()){
    const n=normalizeBarcode(barcodeEl.value);
    barcodeEl.value=n;
    lookupDeskripsi(n);
    expiredEl.focus();
  }
});

// ================= HELPER =================
function batasAkhirRetur(e,rh=30){
  const d=new Date(e); d.setDate(d.getDate()-rh); return d;
}
function umurHari(b){
  return Math.floor((new Date()-b)/86400000);
}
function warna(u){
  const m=Math.floor(u/30);
  if(u<0)return["b-abu","LEWAT","bg-secondary"];
  if(m<6)return["b-merah","< 6 Bulan","bg-danger"];
  if(m<=12)return["b-kuning","6–12 Bulan","bg-warning text-dark"];
  if(m<=24)return["b-hijau","1–2 Tahun","bg-success"];
  return["b-biru","> 2 Tahun","bg-primary"];
}

// ================= NOTIF H-7 =================
function notifyIfH7(item){
  if(!("Notification"in window))return;
  if(Notification.permission!=="granted")return;
  const sisa=-item.umur;
  if(sisa>=0 && sisa<=7){
    new Notification(`⚠ H-${sisa} Batas Retur`,{
      body:`${item.deskripsi} | Rak ${item.rak} | Qty ${item.qty}`
    });
  }
}

// ================= SIMPAN =================
window.simpan=async()=>{
  const rak=await getRakAktif();
  if(!rak||!barcodeEl.value||!expiredEl.value||!qtyEl.value){
    alert("Lengkapi data");return;
  }
  await addDoc(collection(db,"edReport"),{
    rak,
    barcode:barcodeEl.value,
    deskripsi:descEl.value,
    expired:expiredEl.value,
    qty:Number(qtyEl.value),
    user:window.user.username,
    createdAt:new Date()
  });
  barcodeEl.value="";
  descEl.value="";
  expiredEl.value="";
  qtyEl.value="";
  barcodeEl.focus();
};

// ================= HAPUS =================
window.hapusItem=async(id)=>{
  if(!confirm("Hapus data ini?")) return;
  await deleteDoc(doc(db,"edReport",id));
};

// ================= LIST =================
onSnapshot(
  query(collection(db,"edReport"),orderBy("createdAt","desc")),
  snap=>{
    let items=[];
    snap.forEach(d=>{
      const x=d.data();
      const batas=batasAkhirRetur(x.expired);
      const umur=umurHari(batas);
      items.push({id:d.id,...x,batas,umur});
    });

    items.sort((a,b)=>a.umur-b.umur);

    listEl.innerHTML="";
    const notified=sessionStorage.getItem("h7_notified");

    items.forEach(item=>{
      const w=warna(item.umur);
      const sisa=-item.umur;
      const warn=(sisa>=0&&sisa<=7)
        ? `<div class="warn">⚠ H-${sisa} menuju batas retur</div>`:"";

      if(!notified) notifyIfH7(item);

      listEl.innerHTML+=`
      <div class="card item-card ${w[0]}">
        <div class="card-body py-2 px-3">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <div class="fw-semibold">${item.deskripsi}</div>
              <div class="label">${item.barcode} • Rak <b>${item.rak}</b> • Qty ${item.qty}</div>
              <div class="label">Input: <b>${item.user||"-"}</b></div>
              <div class="label">Expired: ${item.expired}</div>
              <div class="label">Batas Retur: ${item.batas.toLocaleDateString("id-ID")}</div>
              ${warn}
            </div>
            <div class="d-flex gap-1">
              <span class="pill ${w[2]}">${w[1]}</span>
              <button class="btn btn-sm btn-outline-danger py-0 px-1"
                      onclick="hapusItem('${item.id}')">🗑</button>
            </div>
          </div>
          <div class="umur mt-1">
            Umur Display: ${item.umur<0?"LEWAT":item.umur+" hari"}
          </div>
        </div>
      </div>`;
    });

    sessionStorage.setItem("h7_notified","1");
  }
);

// ================= SCANNER =================
let stream;
window.openScanner=async()=>{
  if(!("BarcodeDetector"in window)){alert("Browser tidak support");return;}
  scannerBox.classList.remove("d-none");
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
  video.srcObject=stream;
  const det=new BarcodeDetector({formats:["ean_13","code_128"]});
  const scan=async()=>{
    if(!stream)return;
    const r=await det.detect(video);
    if(r.length){
      const n=normalizeBarcode(r[0].rawValue);
      barcodeEl.value=n;
      await lookupDeskripsi(n);
      closeScanner();
      expiredEl.focus();
      return;
    }
    requestAnimationFrame(scan);
  };
  scan();
};
window.closeScanner=()=>{
  scannerBox.classList.add("d-none");
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
};
