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
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAHuTDSZxcZ3J8xVKgXMVkpETs3H02dGeA",
  authDomain: "cvsu-lost-and-found-48294.firebaseapp.com",
  projectId: "cvsu-lost-and-found-48294",
  storageBucket: "cvsu-lost-and-found-48294.firebasestorage.app",
  messagingSenderId: "323262353430",
  appId: "1:323262353430:web:d882841cc52a5d97db6537",
  measurementId: "G-BF1H11LKEM",
};

// Initialize Firebase services
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const ticketsCollection = collection(db, "lostTickets");

const DATA_MODE = "firebase";
const CVSU_EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@cvsu\.edu\.ph$/;

const form = document.querySelector("#lostItemForm");
const successPanel = document.querySelector("#successPanel");
const ticketId = document.querySelector("#ticketId");
const submitPanel = document.querySelector("#submitPanel");
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
const ticketsKey = "lost-found-tickets";
const adminSessionKey = "lost-found-admin-session";

// Initialize beautiful date picker
flatpickr("input[name='lostDate']", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i",
  altInput: true,
  altFormat: "F j, Y h:i K", // Display format e.g. September 22, 2026 12:00 AM
  placeholder: "Select date and time...",
});

const previewFields = {
  fullName: document.querySelector("#previewName"),
  program: document.querySelector("#previewProgram"),
  email: document.querySelector("#previewEmail"),
  location: document.querySelector("#previewLocation"),
  lostDate: document.querySelector("#previewDate"),
  item: document.querySelector("#previewItem"),
};

