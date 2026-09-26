import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// ─── Firebase config ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDX3p3KbhDw6M5mSkkCHPPpTWOP1l0hpSM",
  authDomain: "cvsu-lost-and-found-48294.firebaseapp.com",
  projectId: "cvsu-lost-and-found-48294",
  storageBucket: "cvsu-lost-and-found-48294.firebasestorage.app",
  messagingSenderId: "323262353430",
  appId: "1:323262353430:web:587e1d2ec49eb84adb6537",
  measurementId: "G-1CHF45VXTE",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const ticketsCollection = collection(db, "lostTickets");

// ─── Constants ──────────────────────────────────────────────────────────────
const CVSU_EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@cvsu\.edu\.ph$/i;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const adminSessionKey = "lost-found-admin-session";

// ─── Client-side rate limiter ───────────────────────────────────────────────
const rateLimiter = {
  _key(uid) { return `rl_${uid}`; },
  check(uid) {
    const now = Date.now();
    const raw = sessionStorage.getItem(this._key(uid));
    const history = raw ? JSON.parse(raw) : [];
    const recent = history.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      const earliest = Math.min(...recent);
      const waitMin = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - earliest)) / 60000);
      throw new Error(
        `You have reached the limit of ${RATE_LIMIT_MAX} submissions per hour. Please try again in ${waitMin} minute(s).`
      );
    }
    recent.push(now);
    sessionStorage.setItem(this._key(uid), JSON.stringify(recent));
  },
};

// ─── Auth state ─────────────────────────────────────────────────────────────
let currentStudentEmail = "";
let currentStudentIsVerified = false;
let currentUserIsOfficer = false;

// ─── Admin search / filter state ────────────────────────────────────────────
let adminSearchQuery = "";
let adminStatusFilter = "all";
let allTicketsCache = [];

// ─── DOM refs ───────────────────────────────────────────────────────────────
const form = document.querySelector("#lostItemForm");
const submitBtn = document.querySelector("#submitBtn");
const adminPanel = document.querySelector("#adminPanel");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminLoginMessage = document.querySelector("#adminLoginMessage");
const adminDashboard = document.querySelector("#adminDashboard");
const ticketList = document.querySelector("#ticketList");
const emptyTickets = document.querySelector("#emptyTickets");
const totalTickets = document.querySelector("#totalTickets");
const openTickets = document.querySelector("#openTickets");
const resolvedTickets = document.querySelector("#resolvedTickets");
const exportTickets = document.querySelector("#exportTickets");
const logoutAdmin = document.querySelector("#logoutAdmin");
const dataSourceLabel = document.querySelector("#dataSourceLabel");
const studentSignIn = document.querySelector("#studentSignIn");
const studentSignOut = document.querySelector("#studentSignOut");
const studentAuthMessage = document.querySelector("#studentAuthMessage");
const submitPanel = document.querySelector("#submitPanel");
const landingPanel = document.querySelector("#landingPanel");
const searchInput = document.querySelector("#adminSearchInput");
const statusFilter = document.querySelector("#adminStatusFilter");

// Modal
const successModal = document.querySelector("#successModal");
const modalTicketNumber = document.querySelector("#modalTicketNumber");
const modalSummary = document.querySelector("#modalSummary");
const modalCloseBtn = document.querySelector("#modalCloseBtn");

