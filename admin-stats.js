import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";

const STATS_URL = "https://script.google.com/macros/s/AKfycbx7wVhMZIHC3zpNATgyhjzR1xKHuqU7wkFoUXV2BmdxnKiLmOyXfWHpDz1FNnirpVG4/exec";
const $ = id => document.getElementById(id);

function normalizeHeader(h) {
  return String(h || "").replace(/\s+/g, " ").trim();
}

function findColumn(headers, keyword) {
  return headers.findIndex(h => normalizeHeader(h).includes(keyword));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderStats(data) {
  $("statTotal").textContent = data.total ?? "-";
  $("statAvg").textContent = data.avg ?? "-";
  $("statMax").textContent = data.max ?? "-";
  $("statMin").textContent = data.min ?? "-";
  renderTable("gradeTable", data.grades || {}, data.total || 1);
  renderTable("categoryTable", data.categories || {}, data.total || 1);

  const downloadLink = $("downloadFileLink");
  if (data.fileUrl) {
    downloadLink.href = data.fileUrl;
    downloadLink.textContent = `تحميل الملف الأصلي (${data.fileName || "الملف"})`;
    downloadLink.classList.remove("hidden");
  } else {
    downloadLink.classList.add("hidden");
  }

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

async function loadSavedStats() {
  try {
    const response = await fetch(STATS_URL);
    const data = await response.json();
    if (data.exists) renderStats(data);
  } catch (error) {
    console.error(error);
  }
}
loadSavedStats();

$("statsBtn").addEventListener("click", async () => {
  const file = $("statsFile").files[0];
  if (!file) {
    $("statsMessage").textContent = "اختاري ملف Excel أولًا.";
    return;
  }
  $("statsMessage").textContent = "جارٍ تحليل الملف...";
  $("statsResults").classList.add("hidden");

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

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

    $("statsMessage").textContent = "جارٍ رفع الملف وحفظ الإحصائيات...";
    const fileBase64 = await fileToBase64(file);

    const statsData = {
      total,
      avg: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null,
      max: scores.length ? Math.max(...scores) : null,
      min: scores.length ? Math.min(...scores) : null,
      grades,
      categories,
      fileName: file.name,
      fileBase64,
      mimeType: file.type
    };

    const response = await fetch(STATS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(statsData)
    });
    const result = await response.json();

    renderStats({ ...statsData, fileUrl: result.fileUrl });
    $("statsMessage").textContent = "تم حفظ الإحصائيات والملف، وراح تظهر تلقائيًا لأي شخص يفتح اللوحة.";
  } catch (error) {
    console.error(error);
    $("statsMessage").textContent = "تعذر تحليل الملف أو رفعه. تأكدي إن الأعمدة (اسم المعلمة، التقدير، الفئة المناسبة للتدريس) موجودة.";
  }
});