const formatDate = (value) => {
  if (!value) return "-";

  let date;
  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "object" && value?.seconds !== undefined) {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "-";

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

  return `mailto:${encodeURIComponent(ticket.email)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
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

const getLocalTickets = () => JSON.parse(localStorage.getItem(ticketsKey) || "[]");

const saveLocalTickets = (tickets) => {
  localStorage.setItem(ticketsKey, JSON.stringify(tickets));
};

const ticketStore = {
  async list() {
    if (DATA_MODE === "local") {
      return getLocalTickets().map((t) => normalizeTicket(t));
    }

    const ticketsQuery = query(ticketsCollection, orderBy("submittedAt", "desc"));
    const snapshot = await getDocs(ticketsQuery);

    return snapshot.docs.map((ticketDoc) =>
      normalizeTicket(ticketDoc.data(), ticketDoc.id),
    );
  },

  async create(ticket) {
    if (DATA_MODE === "local") {
      const tickets = getLocalTickets();
      tickets.unshift(ticket);
      saveLocalTickets(tickets);
      return ticket;
    }

    const docRef = await addDoc(ticketsCollection, {
      ...ticket,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { ...ticket, firebaseId: docRef.id, id: docRef.id };
  },

  async updateTicket(ticketId, updates) {
    if (DATA_MODE === "local") {
      const tickets = getLocalTickets().map((t) => normalizeTicket(t)).map((ticket) =>
        ticket.id === ticketId || ticket.ticketNumber === ticketId
          ? { ...ticket, ...updates, updatedAt: new Date().toISOString() }
          : ticket,
      );

      saveLocalTickets(tickets);
      return;
    }

    await updateDoc(doc(db, "lostTickets", ticketId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(ticketId) {
    if (DATA_MODE === "local") {
      const tickets = getLocalTickets().map((t) => normalizeTicket(t)).filter(
        (ticket) => ticket.id !== ticketId && ticket.ticketNumber !== ticketId,
      );
      saveLocalTickets(tickets);
      return;
    }

    await deleteDoc(doc(db, "lostTickets", ticketId));
  },
};

const updatePreview = () => {
  const data = new FormData(form);

  previewFields.fullName.textContent =
    data.get("fullName") || "Waiting for details";
  previewFields.program.textContent = data.get("program") || "-";
  previewFields.email.textContent = data.get("email") || "-";
  previewFields.location.textContent = data.get("location") || "-";
  previewFields.lostDate.textContent = formatDate(data.get("lostDate"));
  previewFields.item.textContent = data.get("item") || "-";
};

const validateCvsuEmail = () => {
  const emailInput = form.elements.email;
  const email = emailInput.value.trim();

  if (!email || CVSU_EMAIL_PATTERN.test(email)) {
    emailInput.setCustomValidity("");
    return true;
  }

  emailInput.setCustomValidity("Please use your official CvSU email ending in @cvsu.edu.ph.");
  return false;
};

const isAdminUnlocked = () => Boolean(auth.currentUser || sessionStorage.getItem(adminSessionKey));

const getAdminName = () => auth.currentUser?.email || sessionStorage.getItem(adminSessionKey) || "Officer";

const showPublicView = () => {
  submitPanel.hidden = false;
  adminPanel.hidden = true;
};

const showAdminView = async () => {
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

  showPublicView();
};

const renderTickets = async () => {
  let tickets = [];
  try {
    tickets = await ticketStore.list();
  } catch (error) {
    console.error("Failed to render tickets:", error);
    ticketList.innerHTML = `<p class="form-note" style="color: #b91c1c;">Unable to load tickets: ${escapeHtml(
      error.message,
    )}. Please ensure you are logged in as an authorized admin officer and Firestore rules are set.</p>`;
    return;
  }

  const openCount = tickets.filter((ticket) => ticket.status !== "Solved").length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === "Solved").length;

  totalTickets.textContent = tickets.length;
  openTickets.textContent = openCount;
  resolvedTickets.textContent = resolvedCount;
  emptyTickets.hidden = tickets.length > 0;
  dataSourceLabel.textContent =
    DATA_MODE === "local" ? "Demo data: this browser only" : "Live data: Firebase Firestore";

  ticketList.innerHTML = tickets
    .map((ticket) => {
      const itemKey = escapeHtml(ticket.id || ticket.ticketNumber);
      return `
        <article class="admin-ticket" data-card-id="${itemKey}">
          <div>
            <h3>${escapeHtml(ticket.ticketNumber)} - ${escapeHtml(ticket.item)}</h3>
            <p><strong>${escapeHtml(ticket.fullName)}</strong> - ${escapeHtml(ticket.program)}</p>
            <p>${escapeHtml(ticket.email)}</p>
            <p>Lost at ${escapeHtml(ticket.location)} on ${formatDate(ticket.lostDate)}</p>
            <div class="admin-ticket-meta">
              <span>${escapeHtml(ticket.status)}</span>
              <span>Submitted ${formatDate(ticket.submittedAt)}</span>
              ${
                ticket.solvedAt
                  ? `<span>Solved by ${escapeHtml(ticket.solvedBy)} on ${formatDate(ticket.solvedAt)}</span>`
                  : ""
              }
            </div>
          </div>
          <div class="ticket-actions">
            <select data-ticket-status="${itemKey}" aria-label="Ticket status for ${escapeHtml(ticket.ticketNumber)}">
              <option ${ticket.status === "Open" ? "selected" : ""}>Open</option>
              <option ${ticket.status === "Reviewing" ? "selected" : ""}>Reviewing</option>
              <option ${ticket.status === "Matched" ? "selected" : ""}>Matched</option>
              <option ${ticket.status === "Solved" ? "selected" : ""}>Solved</option>
            </select>
            <input
              type="text"
              data-ticket-solved-by="${itemKey}"
              value="${escapeHtml(ticket.solvedBy)}"
              placeholder="Solved by"
              aria-label="Solved by for ${escapeHtml(ticket.ticketNumber)}"
            />
            <button class="secondary-button" type="button" data-ticket-save="${itemKey}">
              Save status
            </button>
            <a class="secondary-link" href="${makeMailLink(ticket)}">Email student</a>
            <button class="secondary-button" type="button" data-ticket-delete="${itemKey}">
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join("");
};

// Sync UI when auth state changes (e.g. login, logout, refresh)
onAuthStateChanged(auth, async (user) => {
  if (user) {
    sessionStorage.setItem(adminSessionKey, user.email || "Officer");
  } else {
    sessionStorage.removeItem(adminSessionKey);
  }

  if (window.location.hash === "#admin") {
    await showAdminView();
  }
});