// ─── Flatpickr (larger, with visible month name) ────────────────────────────
flatpickr("#lostDateInput", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i",
  altInput: true,
  altFormat: "F j, Y — h:i K",
  disableMobile: true, // Force the custom picker on mobile too
  time_24hr: false,
  minuteIncrement: 15,
  maxDate: "today",
  animate: true,
});

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatDate = (value) => {
  if (!value) return "—";
  let date;
  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "object" && value?.seconds !== undefined) {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const makeTicketNumber = () => {
  const year = new Date().getFullYear();
  const randomPart = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  return `LF-${year}-${String(randomPart).padStart(5, "0")}`;
};

const isVerifiedCvsuEmail = (email) => CVSU_EMAIL_PATTERN.test(email);

const statusColor = (status) => {
  const map = { Open: "#e67e22", Reviewing: "#3498db", Matched: "#9b59b6", Solved: "#27ae60" };
  return map[status] || "var(--muted)";
};

// ─── Auth UI sync ───────────────────────────────────────────────────────────
const syncStudentAuthUi = () => {
  const emailInput = form.elements.email;
  emailInput.value = currentStudentEmail;
  submitBtn.disabled = !currentStudentIsVerified;
  studentSignIn.hidden = currentStudentIsVerified;
  studentSignOut.hidden = !currentStudentIsVerified;
  studentAuthMessage.textContent = currentStudentIsVerified
    ? `✓ Signed in as ${currentStudentEmail}`
    : "Sign in with your verified CvSU Google account before submitting a ticket.";
  studentAuthMessage.style.color = currentStudentIsVerified ? "var(--green-dark)" : "";
};

// ─── Admin helpers ──────────────────────────────────────────────────────────
const isAdminUnlocked = () => currentUserIsOfficer;
const getAdminName = () => auth.currentUser?.email || "Officer";

const makeMailLink = (ticket) => {
  const subject = `Lost and Found Update - ${ticket.ticketNumber}`;
  const body = [
    `Hello ${ticket.fullName},`,
    "",
    `This is an update about your lost item report: ${ticket.item}.`,
    `Ticket number: ${ticket.ticketNumber}`,
    "",
    "Please reply to this email if you need to add more details.",
    "",
    "CSSO & ELITS Lost and Found",
  ].join("\n");
  return `mailto:${encodeURIComponent(ticket.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const normalizeTicket = (ticket, id) => {
  const docId = id || ticket.firebaseId || ticket.id || ticket.ticketNumber;
  return {
    ...ticket,
    id: docId,
    firebaseId: docId,
    ticketNumber: ticket.ticketNumber || docId || makeTicketNumber(),
    status: ticket.status || "Open",
    submittedAt: ticket.submittedAt || new Date().toISOString(),
    updatedAt: ticket.updatedAt || ticket.submittedAt || new Date().toISOString(),
    solvedBy: ticket.solvedBy || "",
    solvedAt: ticket.solvedAt || "",
  };
};

// ─── Ticket store ────────────────────────────────────────────────────────────
const ticketStore = {
  async list() {
    const ticketsQuery = query(ticketsCollection, orderBy("submittedAt", "desc"));
    const snapshot = await getDocs(ticketsQuery);
    return snapshot.docs.map((ticketDoc) =>
      normalizeTicket(ticketDoc.data(), ticketDoc.id)
    );
  },
  async create(ticket) {
    const docRef = await addDoc(ticketsCollection, {
      ...ticket,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...ticket, firebaseId: docRef.id, id: docRef.id };
  },
  async updateTicket(ticketId, updates) {
    await updateDoc(doc(db, "lostTickets", ticketId), {
      ...updates,
      updatedAt: serverTimestamp(),
      solvedAt: updates.status === "Solved" ? serverTimestamp() : "",
    });
  },
  async delete(ticketId) {
    await deleteDoc(doc(db, "lostTickets", ticketId));
  },
};

// ─── Views ──────────────────────────────────────────────────────────────────
const showLandingView = () => {
  landingPanel.hidden = false;
  submitPanel.hidden = true;
  adminPanel.hidden = true;
};

const showSubmitView = () => {
  landingPanel.hidden = true;
  submitPanel.hidden = false;
  adminPanel.hidden = true;
};

const showAdminView = async () => {
  landingPanel.hidden = true;
  submitPanel.hidden = true;
  adminPanel.hidden = false;

  if (isAdminUnlocked()) {
    adminLoginForm.hidden = true;
    adminDashboard.hidden = false;
    await renderTickets();
    return;
  }
  adminLoginForm.hidden = false;
  adminDashboard.hidden = true;
};

const routeView = async () => {
  if (window.location.hash === "#admin") {
    await showAdminView();
    return;
  }
  if (window.location.hash === "#submit") {
    showSubmitView();
    return;
  }
  showLandingView();
};

// ─── Success modal ──────────────────────────────────────────────────────────
const showSuccessModal = (ticket) => {
  modalTicketNumber.textContent = ticket.ticketNumber;
  modalSummary.innerHTML = [
    ["Student", ticket.fullName],
    ["Program", ticket.program],
    ["Email", ticket.email],
    ["Lost at", ticket.location],
    ["Date & time", formatDate(ticket.lostDate)],
    ["Item", ticket.item],
  ]
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`
    )
    .join("");

  successModal.hidden = false;
  document.body.classList.add("modal-open");
  modalCloseBtn.focus();
};

const hideSuccessModal = () => {
  successModal.hidden = true;
  document.body.classList.remove("modal-open");
};

modalCloseBtn.addEventListener("click", hideSuccessModal);
successModal.addEventListener("click", (e) => {
  if (e.target === successModal) hideSuccessModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !successModal.hidden) hideSuccessModal();
});

