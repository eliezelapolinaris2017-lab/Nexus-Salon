// app.js — Nexus Salon (Firestore, PIN, páginas + Caja + PWA)

/* ========== CONFIG FIREBASE ========== */
const firebaseConfig = {
  apiKey: "AIzaSyCCYTfZGh_Cmtb4Qx4JT9Sma5Wf5BDzIdI",
  authDomain: "nexus-salon.firebaseapp.com",
  projectId: "nexus-salon",
  storageBucket: "nexus-salon.firebasestorage.app",
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
  commissionRates: {
    Cynthia: 40,
    Carmen: 35,
    Yerika: 35,
    default: 30
  },
  user: null,
  unsubscribeTickets: null
};

let currentEditingNumber = null;

function loadState() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
      if (!state.commissionRates) {
        state.commissionRates = { Cynthia: 40, Carmen: 35, Yerika: 35, default: 30 };
      }
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

/* ========== FIRESTORE: REFERENCIAS COMPARTIDAS ========== */
function ticketsCollectionRef() {
  return db.collection("salonTickets");
}
function brandingDocRef() {
  return db.collection("branding").doc("salon");
}

/* ========== DOM ========== */
const pinScreen = document.getElementById("pinScreen");
const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");

const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");
const pinEnterBtn = document.getElementById("pinEnterBtn");

const googleSignInBtn = document.getElementById("googleSignInBtn");
const authBackToPinBtn = document.getElementById("authBackToPinBtn");

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
  config: document.getElementById("page-config"),
  comisiones: document.getElementById("page-comisiones"),
  propinas: document.getElementById("page-propinas"),
  retenciones: document.getElementById("page-retenciones")
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

const commissionCynthiaInput = document.getElementById("commissionCynthia");
const commissionCarmenInput = document.getElementById("commissionCarmen");
const commissionYerikaInput = document.getElementById("commissionYerika");
const commissionDefaultInput = document.getElementById("commissionDefault");

// caja
const cajaStartInput = document.getElementById("cajaStart");
const cajaEndInput = document.getElementById("cajaEnd");
const cajaApplyBtn = document.getElementById("cajaApplyBtn");
const cajaClearBtn = document.getElementById("cajaClearBtn");
const cajaTotalCashSpan = document.getElementById("cajaTotalCash");
const cajaTotalAthSpan = document.getElementById("cajaTotalAth");
const cajaTotalCardSpan = document.getElementById("cajaTotalCard");
const cajaTotalAllSpan = document.getElementById("cajaTotalAll");

// comisiones
const comiStartInput = document.getElementById("comiStart");
const comiEndInput = document.getElementById("comiEnd");
const comiTechSelect = document.getElementById("comiTech");
const comiApplyBtn = document.getElementById("comiApplyBtn");
const comiClearBtn = document.getElementById("comiClearBtn");
const comiTableBody = document.getElementById("comiTableBody");
const comiTotalSpan = document.getElementById("comiTotal");

// propinas
const tipsStartInput = document.getElementById("tipsStart");
const tipsEndInput = document.getElementById("tipsEnd");
const tipsTechSelect = document.getElementById("tipsTech");
const tipsGroupSelect = document.getElementById("tipsGroup");
const tipsApplyBtn = document.getElementById("tipsApplyBtn");
const tipsClearBtn = document.getElementById("tipsClearBtn");
const tipsTableBody = document.getElementById("tipsTableBody");
const tipsTotalSpan = document.getElementById("tipsTotal");

// retenciones
const retenStartInput = document.getElementById("retenStart");
const retenEndInput = document.getElementById("retenEnd");
const retenTechSelect = document.getElementById("retenTech");
const retenApplyBtn = document.getElementById("retenApplyBtn");
const retenClearBtn = document.getElementById("retenClearBtn");
const retenTableBody = document.getElementById("retenTableBody");
const retenTotalSpan = document.getElementById("retenTotal");

/* ========== HELPERS ==========
   comisión SOLO sobre servicio: qty * unitPrice (NO incluye tip) */
