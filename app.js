// app.js — Nexus Salon (Firestore, PIN, páginas + Caja + PWA)

/* ========== CONFIG FIREBASE ========== */
const firebaseConfig = {
  apiKey: "AIzaSyCCYTfZGh_Cmtb4Qx4JT9Sma5Wf5BDzIdI",
  authDomain: "nexus-salon.firebaseapp.com",
  projectId: "nexus-salon",
  storageBucket: "nexus-salon.firebasestorage.app", // no usamos Storage
  messagingSenderId: "104208041652",
  appId: "1:104208041652:web:c717c5fff3617b29d8f9e1"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

/* ========== ESTADO LOCAL ========== */
const LOCAL_KEY = "nexus_salon_state_v3";

let state = {
  pin: "1234",
  appName: "Nexus Salon",
  logoUrl: "",
  pdfHeaderText: "",
  pdfFooterText: "",
  footerText: "© 2025 Nexus Salon — Sistema de tickets",
  tickets: [],
  user: null,
  unsubscribeTickets: null
};

function loadState() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
    }
  } catch (e) {
    console.error("Error leyendo localStorage", e);
  }
}

function saveState() {
  const copy = { ...state };
  delete copy.user;
  delete copy.unsubscribeTickets;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(copy));
}

/* ========== DOM ========== */
// vistas
const pinScreen = document.getElementById("pinScreen");
const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");

// PIN
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");
const pinEnterBtn = document.getElementById("pinEnterBtn");

// Auth
const googleSignInBtn = document.getElementById("googleSignInBtn");
const authBackToPinBtn = document.getElementById("authBackToPinBtn");

// nav / topbar
const appNameEditable = document.getElementById("appNameEditable");
const pinAppNameTitle = document.getElementById("pinAppName");
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const appLogoImg = document.getElementById("appLogo");
const pinLogoImg = document.getElementById("pinLogo");
const footerTextSpan = document.getElementById("footerText");
const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const pages = {
  dashboard: document.getElementById("page-dashboard"),
  historial: document.getElementById("page-historial"),
  caja: document.getElementById("page-caja"),
  config: document.getElementById("page-config")
};

// dashboard form
const ticketNumberInput = document.getElementById("ticketNumber");
const ticketDateInput = document.getElementById("ticketDate");
const clientNameInput = document.getElementById("clientName");
const technicianSelect = document.getElementById("technician");
const technicianCustomInput = document.getElementById("technicianCustom");
const paymentMethodSelect = document.getElementById("paymentMethod");
const serviceDescInput = document.getElementById("serviceDesc");
const quantityInput = document.getElementById("quantity");
const unitPriceInput = document.getElementById("unitPrice");
const tipAmountInput = document.getElementById("tipAmount");
const totalAmountInput = document.getElementById("totalAmount");
const newTicketBtn = document.getElementById("newTicketBtn");
const saveTicketBtn = document.getElementById("saveTicketBtn");
const formMessage = document.getElementById("formMessage");

