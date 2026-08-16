import "./firebase-client.js";
import { auth } from "./firebase-client.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

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