function serviceSubtotal(t) {
  const q = Number(t.quantity || 0);
  const u = Number(t.unitPrice || 0);
  const s = q * u;
  return isFinite(s) ? s : 0;
}

function getCommissionRateForTech(tech) {
  if (!state.commissionRates) return 0;
  if (tech && state.commissionRates[tech] != null) return Number(state.commissionRates[tech]) || 0;
  return Number(state.commissionRates.default) || 0;
}

/* ========== RENDER (branding + tickets + caja) ========== */
function renderBranding() {
  appNameEditable.textContent = state.appName || "Nexus Salon";
  pinAppNameTitle.textContent = state.appName || "Nexus Salon";

  logoUrlInput.value = state.logoUrl || "";
  pdfHeaderTextArea.value = state.pdfHeaderText || "";
  pdfFooterTextArea.value = state.pdfFooterText || "";
  footerTextInput.value = state.footerText || "© 2025 Nexus Salon — Sistema de tickets";
  footerTextSpan.textContent = state.footerText || "© 2025 Nexus Salon — Sistema de tickets";

  const logoSrc = state.logoUrl && state.logoUrl.trim() !== "" ? state.logoUrl.trim() : "assets/logo.png";
  appLogoImg.src = logoSrc;
  pinLogoImg.src = logoSrc;

  if (commissionCynthiaInput) commissionCynthiaInput.value = state.commissionRates?.Cynthia ?? 40;
  if (commissionCarmenInput) commissionCarmenInput.value = state.commissionRates?.Carmen ?? 35;
  if (commissionYerikaInput) commissionYerikaInput.value = state.commissionRates?.Yerika ?? 35;
  if (commissionDefaultInput) commissionDefaultInput.value = state.commissionRates?.default ?? 30;
}

function nextTicketNumber() {
  if (!state.tickets.length) return 1;
  const max = state.tickets.reduce((m, t) => Math.max(m, Number(t.number || 0)), 0);
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
        <td>
          <button class="btn-table edit" data-action="edit" data-number="${t.number}">Editar</button>
          <button class="btn-table delete" data-action="delete" data-number="${t.number}">X</button>
        </td>
      `;
      ticketsTableBody.appendChild(tr);
    });
}

function computeCajaTotals() {
  const start = cajaStartInput.value;
  const end = cajaEndInput.value;

  let efectivo = 0, ath = 0, tarjeta = 0;

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

/* ========== COMISIONES (SIN PROPINA) ========== */
function getFilteredTicketsForCommissions() {
  const start = comiStartInput ? comiStartInput.value : "";
  const end = comiEndInput ? comiEndInput.value : "";
  const tech = comiTechSelect ? comiTechSelect.value : "";

  return state.tickets.filter((t) => {
    if (!t.date) return false;
    if (start && t.date < start) return false;
    if (end && t.date > end) return false;
    if (tech && t.technician !== tech) return false;
    return true;
  });
}

function renderCommissionsSummary() {
  if (!comiTableBody || !comiTotalSpan) return;

  let list = getFilteredTicketsForCommissions();
  const hasFilters =
    (comiStartInput && comiStartInput.value) ||
    (comiEndInput && comiEndInput.value) ||
    (comiTechSelect && comiTechSelect.value);

  if (!list.length && !hasFilters && state.tickets.length) list = state.tickets.slice();

  const byTech = {};
  let grandCommission = 0;

  list.forEach((t) => {
    const tech = t.technician || "Sin técnica";
    const base = serviceSubtotal(t); // ✅ NO incluye tip
    const rate = getCommissionRateForTech(tech);
    const commission = (base * rate) / 100;

    if (!byTech[tech]) byTech[tech] = { technician: tech, totalSales: 0, totalCommission: 0, rate };
    byTech[tech].totalSales += base;
    byTech[tech].totalCommission += commission;
    grandCommission += commission;
  });

  const rows = Object.values(byTech).sort((a, b) => a.technician.localeCompare(b.technician));
  comiTableBody.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.technician}</td>
      <td>${row.rate.toFixed(1)}%</td>
      <td>$${row.totalSales.toFixed(2)}</td>
      <td>$${row.totalCommission.toFixed(2)}</td>
    `;
    comiTableBody.appendChild(tr);
  });

  comiTotalSpan.textContent = `$${grandCommission.toFixed(2)}`;
}

