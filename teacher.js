// رابط الشيت بصيغة CSV بعد نشره للويب (خطوات النشر بملف README).
// غيّري هذا الرابط بالرابط اللي تحصلين عليه من "نشر على الويب".
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbOiRSdxvzZh2h6vdCyqYEBHHTHTj1b8z03ccnlsf6H2O-VZiEs-EViGSHM6620jjX8D-me3TUqXQz/pub?gid=1367919131&single=true&output=csv";

const COL_PASSWORD = "م";
const COL_NAME = "اسم المعلمة";
const COL_CATEGORY = "الفئة المناسبة للتدريس";
const COL_PHONE = "رقم الجوال";

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ""));
}

async function findTeacherInSheet(phone, serial) {
  const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("تعذر تحميل بيانات المعلمات.");
  const rows = parseCsv(await response.text());
  const headerRowIndex = rows.findIndex(r => r.includes(COL_NAME));
  if (headerRowIndex === -1) throw new Error("تعذر إيجاد أعمدة البيانات بالشيت.");
  const headers = rows[headerRowIndex];
  const idx = {
    password: headers.indexOf(COL_PASSWORD),
    name: headers.indexOf(COL_NAME),
    category: headers.indexOf(COL_CATEGORY),
    phone: headers.indexOf(COL_PHONE)
  };
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (normalizePhone(r[idx.phone]) === phone &&
        String(r[idx.password] || "").trim().toUpperCase() === serial) {
      return {
        name: String(r[idx.name] || "").trim(),
        category: idx.category !== -1 ? String(r[idx.category] || "").trim() : ""
      };
    }
  }
  return null;
}

const $ = id => document.getElementById(id);
function normalizePhone(value) {
  let p = String(value || "").replace(/\D/g, "");
  if (p.startsWith("966")) {
    p = "0" + p.slice(3);
  }
  if (p.length === 9) {
    p = "0" + p;
  }
  return p;
}
function syncCertificateFontSize() {
  const cert = $("certificate");
  if (!cert) return;
  const width = cert.offsetWidth;
  if (!width) return;
  const fontSize = Math.round(width * 0.04);
  cert.style.setProperty("--cert-font-size", fontSize + "px");
}

window.addEventListener("resize", syncCertificateFontSize);
window.addEventListener("orientationchange", syncCertificateFontSize);

$("teacherForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("teacherMessage").textContent = "جارٍ التحقق...";
  $("certificateSection").classList.add("hidden");
  const phone = normalizePhone($("phone").value);
  const serial = $("password").value.trim().toUpperCase();
  if (phone.length !== 10 || !serial) {
    $("teacherMessage").textContent =
      "تحققي من رقم الجوال وكلمة المرور.";
    return;
  }
  try {
    const teacher = await findTeacherInSheet(phone, serial);
    if (!teacher) {
      $("teacherMessage").textContent =
        "رقم الجوال أو كلمة المرور غيرصحيحة.";
      return;
    }
    $("teacherName").textContent = teacher.name;
    $("teacherCategory").textContent = teacher.category;
    $("teacherMessage").textContent = "";
    $("loginPanel").classList.add("hidden");
    $("certificateSection").classList.remove("hidden");
    syncCertificateFontSize();
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth"
    });
  } catch (error) {
    console.error(error);
    $("teacherMessage").textContent =
      "تعذر التحقق حاليًا. حاولي مرة أخرى.";
  }
});

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("تعذر تحميل: " + src));
    document.body.appendChild(script);
  });
}

$("downloadPdfBtn").addEventListener("click", async () => {
  const btn = $("downloadPdfBtn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "جارٍ التحميل...";

  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

    btn.textContent = "جارٍ التجهيز...";

    const certificateEl = $("certificate");

    const canvas = await html2canvas(certificateEl, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "cm",
      format: [21, 29.7],
    });

    pdf.addImage(imgData, "JPEG", 0, 0, 21, 29.7);

    const teacherName = ($("teacherName").textContent || "المعلمة").trim();
    pdf.save(`شهادة-اجتياز-${teacherName}.pdf`);
  } catch (error) {
    console.error(error);
    alert("تعذر إنشاء ملف PDF، تأكدي من اتصال الإنترنت وحاولي مرة أخرى.");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});
