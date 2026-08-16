import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import { auth, db } from "./firebase-client.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
const STATS_DOC = doc(db, "stats", "examResults");

function normalizeHeader(h) {
  return String(h || "").replace(/\s+/g, " ").trim();
}

function findColumn(headers, keyword) {
  return headers.findIndex(h => normalizeHeader(h).includes(keyword));
}

// عرض الإحصائيات في الصفحة (تُستخدم سواء بعد الرفع أو عند التحميل التلقائي)
function renderStats(data) {
  $("statTotal").textContent = data.total ?? "-";
  $("statAvg").textContent = data.avg ?? "-";
  $("statMax").textContent = data.max ?? "-";
  $("statMin").textContent = data.min ?? "-";
  renderTable("gradeTable", data.grades || {}, data.total || 1);
  renderTable("categoryTable", data.categories || {}, data.total || 1);
  $("statsResults").classList.remove("hidden");
}

function renderTable(tableId, counts, total) {
  const table = $(tableId);
  table.innerHTML = "";
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [label, count] of sorted) {
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.textContent = label;
    const tdCount = document.createElement("td");
    tdCount.textContent = `${count} (${((count / total) * 100).toFixed(1)}%)`;
    tr.appendChild(tdLabel);
    tr.appendChild(tdCount);
    table.appendChild(tr);
  }
}

// جلب آخر إحصائيات محفوظة وعرضها تلقائيًا عند فتح اللوحة
async function loadSavedStats() {
  try {
    const snap = await getDoc(STATS_DOC);
    if (snap.exists()) {
      renderStats(snap.data());
    }
  } catch (error) {
    console.error(error);
  }
}

onAuthStateChanged(auth, user => {
  if (user) loadSavedStats();
});

$("statsBtn").addEventListener("click", async () => {
  const file = $("statsFile").files[0];
  if (!file) {
    $("statsMessage").textContent = "اختاري ملف Excel أولًا.";
    return;
  }
  $("statsMessage").textContent = "جارٍ تحليل الملف...";
  $("statsResults").classList.add("hidden");

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    let sheetName = workbook.SheetNames.find(n => n.includes("استمارة قياس"));
    if (!sheetName) {
      sheetName = workbook.SheetNames.find(n => {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[n], { header: 1 });
        return rows.some(r => r.some(c => normalizeHeader(c) === "اسم المعلمة"));
      });
    }
    if (!sheetName) throw new Error("NO_SHEET");

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    const headerRowIndex = rows.findIndex(r =>
      r.some(c => normalizeHeader(c) === "اسم المعلمة")
    );
    if (headerRowIndex === -1) throw new Error("NO_HEADER");

    const headers = rows[headerRowIndex];
    const nameCol = findColumn(headers, "اسم المعلمة");
    const gradeCol = findColumn(headers, "التقدير");
    const categoryCol = findColumn(headers, "الفئة المناسبة للتدريس");
    const scoreCol = findColumn(headers, "المجموع");

    let total = 0;
    const grades = {};
    const categories = {};
    const scores = [];

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[nameCol]) continue;
      total++;

      if (gradeCol !== -1 && row[gradeCol]) {
        const g = String(row[gradeCol]).trim();
        grades[g] = (grades[g] || 0) + 1;
      }
      if (categoryCol !== -1 && row[categoryCol]) {
        const c = String(row[categoryCol]).trim();
        categories[c] = (categories[c] || 0) + 1;
      }
      if (scoreCol !== -1 && typeof row[scoreCol] === "number") {
        scores.push(row[scoreCol]);
      }
    }

    if (!total) throw new Error("EMPTY");

    const statsData = {
      total,
      avg: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null,
      max: scores.length ? Math.max(...scores) : null,
      min: scores.length ? Math.min(...scores) : null,
      grades,
      categories,
      fileName: file.name,
      updatedAt: serverTimestamp()
    };

    // حفظ في Firestore عشان أي شخص يفتح اللوحة يشوفها
    await setDoc(STATS_DOC, statsData);

    renderStats(statsData);
    $("statsMessage").textContent = "تم حفظ الإحصائيات، وراح تظهر تلقائيًا لأي شخص يفتح اللوحة.";
  } catch (error) {
    console.error(error);
    $("statsMessage").textContent = "تعذر تحليل الملف. تأكدي إن الأعمدة (اسم المعلمة، التقدير، الفئة المناسبة للتدريس) موجودة.";
  }
});
