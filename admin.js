import "./firebase-client.js";
import { auth } from "./firebase-client.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// رابط تطبيق الويب (Web app) الخاص بقوقل شيت — يُلصق هنا بعد نشر
// كود google-apps-script.gs. يجب أن ينتهي بـ /exec
const DETAILS_LINK_SHEET_URL = "https://script.google.com/macros/s/AKfycbw2y27LGfTTfHWTKHQFtmIIuzz5Gs_8MeLsWl2jkScfzLgXSO0LBL1__7P2ghikjVg/exec";

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
// للاطلاع على التفاصيل (مرتبط بقوقل شيت)
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
  if (DETAILS_LINK_SHEET_URL.includes("PASTE_YOUR")) {
    detailsLinkMsg.textContent = "لم يتم ربط قوقل شيت بعد.";
    return;
  }
  try {
    const res = await fetch(DETAILS_LINK_SHEET_URL);
    const data = await res.json();
    renderDetailsLink(data.url || "");
  } catch (err) {
    detailsLinkMsg.textContent = "تعذر تحميل الرابط من قوقل شيت.";
  }
}

$("editDetailsLink").addEventListener("click", () => {
  detailsLinkEditRow.classList.toggle("hidden");
});

$("saveDetailsLink").addEventListener("click", async () => {
  if (DETAILS_LINK_SHEET_URL.includes("PASTE_YOUR")) {
    detailsLinkMsg.textContent = "لم يتم ربط قوقل شيت بعد.";
    return;
  }
  const url = detailsLinkInput.value.trim();
  detailsLinkMsg.textContent = "جارٍ الحفظ...";
  try {
    // نستخدم text/plain لتفادي مشاكل CORS مع Apps Script
    await fetch(DETAILS_LINK_SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ url })
    });
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
