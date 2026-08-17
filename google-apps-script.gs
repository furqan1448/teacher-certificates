/**
 * كود Google Apps Script — رابط "للاطلاع على التفاصيل"
 * =======================================================
 * هذا الكود يُلصق داخل محرر Apps Script المرتبط بقوقل شيت جديد.
 * يقرأ الرابط من الخلية B1 في ورقة اسمها "Settings"، ويسمح
 * بتحديثه من نفس صفحة الإدارة في الموقع.
 *
 * خطوات الإعداد موجودة في الرسالة المرفقة مع هذا الملف.
 */

const SHEET_NAME = "Settings";
const CELL = "B1";

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange("A1").setValue("detailsLink");
  }
  return sheet;
}

// قراءة الرابط الحالي
function doGet(e) {
  const sheet = getSheet_();
  const url = sheet.getRange(CELL).getValue() || "";
  return ContentService
    .createTextOutput(JSON.stringify({ url: url }))
    .setMimeType(ContentService.MimeType.JSON);
}

// حفظ رابط جديد (يُرسل من صفحة الإدارة)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const url = (data.url || "").toString().trim();
    const sheet = getSheet_();
    sheet.getRange(CELL).setValue(url);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, url: url }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
