const SHEETS_URL = "https://script.google.com/macros/s/AKfycbzyzBQfMjpi8-AQdjQQm58tZsZZdwqoEvoI3RvUZ7F3t4Nr3CQWZQh3fPNKznIJUtnH6Q/exec";
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
    const response = await fetch(SHEETS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        phone: phone,
        serial: serial
      })
    });
    const data = await response.json();
    if (!data.success) {
      $("teacherMessage").textContent =
        "رقم الجوال أو كلمة المرور غيرصحيحة.";
      return;
    }
    $("teacherName").textContent = data.name;
    $("teacherCategory").textContent = data.category;
    $("teacherMessage").textContent = "";
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
$("logoutBtn").addEventListener("click", () => {
  $("certificateSection").classList.add("hidden");
  $("teacherForm").reset();
})

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