// ─── Render tickets (with search + filter) ──────────────────────────────────
const filterTickets = (tickets) => {
  let result = tickets;

  // Status filter
  if (adminStatusFilter !== "all") {
    result = result.filter((t) => t.status === adminStatusFilter);
  }

  // Search
  if (adminSearchQuery) {
    const q = adminSearchQuery.toLowerCase();
    result = result.filter((t) =>
      t.ticketNumber.toLowerCase().includes(q) ||
      t.fullName.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.item.toLowerCase().includes(q) ||
      t.location.toLowerCase().includes(q) ||
      t.program.toLowerCase().includes(q)
    );
  }

  return result;
};

const renderTicketCards = (tickets) => {
  const filtered = filterTickets(tickets);

  emptyTickets.hidden = filtered.length > 0;
  if (!filtered.length && tickets.length > 0) {
    emptyTickets.textContent = "No tickets match your search or filter.";
  } else if (!tickets.length) {
    emptyTickets.textContent = "No submitted tickets yet.";
  }

  ticketList.innerHTML = filtered
    .map((ticket) => {
      const itemKey = escapeHtml(ticket.id || ticket.ticketNumber);
      const sColor = statusColor(ticket.status);
      return `
        <article class="admin-ticket" data-card-id="${itemKey}">
          <div class="ticket-info">
            <div class="ticket-header-row">
              <span class="ticket-status-badge" style="background:${sColor}">${escapeHtml(ticket.status)}</span>
              <span class="ticket-id-label">${escapeHtml(ticket.ticketNumber)}</span>
            </div>
            <h3 class="ticket-item-title">${escapeHtml(ticket.item)}</h3>
            <div class="ticket-details-grid">
              <div>
                <span class="detail-label">Student</span>
                <span class="detail-value">${escapeHtml(ticket.fullName)} · ${escapeHtml(ticket.program)}</span>
              </div>
              <div>
                <span class="detail-label">Email</span>
                <span class="detail-value">${escapeHtml(ticket.email)}</span>
              </div>
              <div>
                <span class="detail-label">Location</span>
                <span class="detail-value">${escapeHtml(ticket.location)}</span>
              </div>
              <div>
                <span class="detail-label">Lost on</span>
                <span class="detail-value">${formatDate(ticket.lostDate)}</span>
              </div>
              <div>
                <span class="detail-label">Submitted</span>
                <span class="detail-value">${formatDate(ticket.submittedAt)}</span>
              </div>
              ${ticket.solvedAt ? `
              <div>
                <span class="detail-label">Solved by</span>
                <span class="detail-value">${escapeHtml(ticket.solvedBy)} · ${formatDate(ticket.solvedAt)}</span>
              </div>` : ""}
            </div>
          </div>
          <div class="ticket-controls">
            <div class="control-group">
              <label class="control-label">Update status</label>
              <select data-ticket-status="${itemKey}">
                <option ${ticket.status === "Open" ? "selected" : ""}>Open</option>
                <option ${ticket.status === "Reviewing" ? "selected" : ""}>Reviewing</option>
                <option ${ticket.status === "Matched" ? "selected" : ""}>Matched</option>
                <option ${ticket.status === "Solved" ? "selected" : ""}>Solved</option>
              </select>
            </div>
            <div class="control-group">
              <label class="control-label">Solved by</label>
              <input
                type="text"
                data-ticket-solved-by="${itemKey}"
                value="${escapeHtml(ticket.solvedBy)}"
                placeholder="Officer name"
              />
            </div>
            <button class="action-btn save-btn" type="button" data-ticket-save="${itemKey}">
              ✓ Save
            </button>
            <a class="action-btn email-btn" href="${makeMailLink(ticket)}">✉ Email</a>
            <button class="action-btn delete-btn" type="button" data-ticket-delete="${itemKey}">
              ✕ Delete
            </button>
          </div>
        </article>
      `;
    })
    .join("");
};

const renderTickets = async () => {
  try {
    allTicketsCache = await ticketStore.list();
  } catch (error) {
    console.error("Failed to render tickets:", error);
    ticketList.innerHTML = `<p class="form-note" style="color:#b91c1c;">Unable to load tickets: ${escapeHtml(error.message)}.</p>`;
    return;
  }

  const openCount = allTicketsCache.filter((t) => t.status !== "Solved").length;
  const resolvedCount = allTicketsCache.filter((t) => t.status === "Solved").length;
  totalTickets.textContent = allTicketsCache.length;
  openTickets.textContent = openCount;
  resolvedTickets.textContent = resolvedCount;
  dataSourceLabel.textContent = "Live data · Firebase Firestore";

  renderTicketCards(allTicketsCache);
};

