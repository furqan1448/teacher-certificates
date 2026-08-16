import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";

const $ = id => document.getElementById(id);

function normalizeHeader(h) {
  return String(h || "").replace(/\s+/g, " ").trim();
}

function findColumn(headers, keyword) {
  return headers.findIndex(h => normalizeHeader(h).includes(keyword));
}

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

    // نفضل ورقة "استمارة قياس" إن وجدت، وإلا نبحث عن أول ورقة فيها بيانات فعلية
    let sheetName = workbook.SheetNames.find(n => n.includes("استمارة قياس"));
    if (!sheetName) {
      sheetName = workbook.SheetNames.find(n => {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[n], { header: 1 });
        return rows.some(r => r.some(c => normalizeHeader(c) === "اسم المعلمة"));
      });
    }
    if (!sheetName) throw new Error("NO_SHEET");

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    // إيجاد صف العناوين (الصف اللي فيه "اسم المعلمة")
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

    $("statTotal").textContent = total;
    if (scores.length) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      $("statAvg").textContent = avg.toFixed(2);
      $("statMax").textContent = Math.max(...scores);
      $("statMin").textContent = Math.min(...scores);
    } else {
      $("statAvg").textContent = "-";
      $("statMax").textContent = "-";
      $("statMin").textContent = "-";
    }

    renderTable("gradeTable", grades, total);
    renderTable("categoryTable", categories, total);

    $("statsMessage").textContent = "";
    $("statsResults").classList.remove("hidden");
  } catch (error) {
    console.error(error);
    $("statsMessage").textContent = "تعذر تحليل الملف. تأكدي إن الأعمدة (اسم المعلمة، التقدير، الفئة المناسبة للتدريس) موجودة.";
  }
});

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