form.addEventListener("input", updatePreview);
form.addEventListener("change", updatePreview); // Added for Flatpickr compatibility
form.elements.email.addEventListener("input", validateCvsuEmail);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  validateCvsuEmail();
  if (!form.reportValidity()) return;

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Submitting ticket...";

  try {
    updatePreview();

    const data = new FormData(form);
    const ticketNumber = makeTicketNumber();
    const ticket = {
      ticketNumber,
      fullName: String(data.get("fullName") || "").trim(),
      program: String(data.get("program") || "").trim(),
      email: String(data.get("email") || "").trim(),
      location: String(data.get("location") || "").trim(),
      lostDate: data.get("lostDate"),
      item: String(data.get("item") || "").trim(),
      status: "Open",
      solvedBy: "",
      solvedAt: "",
    };

    await ticketStore.create(ticket);

    ticketId.textContent = ticketNumber;
    successPanel.hidden = false;
    form.reset();
  } catch (err) {
    console.error("Submission failed:", err);
    alert("Unable to submit ticket: " + err.message + "\nPlease check internet connection or Firebase rules.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit ticket";
  }
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(adminLoginForm);
  const email = String(data.get("adminEmail") || "").trim();
  const password = String(data.get("adminPassword") || "").trim();
  const loginButton = document.querySelector("#adminLoginBtn");

  loginButton.disabled = true;
  loginButton.textContent = "Authenticating...";
  adminLoginMessage.textContent = "Checking credentials...";
  adminLoginMessage.style.color = "var(--ink)";

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    sessionStorage.setItem(adminSessionKey, userCredential.user.email || email);
    adminLoginMessage.textContent = "Dashboard unlocked.";
    adminLoginMessage.style.color = "var(--green-dark)";
    adminLoginForm.reset();
    await showAdminView();
  } catch (error) {
    console.error("Admin sign in failed:", error);
    let message = "Invalid email or password.";
    if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
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

ticketList.addEventListener("click", async (event) => {
  const ticketIdToSave = event.target.dataset.ticketSave;
  if (ticketIdToSave) {
    const statusInput = ticketList.querySelector(
      `[data-ticket-status="${CSS.escape(ticketIdToSave)}"]`,
    );
    const solvedByInput = ticketList.querySelector(
      `[data-ticket-solved-by="${CSS.escape(ticketIdToSave)}"]`,
    );
    const status = statusInput.value;
    const solvedBy =
      status === "Solved"
        ? solvedByInput.value.trim() || getAdminName()
        : solvedByInput.value.trim();
    const solvedAt = status === "Solved" ? new Date().toISOString() : "";

    event.target.disabled = true;
    event.target.textContent = "Saving...";

    try {
      await ticketStore.updateTicket(ticketIdToSave, {
        status,
        solvedBy: status === "Solved" ? solvedBy : "",
        solvedAt,
      });
      await renderTickets();
    } catch (err) {
      alert("Failed to update ticket: " + err.message);
      event.target.disabled = false;
      event.target.textContent = "Save status";
    }
    return;
  }

  const ticketIdToDelete = event.target.dataset.ticketDelete;
  if (!ticketIdToDelete) return;

  if (!confirm("Are you sure you want to delete this ticket?")) return;

  event.target.disabled = true;
  event.target.textContent = "Deleting...";

  try {
    await ticketStore.delete(ticketIdToDelete);
    await renderTickets();
  } catch (err) {
    alert("Failed to delete ticket: " + err.message);
    event.target.disabled = false;
    event.target.textContent = "Delete";
  }
});

exportTickets.addEventListener("click", async () => {
  let tickets = [];
  try {
    tickets = await ticketStore.list();
  } catch (err) {
    alert("Unable to export tickets: " + err.message);
    return;
  }

  const headers = [
    "Ticket ID",
    "Full Name",
    "Year and Program",
    "CvSU Email",
    "Location",
    "Lost Date",
    "Item",
    "Status",
    "Submitted At",
    "Solved By",
    "Solved At",
  ];
  const rows = tickets.map((ticket) => [
    ticket.ticketNumber,
    ticket.fullName,
    ticket.program,
    ticket.email,
    ticket.location,
    formatDate(ticket.lostDate),
    ticket.item,
    ticket.status,
    formatDate(ticket.submittedAt),
    ticket.solvedBy,
    formatDate(ticket.solvedAt),
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "lost-and-found-tickets.csv";
  link.click();
  URL.revokeObjectURL(url);
});

window.addEventListener("hashchange", routeView);
routeView();
