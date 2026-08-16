import "./firebase-client.js";
import { auth, db } from "./firebase-client.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection, doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";

const $ = id => document.getElementById(id);
const loginPanel = $("loginPanel");
const adminPanel = $("adminPanel");

onAuthStateChanged(auth, user => {
  if (user) {
    loginPanel.classList.add("hidden");
    adminPanel.classList.remove("hidden");
  } else {
    loginPanel.classList.remove("hidden");
    adminPanel.classList.add("hidden");
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

$("importBtn").addEventListener("click", async () => {
  const file = $("excelFile").files[0];
  if (!file) {
    $("importMessage").textContent = "اختاري ملف Excel أولًا.";
    return;
  }
  $("importMessage").textContent = "جارٍ قراءة الملف وحفظ البيانات...";
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, {type: "array"});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {defval: ""});

    if (!rows.length) throw new Error("EMPTY");

    let count = 0;
    for (const row of rows) {
      const password = String(row["م"] ?? row["كلمة المرور"] ?? row["الرمز"] ?? "").trim().toUpperCase();
      const name = String(row["اسم المعلمة"] ?? "").trim();
      const category = String(row["الفئة المناسبة للتدريس"] ?? row["الفئة"] ?? "").trim();
      let phone = String(row["رقم الجوال"] ?? row["الجوال"] ?? "").replace(/\D/g, "");

      if (phone.length === 9) phone = "0" + phone;
      if (!password || !name || !phone) continue;

      // لا نستخدم رقم الجوال كـ document ID حتى لا يصبح سهل التخمين.
      // يتم إنشاء معرف عشوائي لكل سجل.
      const ref = doc(collection(db, "teachers"));
      await setDoc(ref, {
        password,
        name,
        category,
        phone,
        createdAt: serverTimestamp()
      });
      count++;
    }
    $("importMessage").textContent = `تم حفظ ${count} سجل بنجاح.`;
  } catch (err) {
    console.error(err);
    $("importMessage").textContent = "حدث خطأ أثناء قراءة الملف أو الحفظ.";
  }
});