// Search and filter listeners
if (searchInput) {
  searchInput.addEventListener("input", () => {
    adminSearchQuery = searchInput.value.trim();
    renderTicketCards(allTicketsCache);
  });
}
if (statusFilter) {
  statusFilter.addEventListener("change", () => {
    adminStatusFilter = statusFilter.value;
    renderTicketCards(allTicketsCache);
  });
}

// ─── Auth context sync ──────────────────────────────────────────────────────
const syncAuthContext = async (user) => {
  currentStudentEmail = "";
  currentStudentIsVerified = false;
  currentUserIsOfficer = false;

  if (user) {
    const tokenResult = await user.getIdTokenResult();
    const tokenEmail = String(tokenResult.claims.email || user.email || "").trim();
    currentStudentEmail = tokenEmail;
    currentStudentIsVerified =
      tokenResult.claims.email_verified === true && isVerifiedCvsuEmail(tokenEmail);
    currentUserIsOfficer = tokenResult.claims.officer === true;
  }

  if (currentUserIsOfficer) {
    sessionStorage.setItem(adminSessionKey, currentStudentEmail || "Officer");
  } else {
    sessionStorage.removeItem(adminSessionKey);
  }

  syncStudentAuthUi();
};

onAuthStateChanged(auth, async (user) => {
  await syncAuthContext(user);
  if (window.location.hash === "#admin") {
    await showAdminView();
  }
});

// ─── Student Google sign-in (only @cvsu.edu.ph) ─────────────────────────────
studentSignIn.addEventListener("click", async () => {
  studentSignIn.disabled = true;
  studentAuthMessage.textContent = "Opening CvSU Google sign-in…";
  studentAuthMessage.style.color = "";

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: "cvsu.edu.ph" });

    const result = await signInWithPopup(auth, provider);
    const email = result.user.email || "";

    if (!isVerifiedCvsuEmail(email)) {
      await signOut(auth);
      studentAuthMessage.textContent =
        "Only @cvsu.edu.ph Google accounts are allowed. Please use your CvSU email.";
      studentAuthMessage.style.color = "#b91c1c";
      return;
    }
  } catch (error) {
    if (error.code !== "auth/popup-closed-by-user") {
      console.error("Student sign in failed:", error);
      studentAuthMessage.textContent =
        "Sign-in failed. Please use your authorized CvSU Google account.";
      studentAuthMessage.style.color = "#b91c1c";
    } else {
      studentAuthMessage.textContent =
        "Sign in with your verified CvSU Google account before submitting a ticket.";
      studentAuthMessage.style.color = "";
    }
  } finally {
    studentSignIn.disabled = false;
  }
});

studentSignOut.addEventListener("click", async () => {
  await signOut(auth);
});

// ─── Form submit (single handler) ───────────────────────────────────────────
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentStudentIsVerified) {
    studentAuthMessage.textContent =
      "Please sign in with your verified CvSU Google account first.";
    studentAuthMessage.style.color = "#b91c1c";
    return;
  }

  // Client-side rate limit
  try {
    rateLimiter.check(auth.currentUser?.uid || currentStudentEmail);
  } catch (err) {
    alert(err.message);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting ticket…";

  try {
    const ticketNumber = makeTicketNumber();
    const ticket = {
      ticketNumber,
      fullName: (form.elements.fullName?.value || "").trim(),
      program: (form.elements.program?.value || "").trim(),
      email: currentStudentEmail,
      location: (form.elements.location?.value || "").trim(),
      lostDate: (document.querySelector("#lostDateInput")?.value || form.elements.lostDate?.value || "").trim(),
      item: (form.elements.item?.value || "").trim(),
      status: "Open",
      solvedBy: "",
      solvedAt: "",
    };

    await ticketStore.create(ticket);

    // Reset form
    form.reset();
    const fpInstance = document.querySelector("#lostDateInput")?._flatpickr;
    if (fpInstance) fpInstance.clear();
    if (form.elements.email) form.elements.email.value = currentStudentEmail;

    showSuccessModal(ticket);
  } catch (err) {
    console.error("Submission failed:", err);
    alert("Unable to submit ticket: " + err.message + "\nPlease check your internet connection or Firebase rules.");
  } finally {
    submitBtn.disabled = !currentStudentIsVerified;
    submitBtn.textContent = "Submit ticket";
  }
});

