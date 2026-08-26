/**
 * مزامنة بيانات المعلمات من قوقل شيت إلى Firestore
 * =======================================================
 * يُلصق هذا الكود في محرر Apps Script المرتبط بشيت المعلمات
 * (الأعمدة: م = كلمة المرور، اسم المعلمة، الفئة المناسبة للتدريس،
 * رقم الجوال). كل مرة يشتغل فيها، يكتب/يحدّث مستند لكل معلمة في
 * مجموعة "teachers" بـ Firestore، بحيث معرّف المستند = رقم جوالها
 * بصيغة 05xxxxxxxx. هذا يخلي دخول المعلمة في الموقع قراءة مستند
 * واحد فقط (سريعة جدًا) بدل انتظار Apps Script في كل مرة.
 *
 * ============ خطوات الإعداد (مرة وحدة) ============
 *
 * 1) إنشاء حساب خدمة (Service Account):
 *    - روحي Google Cloud Console للمشروع اللي مربوط بـ Firebase
 *      (نفس Project ID اللي في firebase-config.js، وهو "teacher-certificates").
 *    - IAM & Admin → Service Accounts → Create Service Account.
 *    - أعطيه صلاحية "Cloud Datastore User" (أو "Firebase Admin SDK
 *      Administrator Service Agent").
 *    - افتحي الحساب → Keys → Add Key → Create new key → JSON.
 *      بينزل ملف JSON فيه client_email و private_key.
 *
 * 2) تخزين بيانات الحساب في Script Properties (مو بالكود مباشرة):
 *    - من محرر Apps Script: Project Settings (⚙) → Script Properties.
 *    - أضيفي:
 *        FIREBASE_CLIENT_EMAIL = القيمة اللي بملف JSON (client_email)
 *        FIREBASE_PRIVATE_KEY  = القيمة اللي بملف JSON (private_key)
 *        FIREBASE_PROJECT_ID   = teacher-certificates
 *
 * 3) شغّلي مرة وحدة: من القائمة أعلى الشيت "مزامنة المعلمات" →
 *    "مزامنة الآن" (بيطلب صلاحية أول مرة، وافقي عليها).
 *
 * 4) لتفعيل التحديث التلقائي، شغّلي الدالة setupTriggers() مرة
 *    وحدة من محرر الأكواد (▶ بجانب اسم الدالة). هذا بينشئ:
 *      - Trigger عند أي تعديل بالشيت (يزامن خلال ثوانٍ).
 *      - Trigger كل 30 دقيقة كنسخة احتياطية.
 */

const FIRESTORE_TEACHERS_SHEET_NAME_HINT = "استمارة قياس"; // نفس المنطق المستخدم بالموقع لايجاد الشيت
const COL_PASSWORD = "م";
const COL_NAME = "اسم المعلمة";
const COL_CATEGORY = "الفئة المناسبة للتدريس";
const COL_PHONE = "رقم الجوال";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("مزامنة المعلمات")
    .addItem("مزامنة الآن", "syncTeachersToFirestore")
    .addToUi();
}

function setupTriggers() {
  // يشيل أي triggers قديمة لنفس الدالة عشان ما تتكرر
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "syncTeachersToFirestore") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("syncTeachersToFirestore")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  ScriptApp.newTrigger("syncTeachersToFirestore")
    .timeBased()
    .everyMinutes(30)
    .create();
  SpreadsheetApp.getUi().alert("تم تفعيل المزامنة التلقائية (عند التعديل + كل 30 دقيقة).");
}

function normalizePhone_(value) {
  let p = String(value || "").replace(/\D/g, "");
  if (p.indexOf("966") === 0) p = "0" + p.slice(3);
  if (p.length === 9) p = "0" + p;
  return p;
}

function findTeacherSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheets().find(s => s.getName().indexOf(FIRESTORE_TEACHERS_SHEET_NAME_HINT) !== -1);
  if (sheet) return sheet;
  // احتياط: أول شيت فيه عمود "اسم المعلمة"
  return ss.getSheets().find(s => {
    const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    return headers.indexOf(COL_NAME) !== -1;
  });
}

function readTeacherRows_() {
  const sheet = findTeacherSheet_();
  if (!sheet) throw new Error("ما لقيت شيت فيه عمود 'اسم المعلمة'.");

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idx = {
    password: headers.indexOf(COL_PASSWORD),
    name: headers.indexOf(COL_NAME),
    category: headers.indexOf(COL_CATEGORY),
    phone: headers.indexOf(COL_PHONE)
  };
  if (idx.password === -1 || idx.name === -1 || idx.phone === -1) {
    throw new Error("الأعمدة المطلوبة غير موجودة: " + COL_PASSWORD + " / " + COL_NAME + " / " + COL_PHONE);
  }

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const phone = normalizePhone_(row[idx.phone]);
    const password = String(row[idx.password] || "").trim().toUpperCase();
    const name = String(row[idx.name] || "").trim();
    if (!phone || phone.length !== 10 || !password || !name) continue;
    rows.push({
      phone: phone,
      password: password,
      name: name,
      category: idx.category !== -1 ? String(row[idx.category] || "").trim() : ""
    });
  }
  return rows;
}

// ============ المصادقة مع Firestore عبر حساب الخدمة ============

function getAccessToken_() {
  const props = PropertiesService.getScriptProperties();
  const clientEmail = props.getProperty("FIREBASE_CLIENT_EMAIL");
  const privateKey = props.getProperty("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const base64url = obj => Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, "");
  const toSign = base64url(header) + "." + base64url(claimSet);
  const signatureBytes = Utilities.computeRsaSha256Signature(toSign, privateKey);
  const signature = Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, "");
  const jwt = toSign + "." + signature;

  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    },
    muteHttpExceptions: true
  });
  const data = JSON.parse(response.getContentText());
  if (!data.access_token) throw new Error("تعذر الحصول على access token: " + response.getContentText());
  return data.access_token;
}

function toFirestoreFields_(teacher) {
  return {
    fields: {
      phone: { stringValue: teacher.phone },
      password: { stringValue: teacher.password },
      name: { stringValue: teacher.name },
      category: { stringValue: teacher.category }
    }
  };
}

function syncTeachersToFirestore() {
  const projectId = PropertiesService.getScriptProperties().getProperty("FIREBASE_PROJECT_ID");
  const teachers = readTeacherRows_();
  if (!teachers.length) throw new Error("ما لقيت صفوف معلمات صالحة بالشيت.");

  const accessToken = getAccessToken_();
  const baseUrl = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents";
  const CHUNK = 500; // batchWrite أقصى حد 500 عملية بالطلب الواحد

  for (let i = 0; i < teachers.length; i += CHUNK) {
    const chunk = teachers.slice(i, i + CHUNK);
    const writes = chunk.map(t => ({
      update: Object.assign(
        { name: "projects/" + projectId + "/databases/(default)/documents/teachers/" + t.phone },
        toFirestoreFields_(t)
      )
    }));

    const response = UrlFetchApp.fetch(baseUrl + ":batchWrite", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + accessToken },
      payload: JSON.stringify({ writes: writes }),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() >= 300) {
      throw new Error("فشلت المزامنة: " + response.getContentText());
    }
  }

  Logger.log("تمت مزامنة " + teachers.length + " معلمة إلى Firestore.");
}