// historial
const ticketsTableBody = document.getElementById("ticketsTableBody");
const filterStartInput = document.getElementById("filterStart");
const filterEndInput = document.getElementById("filterEnd");
const filterTechSelect = document.getElementById("filterTech");
const applyFilterBtn = document.getElementById("applyFilterBtn");
const clearFilterBtn = document.getElementById("clearFilterBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const backupJsonBtn = document.getElementById("backupJsonBtn");

// config
const logoUrlInput = document.getElementById("logoUrlInput");
const pdfHeaderTextArea = document.getElementById("pdfHeaderText");
const pdfFooterTextArea = document.getElementById("pdfFooterText");
const footerTextInput = document.getElementById("footerTextInput");
const newPinInput = document.getElementById("newPinInput");
const changePinBtn = document.getElementById("changePinBtn");
const pinChangeMessage = document.getElementById("pinChangeMessage");
const saveBrandingBtn = document.getElementById("saveBrandingBtn");
const brandingStatus = document.getElementById("brandingStatus");

// caja
const cajaStartInput = document.getElementById("cajaStart");
const cajaEndInput = document.getElementById("cajaEnd");
const cajaApplyBtn = document.getElementById("cajaApplyBtn");
const cajaClearBtn = document.getElementById("cajaClearBtn");
const cajaTotalCashSpan = document.getElementById("cajaTotalCash");
const cajaTotalAthSpan = document.getElementById("cajaTotalAth");
const cajaTotalCardSpan = document.getElementById("cajaTotalCard");
const cajaTotalAllSpan = document.getElementById("cajaTotalAll");

/* ========== RENDER ==========
   (branding + tickets + número + caja) */
function renderBranding() {
  appNameEditable.textContent = state.appName || "Nexus Salon";
  pinAppNameTitle.textContent = state.appName || "Nexus Salon";

  logoUrlInput.value = state.logoUrl || "";
  pdfHeaderTextArea.value = state.pdfHeaderText || "";
  pdfFooterTextArea.value = state.pdfFooterText || "";
  footerTextInput.value = state.footerText || "© 2025 Nexus Salon — Sistema de tickets";
  footerTextSpan.textContent = state.footerText || "© 2025 Nexus Salon — Sistema de tickets";

  const logoSrc = state.logoUrl && state.logoUrl.trim() !== ""
    ? state.logoUrl.trim()
    : "assets/logo.png";
  appLogoImg.src = logoSrc;
  pinLogoImg.src = logoSrc;
}

function nextTicketNumber() {
  if (!state.tickets.length) return 1;
  const max = state.tickets.reduce(
    (m, t) => Math.max(m, Number(t.number || 0)),
    0
  );
  return max + 1;
}

function renderTicketNumber() {
  ticketNumberInput.value = nextTicketNumber();
}

function renderTicketsTable(listOverride) {
  const list = listOverride || state.tickets;
  ticketsTableBody.innerHTML = "";
  list
    .slice()
    .sort((a, b) => (a.number || 0) - (b.number || 0))
    .forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.number || ""}</td>
        <td>${t.date || ""}</td>
        <td>${t.clientName || ""}</td>
        <td>${t.technician || ""}</td>
        <td>${t.serviceDesc || ""}</td>
        <td>${t.paymentMethod || ""}</td>
        <td>$${Number(t.totalAmount || 0).toFixed(2)}</td>
      `;
      ticketsTableBody.appendChild(tr);
    });
}

/* CAJA: totales por método */
function computeCajaTotals() {
  const start = cajaStartInput.value;
  const end = cajaEndInput.value;

  let efectivo = 0;
  let ath = 0;
  let tarjeta = 0;

  state.tickets.forEach((t) => {
    if (!t.date) return;
    if (start && t.date < start) return;
    if (end && t.date > end) return;

    const total = Number(t.totalAmount || 0);
    if (t.paymentMethod === "Efectivo") efectivo += total;
    else if (t.paymentMethod === "ATH Móvil") ath += total;
    else if (t.paymentMethod === "Tarjeta") tarjeta += total;
  });

  const all = efectivo + ath + tarjeta;

  cajaTotalCashSpan.textContent = `$${efectivo.toFixed(2)}`;
  cajaTotalAthSpan.textContent = `$${ath.toFixed(2)}`;
  cajaTotalCardSpan.textContent = `$${tarjeta.toFixed(2)}`;
  cajaTotalAllSpan.textContent = `$${all.toFixed(2)}`;
}

/* ========== VISTAS / PÁGINAS ========== */
function showPinScreen() {
  pinScreen.classList.remove("hidden");
  authScreen.classList.add("hidden");
  appShell.classList.add("hidden");
  pinInput.value = "";
  pinError.textContent = "";
}

function showAuthScreen() {
  pinScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
}

function showAppShell() {
  pinScreen.classList.add("hidden");
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
}

function setActivePage(pageName) {
  Object.keys(pages).forEach((name) => {
    pages[name].classList.toggle("active-page", name === pageName);
  });
  navButtons.forEach((btn) => {
    const target = btn.getAttribute("data-page");
    btn.classList.toggle("nav-btn-active", target === pageName);
  });
}

/* ========== PIN ========== */
function handlePinEnter() {
  const v = (pinInput.value || "").trim();
  if (!v) {
    pinError.textContent = "Ingrese el PIN.";
    return;
  }
  if (v === state.pin) {
    pinError.textContent = "";
    if (state.user) {
      showAppShell();
    } else {
      showAuthScreen();
    }
  } else {
    pinError.textContent = "PIN incorrecto.";
  }
}

/* ========== AUTH GOOGLE + FIRESTORE LISTEN ========== */
function ticketsCollectionRef(uid) {
  return db.collection("users").doc(uid).collection("salonTickets");
}

function startTicketsListener(uid) {
  if (state.unsubscribeTickets) {
    state.unsubscribeTickets();
    state.unsubscribeTickets = null;
  }
  state.unsubscribeTickets = ticketsCollectionRef(uid)
    .orderBy("number", "asc")
    .onSnapshot(
      (snap) => {
        const arr = [];
        snap.forEach((doc) => arr.push(doc.data()));
        state.tickets = arr;
        saveState();
        renderTicketNumber();
        renderTicketsTable();
        computeCajaTotals();
      },
      (err) => {
        console.error("onSnapshot error", err);
      }
    );
}

async function signInWithGoogle() {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    const user = result.user;
    state.user = user;
    userEmailSpan.textContent = user.email || "";
    saveState();
    await loadBrandingFromCloud();
    startTicketsListener(user.uid);
    showAppShell();
  } catch (err) {
    console.error("Error Google SignIn", err);
    alert("No se pudo iniciar sesión con Google.");
  }
}

async function signOutAndReset() {
  try {
    await auth.signOut();
  } catch (e) {
    console.error("Error signOut", e);
  }
  if (state.unsubscribeTickets) {
    state.unsubscribeTickets();
    state.unsubscribeTickets = null;
  }
  state.user = null;
  userEmailSpan.textContent = "Sin conexión a Google";
  saveState();
  showPinScreen();
}

auth.onAuthStateChanged((user) => {
  state.user = user || null;
  if (user) {
    userEmailSpan.textContent = user.email || "";
    startTicketsListener(user.uid);
  } else {
    userEmailSpan.textContent = "Sin conexión a Google";
    if (state.unsubscribeTickets) {
      state.unsubscribeTickets();
      state.unsubscribeTickets = null;
    }
  }
});

/* ========== DASHBOARD: TICKETS ========== */
function recalcTotal() {
  const qty = Number(quantityInput.value || 0);
  const unit = Number(unitPriceInput.value || 0);
  const tip = Number(tipAmountInput.value || 0);
  const subtotal = qty * unit;
  const total = subtotal + tip;
  totalAmountInput.value = total.toFixed(2);
}

function resetFormForNewTicket() {
  const today = new Date();
  ticketDateInput.value = today.toISOString().slice(0, 10);
  clientNameInput.value = "";
  technicianSelect.value = "";
  technicianCustomInput.value = "";
  paymentMethodSelect.value = "";
  serviceDescInput.value = "";
  quantityInput.value = 1;
  unitPriceInput.value = "";
  tipAmountInput.value = "";
  recalcTotal();
  ticketNumberInput.value = nextTicketNumber();
  formMessage.textContent = "";
}

function collectTicketFromForm() {
  const number = Number(ticketNumberInput.value || 0);
  const date = ticketDateInput.value;
  const clientName = clientNameInput.value.trim();
  const techPre = technicianSelect.value;
  const techCustom = technicianCustomInput.value.trim();
  const technician = techCustom || techPre || "";
  const paymentMethod = paymentMethodSelect.value;
  const serviceDesc = serviceDescInput.value.trim();
  const quantity = Number(quantityInput.value || 0);
  const unitPrice = Number(unitPriceInput.value || 0);
  const tipAmount = Number(tipAmountInput.value || 0);
  const totalAmount = Number(totalAmountInput.value || 0);

  if (
    !number ||
    !date ||
    !clientName ||
    !technician ||
    !paymentMethod ||
    !serviceDesc ||
    quantity <= 0 ||
    unitPrice < 0
  ) {
    throw new Error("Faltan campos requeridos.");
  }

  return {
    number,
    date,
    clientName,
    technician,
    paymentMethod,
    serviceDesc,
    quantity,
    unitPrice,
    tipAmount,
    totalAmount,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

async function saveTicket() {
  if (!state.user) {
    formMessage.textContent = "Conéctate con Google antes de guardar tickets.";
    return;
  }
  try {
    const ticket = collectTicketFromForm();
    await ticketsCollectionRef(state.user.uid)
      .doc(String(ticket.number))
      .set(ticket, { merge: true });

    formMessage.textContent =
      "Ticket guardado y sincronizado con Firebase.";
    resetFormForNewTicket();
  } catch (err) {
    console.error("Error guardando ticket", err);
    formMessage.textContent = err.message || "Error al guardar el ticket.";
  }
}

/* ========== BRANDING EN FIRESTORE (SIN STORAGE) ========== */
function brandingDocRef(uid) {
  return db.collection("users").doc(uid).collection("branding").doc("salon");
}

async function loadBrandingFromCloud() {
  if (!state.user) return;
  try {
    const snap = await brandingDocRef(state.user.uid).get();
    if (snap.exists) {
      const data = snap.data();
      if (data.appName) state.appName = data.appName;
      if (data.logoUrl !== undefined) state.logoUrl = data.logoUrl;
      if (data.pdfHeaderText !== undefined) state.pdfHeaderText = data.pdfHeaderText;
      if (data.pdfFooterText !== undefined) state.pdfFooterText = data.pdfFooterText;
      if (data.footerText !== undefined) state.footerText = data.footerText;
      saveState();
      renderBranding();
    }
  } catch (e) {
    console.error("Error cargando branding", e);
  }
}

async function saveBrandingToCloud() {
  if (!state.user) {
    brandingStatus.textContent = "Conéctate con Google para guardar branding.";
    return;
  }
  try {
    const payload = {
      appName: state.appName,
      logoUrl: state.logoUrl || "",
      pdfHeaderText: state.pdfHeaderText || "",
      pdfFooterText: state.pdfFooterText || "",
      footerText: state.footerText || ""
    };
    await brandingDocRef(state.user.uid).set(payload, { merge: true });
    brandingStatus.textContent = "Branding guardado en Firebase.";
  } catch (e) {
    console.error("Error guardando branding", e);
    brandingStatus.textContent = "Error al guardar branding.";
  }
}

/* ========== FILTROS / LISTA ========== */
function getFilteredTickets() {
  const start = filterStartInput.value;
  const end = filterEndInput.value;
  const tech = filterTechSelect.value;

  return state.tickets.filter((t) => {
    let ok = true;
    if (start && t.date < start) ok = false;
    if (end && t.date > end) ok = false;
    if (tech && t.technician !== tech) ok = false;
    return ok;
  });
}

/* ========== PDF + BACKUP JSON ========== */
function exportTicketsToPDF() {
  const jsPDFLib = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDFLib) {
    alert("La librería jsPDF no se cargó.");
    return;
  }

  const list = getFilteredTickets();
  if (!list.length) {
    alert("No hay tickets para exportar con el filtro actual.");
    return;
  }

  const doc = new jsPDFLib({ orientation: "p", unit: "mm", format: "a4" });
  const marginLeft = 12;
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(state.appName || "Nexus Salon", marginLeft, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (state.pdfHeaderText) {
    const lines = doc.splitTextToSize(state.pdfHeaderText, 180);
    doc.text(lines, marginLeft, y);
    y += lines.length * 4 + 2;
  } else {
    y += 2;
  }

  const now = new Date();
  doc.text(`Generado: ${now.toLocaleString()}`, marginLeft, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("#", marginLeft, y);
  doc.text("Fecha", marginLeft + 10, y);
  doc.text("Cliente", marginLeft + 32, y);
  doc.text("Técnica", marginLeft + 82, y);
  doc.text("Servicio", marginLeft + 112, y);
  doc.text("Método", marginLeft + 152, y);
  doc.text("Total", marginLeft + 182 - 10, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  list.forEach((t) => {
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
    doc.text(String(t.number || ""), marginLeft, y);
    doc.text(String(t.date || ""), marginLeft + 10, y);
    doc.text(String(t.clientName || "").substring(0, 18), marginLeft + 32, y);
    doc.text(String(t.technician || "").substring(0, 14), marginLeft + 82, y);
    doc.text(String(t.serviceDesc || "").substring(0, 18), marginLeft + 112, y);
    doc.text(String(t.paymentMethod || ""), marginLeft + 152, y);
    doc.text(
      `$${Number(t.totalAmount || 0).toFixed(2)}`,
      marginLeft + 182 - 10,
      y,
      { align: "right" }
    );
    y += 4;
  });

  if (state.pdfFooterText) {
    const footerLines = doc.splitTextToSize(state.pdfFooterText, 180);
    doc.setFontSize(9);
    doc.text(footerLines, marginLeft, 288);
  }

  doc.save("tickets-nexus-salon.pdf");
}

function downloadBackupJson() {
  const list = getFilteredTickets();
  if (!list.length) {
    alert("No hay tickets para exportar con el filtro actual.");
    return;
  }
  const blob = new Blob([JSON.stringify(list, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tickets-nexus-salon.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


/* ========== CAMBIAR PIN ========== */
function changePin() {
  const newPin = (newPinInput.value || "").trim();
  if (!newPin || newPin.length < 4) {
    pinChangeMessage.textContent = "El PIN debe tener al menos 4 dígitos.";
    return;
  }
  state.pin = newPin;
  saveState();
  pinChangeMessage.textContent = "PIN actualizado correctamente.";
  newPinInput.value = "";
}

/* ========== EVENTOS ========== */
pinEnterBtn.addEventListener("click", handlePinEnter);
pinInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") handlePinEnter();
});

googleSignInBtn.addEventListener("click", signInWithGoogle);
authBackToPinBtn.addEventListener("click", showPinScreen);
logoutBtn.addEventListener("click", signOutAndReset);

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const page = btn.getAttribute("data-page");
    setActivePage(page);
  });
});

appNameEditable.addEventListener("input", () => {
  state.appName = appNameEditable.textContent.trim() || "Nexus Salon";
  saveState();
  renderBranding();
});

logoUrlInput.addEventListener("input", () => {
  state.logoUrl = logoUrlInput.value.trim();
  saveState();
  renderBranding();
});

pdfHeaderTextArea.addEventListener("input", () => {
  state.pdfHeaderText = pdfHeaderTextArea.value;
  saveState();
});

pdfFooterTextArea.addEventListener("input", () => {
  state.pdfFooterText = pdfFooterTextArea.value;
  saveState();
});

footerTextInput.addEventListener("input", () => {
  state.footerText = footerTextInput.value;
  saveState();
  footerTextSpan.textContent = state.footerText;
});

saveBrandingBtn.addEventListener("click", (e) => {
  e.preventDefault();
  saveBrandingToCloud();
});

changePinBtn.addEventListener("click", (e) => {
  e.preventDefault();
  changePin();
});

newTicketBtn.addEventListener("click", (e) => {
  e.preventDefault();
  resetFormForNewTicket();
});

quantityInput.addEventListener("input", recalcTotal);
unitPriceInput.addEventListener("input", recalcTotal);
tipAmountInput.addEventListener("input", recalcTotal);

saveTicketBtn.addEventListener("click", (e) => {
  e.preventDefault();
  saveTicket();
});

applyFilterBtn.addEventListener("click", () => {
  const list = getFilteredTickets();
  renderTicketsTable(list);
});

clearFilterBtn.addEventListener("click", () => {
  filterStartInput.value = "";
  filterEndInput.value = "";
  filterTechSelect.value = "";
  renderTicketsTable();
});

/* Caja eventos */
cajaApplyBtn.addEventListener("click", () => {
  computeCajaTotals();
});

cajaClearBtn.addEventListener("click", () => {
  // "Hoy"
  const today = new Date().toISOString().slice(0, 10);
  cajaStartInput.value = today;
  cajaEndInput.value = today;
  computeCajaTotals();
});

exportPdfBtn.addEventListener("click", exportTicketsToPDF);
backupJsonBtn.addEventListener("click", downloadBackupJson);

/* ========== INIT + PWA ========== */
function init() {
  loadState();
  renderBranding();
  renderTicketNumber();
  renderTicketsTable(state.tickets);

  // filtros de caja: por defecto hoy
  const today = new Date().toISOString().slice(0, 10);
  cajaStartInput.value = today;
  cajaEndInput.value = today;
  computeCajaTotals();

  resetFormForNewTicket();
  setActivePage("dashboard");
  showPinScreen();

  // Service Worker para PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch((err) => console.error("SW error", err));
  }
}

init();