// ─── Admin login ─────────────────────────────────────────────────────────────
adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(adminLoginForm);
  const email = String(data.get("adminEmail") || "").trim();
  const password = String(data.get("adminPassword") || "").trim();
  const loginButton = document.querySelector("#adminLoginBtn");

  loginButton.disabled = true;
  loginButton.textContent = "Authenticating…";
  adminLoginMessage.textContent = "Checking credentials…";
  adminLoginMessage.style.color = "var(--ink)";

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await syncAuthContext(userCredential.user);
    adminLoginMessage.textContent = currentUserIsOfficer
      ? "Dashboard unlocked."
      : "This account is not authorized as an officer.";
    adminLoginMessage.style.color = currentUserIsOfficer ? "var(--green-dark)" : "#b91c1c";
    adminLoginForm.reset();
    await showAdminView();
  } catch (error) {
    console.error("Admin sign in failed:", error);
    let message = "Invalid email or password.";
    if (["auth/user-not-found", "auth/invalid-credential", "auth/wrong-password"].includes(error.code)) {
      message = "Invalid email or password. Please verify the account in Firebase Console.";
    } else if (error.code === "auth/too-many-requests") {
      message = "Too many failed attempts. Please wait a few moments and try again.";
    } else if (error.code === "auth/network-request-failed") {
      message = "Network error. Please check your internet connection.";
    }
    adminLoginMessage.textContent = message;
    adminLoginMessage.style.color = "#b91c1c";
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Log in to dashboard";
  }
});

// ─── Admin logout ─────────────────────────────────────────────────────────────
if (logoutAdmin) {
  logoutAdmin.addEventListener("click", async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem(adminSessionKey);
      adminLoginMessage.textContent = "You have signed out.";
      adminLoginMessage.style.color = "var(--ink)";
      await showAdminView();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  });
}

// ─── Ticket list actions ──────────────────────────────────────────────────────
ticketList.addEventListener("click", async (event) => {
  const ticketIdToSave = event.target.dataset.ticketSave;
  if (ticketIdToSave) {
    const statusInput = ticketList.querySelector(`[data-ticket-status="${CSS.escape(ticketIdToSave)}"]`);
    const solvedByInput = ticketList.querySelector(`[data-ticket-solved-by="${CSS.escape(ticketIdToSave)}"]`);
    const status = statusInput.value;
    const solvedBy = status === "Solved"
      ? solvedByInput.value.trim() || getAdminName()
      : solvedByInput.value.trim();

    event.target.disabled = true;
    event.target.textContent = "Saving…";
    try {
      await ticketStore.updateTicket(ticketIdToSave, {
        status,
        solvedBy: status === "Solved" ? solvedBy : "",
      });
      await renderTickets();
    } catch (err) {
      alert("Failed to update ticket: " + err.message);
      event.target.disabled = false;
      event.target.textContent = "✓ Save";
    }
    return;
  }

  const ticketIdToDelete = event.target.dataset.ticketDelete;
  if (!ticketIdToDelete) return;
  if (!confirm("Are you sure you want to delete this ticket?")) return;

  event.target.disabled = true;
  event.target.textContent = "Deleting…";
  try {
    await ticketStore.delete(ticketIdToDelete);
    await renderTickets();
  } catch (err) {
    alert("Failed to delete ticket: " + err.message);
    event.target.disabled = false;
    event.target.textContent = "✕ Delete";
  }
});

// ─── Export CSV ───────────────────────────────────────────────────────────────
exportTickets.addEventListener("click", async () => {
  let tickets = [];
  try {
    tickets = await ticketStore.list();
  } catch (err) {
    alert("Unable to export tickets: " + err.message);
    return;
  }

  const headers = [
    "Ticket ID", "Full Name", "Year and Program", "CvSU Email",
    "Location", "Lost Date", "Item", "Status",
    "Submitted At", "Solved By", "Solved At",
  ];
  const rows = tickets.map((t) => [
    t.ticketNumber, t.fullName, t.program, t.email, t.location,
    formatDate(t.lostDate), t.item, t.status,
    formatDate(t.submittedAt), t.solvedBy, formatDate(t.solvedAt),
  ]);
  const safeCsvCell = (value) => {
    const text = String(value || "");
    const guardedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${guardedText.replaceAll('"', '""')}"`;
  };
  const csv = [headers, ...rows].map((row) => row.map(safeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lost-and-found-tickets.csv";
  link.click();
  URL.revokeObjectURL(url);
});

// ─── Navigation ───────────────────────────────────────────────────────────────
document.querySelector("#backFromSubmit").addEventListener("click", (e) => {
  e.preventDefault();
  history.pushState(null, "", "#");
  showLandingView();
});
document.querySelector("#backFromAdmin").addEventListener("click", (e) => {
  e.preventDefault();
  history.pushState(null, "", "#");
  showLandingView();
});

window.addEventListener("hashchange", routeView);
routeView();