/* ========== PROPINA (TAB NUEVA) ========== */
function getWeekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getFilteredTicketsForTips() {
  const start = tipsStartInput ? tipsStartInput.value : "";
  const end = tipsEndInput ? tipsEndInput.value : "";
  const tech = tipsTechSelect ? tipsTechSelect.value : "";

  return state.tickets.filter((t) => {
    if (!t.date) return false;
    if (start && t.date < start) return false;
    if (end && t.date > end) return false;
    if (tech && t.technician !== tech) return false;
    return true;
  });
}

function renderTipsSummary() {
  if (!tipsTableBody || !tipsTotalSpan) return;

  const group = (tipsGroupSelect && tipsGroupSelect.value) ? tipsGroupSelect.value : "tech";
  const list = getFilteredTicketsForTips();

  const map = new Map();
  let totalTips = 0;

  list.forEach((t) => {
    const tip = Number(t.tipAmount || 0);
    if (!tip) return;

    let key = "Sin grupo";
    if (group === "tech") key = t.technician || "Sin técnica";
    else if (group === "day") key = t.date || "Sin fecha";
    else if (group === "week") key = t.date ? getWeekKey(t.date) : "Sin semana";

    map.set(key, (map.get(key) || 0) + tip);
    totalTips += tip;
  });

  const rows = Array.from(map.entries())
    .map(([k, v]) => ({ key: k, total: v }))
    .sort((a, b) => a.key.localeCompare(b.key));

  tipsTableBody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.key}</td>
      <td>$${r.total.toFixed(2)}</td>
    `;
    tipsTableBody.appendChild(tr);
  });

  tipsTotalSpan.textContent = `$${totalTips.toFixed(2)}`;
}

/* ========== RETENCIONES 10% (TAB NUEVA) ==========
   Retención = 10% de la comisión, Neto = Comisión - Retención */
function getFilteredTicketsForReten() {
  const start = retenStartInput ? retenStartInput.value : "";
  const end = retenEndInput ? retenEndInput.value : "";
  const tech = retenTechSelect ? retenTechSelect.value : "";

  return state.tickets.filter((t) => {
    if (!t.date) return false;
    if (start && t.date < start) return false;
    if (end && t.date > end) return false;
    if (tech && t.technician !== tech) return false;
    return true;
  });
}

function renderRetencionesSummary() {
  if (!retenTableBody || !retenTotalSpan) return;

  const list = getFilteredTicketsForReten();
  const byTech = {};
  let netGrand = 0;

  list.forEach((t) => {
    const tech = t.technician || "Sin técnica";
    const base = serviceSubtotal(t); // ✅ sin propina
    const rate = getCommissionRateForTech(tech);
    const commission = (base * rate) / 100;
    const reten = commission * 0.10;
    const net = commission - reten;

    if (!byTech[tech]) {
      byTech[tech] = { technician: tech, base: 0, rate, commission: 0, reten: 0, net: 0 };
    }
    byTech[tech].base += base;
    byTech[tech].commission += commission;
    byTech[tech].reten += reten;
    byTech[tech].net += net;
    netGrand += net;
  });

  const rows = Object.values(byTech).sort((a, b) => a.technician.localeCompare(b.technician));

  retenTableBody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.technician}</td>
      <td>$${r.base.toFixed(2)}</td>
      <td>${(r.rate ?? getCommissionRateForTech(r.technician)).toFixed(1)}%</td>
      <td>$${r.commission.toFixed(2)}</td>
      <td>$${r.reten.toFixed(2)}</td>
      <td>$${r.net.toFixed(2)}</td>
    `;
    retenTableBody.appendChild(tr);
  });

  retenTotalSpan.textContent = `$${netGrand.toFixed(2)}`;
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

  if (pageName === "comisiones") renderCommissionsSummary();
  if (pageName === "propinas") renderTipsSummary();
  if (pageName === "retenciones") renderRetencionesSummary();
}

