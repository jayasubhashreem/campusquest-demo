// ---------- 1. FIREBASE SETUP ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBMLdlrzgrXzJFohJkGFXIZZjZarRBXX_Q",
  authDomain: "campusquest-6b3ef.firebaseapp.com",
  projectId: "campusquest-6b3ef",
  storageBucket: "campusquest-6b3ef.firebasestorage.app",
  messagingSenderId: "1082089003105",
  appId: "1:1082089003105:web:3a4c19f9af6ffca17a7220"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- 2. QUESTS ----------
const quests = [
  { text: "🚶 Walk 5,000 steps", xp: 20 },
  { text: "💧 Drink 2 litres of water", xp: 15 },
  { text: "😴 Sleep before 12 AM", xp: 25 },
  { text: "🤝 Help a junior or friend", xp: 20 },
  { text: "🍎 Eat one healthy meal", xp: 15 }
];

// ---------- 3. HTML ELEMENTS ----------
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const authMsg = document.getElementById("auth-msg");
const userName = document.getElementById("user-name");
const questList = document.getElementById("quest-list");
const xpText = document.getElementById("xp");
const levelText = document.getElementById("level");
const xpFill = document.getElementById("xp-fill");
const leaderboard = document.getElementById("leaderboard");

// ---------- 4. VARIABLES ----------
let currentUser = null;
let myXP = 0;
let myDone = [];          // numbers of quests completed today
let pendingName = "";
let stopBoard = null;

function today() {
  return new Date().toLocaleDateString("en-CA"); // like 2026-10-18
}

// ---------- 5. SIGN UP / LOGIN / LOGOUT ----------
document.getElementById("signup-btn").addEventListener("click", async function () {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (name === "") {
    authMsg.textContent = "⚠️ Please enter your name.";
    return;
  }
  pendingName = name;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (e) {
    authMsg.textContent = friendlyError(e.code);
  }
});

document.getElementById("login-btn").addEventListener("click", async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    authMsg.textContent = friendlyError(e.code);
  }
});

document.getElementById("logout-btn").addEventListener("click", function () {
  signOut(auth);
});

function friendlyError(code) {
  if (code === "auth/email-already-in-use") return "⚠️ This email already has an account. Try Login.";
  if (code === "auth/weak-password") return "⚠️ Password must be at least 6 characters.";
  if (code === "auth/invalid-email") return "⚠️ Please enter a valid email.";
  if (code === "auth/invalid-credential") return "⚠️ Wrong email or password.";
  return "⚠️ Something went wrong. Try again.";
}

// ---------- 6. WHEN USER LOGS IN OR OUT ----------
onAuthStateChanged(auth, async function (user) {
  if (user) {
    currentUser = user;
    await loadUser();
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    authMsg.textContent = "";
    startLeaderboard();
  } else {
    currentUser = null;
    if (stopBoard) stopBoard();
    appSection.classList.add("hidden");
    authSection.classList.remove("hidden");
  }
});

async function loadUser() {
  const ref = doc(db, "users", currentUser.uid);
  let snap = await getDoc(ref);

  // first time? create the player
  if (!snap.exists()) {
    const name = pendingName || currentUser.email.split("@")[0];
    await setDoc(ref, { name: name, xp: 0, done: [], date: today() });
    snap = await getDoc(ref);
  }

  const data = snap.data();
  userName.textContent = data.name;
  myXP = data.xp;

  // new day? quests reset, but XP stays
  if (data.date !== today()) {
    myDone = [];
    await updateDoc(ref, { done: [], date: today() });
  } else {
    myDone = data.done;
  }

  showQuests();
  updateProgress();
}

// ---------- 7. QUESTS (saved in Firebase) ----------
function showQuests() {
  questList.innerHTML = "";
  quests.forEach(function (quest, index) {
    const li = document.createElement("li");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = myDone.includes(index);

    checkbox.addEventListener("change", async function () {
      if (checkbox.checked) {
        myXP += quest.xp;
        myDone.push(index);
      } else {
        myXP -= quest.xp;
        myDone = myDone.filter(function (i) { return i !== index; });
      }
      updateProgress();
      await updateDoc(doc(db, "users", currentUser.uid), { xp: myXP, done: myDone });
    });

    li.appendChild(checkbox);
    li.append(" " + quest.text + " (+" + quest.xp + " XP)");
    questList.appendChild(li);
  });
}

function updateProgress() {
  xpText.textContent = myXP;
  levelText.textContent = Math.floor(myXP / 100) + 1;
  xpFill.style.width = (myXP % 100) + "%";
}

// ---------- 8. LIVE LEADERBOARD ----------
function startLeaderboard() {
  const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(10));
  stopBoard = onSnapshot(q, function (snapshot) {
    leaderboard.innerHTML = "";
    let rank = 0;
    snapshot.forEach(function (d) {
      const p = d.data();
      const medal = ["🥇", "🥈", "🥉"][rank] || "";
      const li = document.createElement("li");
      li.textContent = medal + " " + p.name + " - " + p.xp + " XP" +
        (d.id === currentUser.uid ? " ⭐ (You)" : "");
      leaderboard.appendChild(li);
      rank++;
    });
  });
}

// ---------- 9. BUNKMETER ----------
document.getElementById("check-btn").addEventListener("click", function () {
  const total = Number(document.getElementById("total").value);
  const attended = Number(document.getElementById("attended").value);
  const result = document.getElementById("bunk-result");

  if (total <= 0 || attended < 0 || attended > total) {
    result.textContent = "⚠️ Please enter valid numbers.";
    return;
  }

  const percent = (attended / total) * 100;

  if (percent >= 75) {
    const canBunk = Math.floor((4 * attended - 3 * total) / 3);
    result.textContent =
      "✅ Attendance " + percent.toFixed(1) + "%. You can safely skip " +
      canBunk + " more class(es).";
  } else {
    const mustAttend = 3 * total - 4 * attended;
    result.textContent =
      "🚨 Attendance " + percent.toFixed(1) + "%. Danger zone! Attend the next " +
      mustAttend + " class(es) without skipping to reach 75%.";
  }
});