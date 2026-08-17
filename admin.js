import "./firebase-client.js";
import { auth, db } from "./firebase-client.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
const loginPanel = $("loginPanel");
const adminPanel = $("adminPanel");

onAuthStateChanged(auth, user => {
  if (user) {
    loginPanel.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    loadDetailsLink();
  } else {
    loginPanel.classList.remove("hidden");
    adminPanel.classList.add("hidden");
  }
});

// ========================
// للاطلاع على التفاصيل
// ========================
const detailsLinkOpen = $("detailsLinkOpen");
const detailsLinkEmpty = $("detailsLinkEmpty");
const detailsLinkEditRow = $("detailsLinkEditRow");
const detailsLinkInput = $("detailsLinkInput");
const detailsLinkMsg = $("detailsLinkMsg");

function renderDetailsLink(url) {
  if (url) {
    detailsLinkOpen.href = url;
    detailsLinkOpen.classList.remove("hidden");
    detailsLinkEmpty.classList.add("hidden");
    detailsLinkInput.value = url;
  } else {
    detailsLinkOpen.classList.add("hidden");
    detailsLinkEmpty.classList.remove("hidden");
    detailsLinkInput.value = "";
  }
}

async function loadDetailsLink() {
  try {
    const snap = await getDoc(doc(db, "settings", "detailsLink"));
    const url = snap.exists() ? (snap.data().url || "") : "";
    renderDetailsLink(url);
  } catch (err) {
    detailsLinkMsg.textContent = "تعذر تحميل الرابط.";
  }
}

$("editDetailsLink").addEventListener("click", () => {
  detailsLinkEditRow.classList.toggle("hidden");
});

$("saveDetailsLink").addEventListener("click", async () => {
  const url = detailsLinkInput.value.trim();
  detailsLinkMsg.textContent = "جارٍ الحفظ...";
  try {
    await setDoc(doc(db, "settings", "detailsLink"), { url });
    renderDetailsLink(url);
    detailsLinkEditRow.classList.add("hidden");
    detailsLinkMsg.textContent = "تم الحفظ.";
    setTimeout(() => { detailsLinkMsg.textContent = ""; }, 2000);
  } catch (err) {
    detailsLinkMsg.textContent = "تعذر حفظ الرابط.";
  }
});

$("adminLoginForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("loginMessage").textContent = "جارٍ تسجيل الدخول...";
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("adminPassword").value);
    $("loginMessage").textContent = "";
  } catch (err) {
    $("loginMessage").textContent = "تعذر تسجيل الدخول. تأكدي من البريد وكلمة المرور.";
  }
});

$("logout").addEventListener("click", () => signOut(auth));