/* ========== PIN ========== */
function handlePinEnter() {
  const v = (pinInput.value || "").trim();
  if (!v) return (pinError.textContent = "Ingrese el PIN.");
  if (v === state.pin) {
    pinError.textContent = "";
    if (state.user) showAppShell();
    else showAuthScreen();
  } else {
    pinError.textContent = "PIN incorrecto.";
  }
}

/* ========== AUTH + LISTENER ========== */
function startTicketsListener() {
  if (state.unsubscribeTickets) {
    state.unsubscribeTickets();
    state.unsubscribeTickets = null;
  }
  state.unsubscribeTickets = ticketsCollectionRef()
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
        renderCommissionsSummary();
        renderTipsSummary();
        renderRetencionesSummary();
      },
      (err) => console.error("onSnapshot error", err)
    );
}

async function signInWithGoogle() {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    state.user = result.user;
    userEmailSpan.textContent = state.user.email || "";
    saveState();
    await loadBrandingFromCloud();
    startTicketsListener();
    showAppShell();
  } catch (err) {
    console.error("Error Google SignIn", err);
    alert("No se pudo iniciar sesión con Google.");
  }
}

async function signOutAndReset() {
  try { await auth.signOut(); } catch (e) { console.error("Error signOut", e); }
  if (state.unsubscribeTickets) { state.unsubscribeTickets(); state.unsubscribeTickets = null; }
  state.user = null;
  userEmailSpan.textContent = "Sin conexión a Google";
  saveState();
  showPinScreen();
}

auth.onAuthStateChanged((user) => {
  state.user = user || null;
  if (user) {
    userEmailSpan.textContent = user.email || "";
    startTicketsListener();
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
  currentEditingNumber = null;
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

  if (!number || !date || !clientName || !technician || !paymentMethod || !serviceDesc || quantity <= 0 || unitPrice < 0) {
    throw new Error("Faltan campos requeridos.");
  }

  return {
    number, date, clientName, technician, paymentMethod, serviceDesc,
    quantity, unitPrice, tipAmount, totalAmount,
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
    const docId = String(ticket.number);

    await ticketsCollectionRef().doc(docId).set(ticket, { merge: true });

    formMessage.textContent = currentEditingNumber
      ? "Ticket actualizado correctamente."
      : "Ticket guardado y sincronizado con Firebase.";

    currentEditingNumber = null;
    resetFormForNewTicket();
  } catch (err) {
    console.error("Error guardando ticket", err);
    formMessage.textContent = err.message || "Error al guardar el ticket.";
  }
}

/* ========== BRANDING EN FIRESTORE (COMPARTIDO) ========== */
async function loadBrandingFromCloud() {
  if (!state.user) return;
  try {
    const snap = await brandingDocRef().get();
    if (snap.exists) {
      const data = snap.data();
      if (data.appName) state.appName = data.appName;
      if (data.logoUrl !== undefined) state.logoUrl = data.logoUrl;
      if (data.pdfHeaderText !== undefined) state.pdfHeaderText = data.pdfHeaderText;
      if (data.pdfFooterText !== undefined) state.pdfFooterText = data.pdfFooterText;
      if (data.footerText !== undefined) state.footerText = data.footerText;
      if (data.commissionRates !== undefined) {
        state.commissionRates = {
          Cynthia: data.commissionRates.Cynthia ?? 40,
          Carmen: data.commissionRates.Carmen ?? 35,
          Yerika: data.commissionRates.Yerika ?? 35,
          default: data.commissionRates.default ?? 30
        };
      }
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
      footerText: state.footerText || "",
      commissionRates: state.commissionRates || { Cynthia: 40, Carmen: 35, Yerika: 35, default: 30 }
    };
    await brandingDocRef().set(payload, { merge: true });
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
    if (!t.date) return false;
    if (start && t.date < start) return false;
    if (end && t.date > end) return false;
    if (tech && t.technician !== tech) return false;
    return true;
  });
}

/* ========== PDF + BACKUP JSON (igual que el tuyo) ========== */
function exportTicketsToPDF() {
  const jsPDFLib = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDFLib) return alert("La librería jsPDF no se cargó.");

  const list = getFilteredTickets();
  if (!list.length) return alert("No hay tickets para exportar con el filtro actual.");

  const doc = new jsPDFLib({ orientation: "p", unit: "mm", format: "a4" });
  const marginLeft = 12;

  const col = { num: marginLeft, date: marginLeft + 12, client: marginLeft + 38, tech: marginLeft + 80, service: marginLeft + 112, method: marginLeft + 150, total: 200 };
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
  } else y += 2;

  const now = new Date();
  doc.text(`Generado: ${now.toLocaleString()}`, marginLeft, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("#", col.num, y);
  doc.text("Fecha", col.date, y);
  doc.text("Cliente", col.client, y);
  doc.text("Técnica", col.tech, y);
  doc.text("Servicio", col.service, y);
  doc.text("Método", col.method, y);
  doc.text("Total", col.total, y, { align: "right" });
  y += 4;

  doc.setFont("helvetica", "normal");

  let grandTotal = 0;

  list.forEach((t) => {
    if (y > 270) { doc.addPage(); y = 14; }

    const total = Number(t.totalAmount || 0);
    grandTotal += total;

    doc.text(String(t.number || ""), col.num, y);
    doc.text(String(t.date || ""), col.date, y);
    doc.text(String(t.clientName || "").substring(0, 18), col.client, y);
    doc.text(String(t.technician || "").substring(0, 14), col.tech, y);
    doc.text(String(t.serviceDesc || "").substring(0, 20), col.service, y);
    doc.text(String(t.paymentMethod || ""), col.method, y);
    doc.text(`$${total.toFixed(2)}`, col.total, y, { align: "right" });
    y += 4;
  });

  if (y > 260) { doc.addPage(); y = 20; }
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`GRAN TOTAL: $${grandTotal.toFixed(2)}`, marginLeft, y);

  if (state.pdfFooterText) {
    const footerLines = doc.splitTextToSize(state.pdfFooterText, 180);
    doc.setFontSize(9);
    doc.text(footerLines, marginLeft, 288);
  }

  doc.save("tickets-nexus-salon.pdf");
}

