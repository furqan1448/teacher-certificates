const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({region: "me-central2", maxInstances: 10});

exports.verifyTeacher = onCall(async (request) => {
  const phone = String(request.data?.phone || "").replace(/\D/g, "");
  const password = String(request.data?.password || "").trim().toUpperCase();

  if (phone.length === 9) {
    // 05xxxxxxxx normalization
    // This branch is intentionally simple for Saudi mobile numbers.
  }
  const normalizedPhone = phone.length === 9 ? "0" + phone : phone;

  if (normalizedPhone.length !== 10 || password.length !== 4) {
    throw new HttpsError("invalid-argument", "Invalid credentials format.");
  }

  const snap = await admin.firestore()
    .collection("teachers")
    .where("phone", "==", normalizedPhone)
    .where("password", "==", password)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError("not-found", "Invalid credentials.");
  }

  const data = snap.docs[0].data();

  return {
    name: data.name,
    category: data.category
  };
});