function downloadBackupJson() {
  const list = getFilteredTickets();
  if (!list.length) return alert("No hay tickets para exportar con el filtro actual.");

  const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
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
pinInput.addEventListener("keyup", (e) => { if (e.key === "Enter") handlePinEnter(); });

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

pdfHeaderTextArea.addEventListener("input", () => { state.pdfHeaderText = pdfHeaderTextArea.value; saveState(); });
pdfFooterTextArea.addEventListener("input", () => { state.pdfFooterText = pdfFooterTextArea.value; saveState(); });

footerTextInput.addEventListener("input", () => {
  state.footerText = footerTextInput.value;
  saveState();
  footerTextSpan.textContent = state.footerText;
});

saveBrandingBtn.addEventListener("click", (e) => { e.preventDefault(); saveBrandingToCloud(); });

if (commissionCynthiaInput) commissionCynthiaInput.addEventListener("input", () => { state.commissionRates.Cynthia = Number(commissionCynthiaInput.value || 0); saveState(); });
if (commissionCarmenInput) commissionCarmenInput.addEventListener("input", () => { state.commissionRates.Carmen = Number(commissionCarmenInput.value || 0); saveState(); });
if (commissionYerikaInput) commissionYerikaInput.addEventListener("input", () => { state.commissionRates.Yerika = Number(commissionYerikaInput.value || 0); saveState(); });
if (commissionDefaultInput) commissionDefaultInput.addEventListener("input", () => { state.commissionRates.default = Number(commissionDefaultInput.value || 0); saveState(); });

changePinBtn.addEventListener("click", (e) => { e.preventDefault(); changePin(); });

newTicketBtn.addEventListener("click", (e) => { e.preventDefault(); resetFormForNewTicket(); });

quantityInput.addEventListener("input", recalcTotal);
unitPriceInput.addEventListener("input", recalcTotal);
tipAmountInput.addEventListener("input", recalcTotal);

saveTicketBtn.addEventListener("click", (e) => { e.preventDefault(); saveTicket(); });

applyFilterBtn.addEventListener("click", () => { renderTicketsTable(getFilteredTickets()); });
clearFilterBtn.addEventListener("click", () => {
  filterStartInput.value = "";
  filterEndInput.value = "";
  filterTechSelect.value = "";
  renderTicketsTable();
});

cajaApplyBtn.addEventListener("click", () => computeCajaTotals());
cajaClearBtn.addEventListener("click", () => {
  const today = new Date().toISOString().slice(0, 10);
  cajaStartInput.value = today;
  cajaEndInput.value = today;
  computeCajaTotals();
});

exportPdfBtn.addEventListener("click", exportTicketsToPDF);
backupJsonBtn.addEventListener("click", downloadBackupJson);

if (comiApplyBtn) comiApplyBtn.addEventListener("click", () => renderCommissionsSummary());
if (comiClearBtn) comiClearBtn.addEventListener("click", () => {
  comiStartInput.value = "";
  comiEndInput.value = "";
  comiTechSelect.value = "";
  renderCommissionsSummary();
});

// Propinas
if (tipsApplyBtn) tipsApplyBtn.addEventListener("click", () => renderTipsSummary());
if (tipsClearBtn) tipsClearBtn.addEventListener("click", () => {
  tipsStartInput.value = "";
  tipsEndInput.value = "";
  tipsTechSelect.value = "";
  tipsGroupSelect.value = "tech";
  renderTipsSummary();
});

// Retenciones
if (retenApplyBtn) retenApplyBtn.addEventListener("click", () => renderRetencionesSummary());
if (retenClearBtn) retenClearBtn.addEventListener("click", () => {
  retenStartInput.value = "";
  retenEndInput.value = "";
  retenTechSelect.value = "";
  renderRetencionesSummary();
});

/* Editar / eliminar desde la tabla */
ticketsTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const number = Number(btn.dataset.number);
  if (!number) return;

  const ticket = state.tickets.find((t) => Number(t.number) === number);
  if (!ticket) return;

  if (action === "edit") {
    currentEditingNumber = number;

    ticketNumberInput.value = ticket.number;
    ticketDateInput.value = ticket.date;
    clientNameInput.value = ticket.clientName;
    serviceDescInput.value = ticket.serviceDesc;
    quantityInput.value = ticket.quantity;
    unitPriceInput.value = ticket.unitPrice;
    tipAmountInput.value = ticket.tipAmount || 0;

    if (["Cynthia", "Carmen", "Yerika"].includes(ticket.technician)) {
      technicianSelect.value = ticket.technician;
      technicianCustomInput.value = "";
    } else {
      technicianSelect.value = "";
      technicianCustomInput.value = ticket.technician || "";
    }

    paymentMethodSelect.value = ticket.paymentMethod;

    recalcTotal();
    formMessage.textContent = `Editando ticket #${ticket.number}`;
    setActivePage("dashboard");
  }

  if (action === "delete") {
    if (!state.user) return alert("Conéctate con Google para eliminar tickets.");

    const ok = confirm(`¿Eliminar el ticket #${number}? Esta acción no se puede deshacer.`);
    if (!ok) return;

    try {
      await ticketsCollectionRef().doc(String(number)).delete();
    } catch (err) {
      console.error("Error eliminando ticket", err);
      alert("No se pudo eliminar el ticket.");
    }
  }
});

/* ========== INIT + PWA ========== */
function init() {
  loadState();
  renderBranding();
  renderTicketNumber();
  renderTicketsTable(state.tickets);

  const today = new Date().toISOString().slice(0, 10);
  cajaStartInput.value = today;
  cajaEndInput.value = today;
  computeCajaTotals();

  resetFormForNewTicket();
  setActivePage("dashboard");
  showPinScreen();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch((err) => console.error("SW error", err));
  }
}

init();
