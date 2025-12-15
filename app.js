// app.js — Nexus Salon (Firestore + Google Auth + Login PIN por usuario + Roles + Propinas + Retenciones)

// ========================
// FIREBASE CONFIG
// ========================
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

// ========================
// LOCAL STATE
// ========================
const LOCAL_KEY = "nexus_salon_state_v10";

let state = {
  appName: "Nexus Salon",
  logoUrl: "",
  pdfHeaderText: "",
  pdfFooterText: "",
  footerText: "© 2025 Nexus Salon — Sistema de tickets",

  // sesión interna (PIN por usuario)
  session: null, // { name, role, technician }

  tickets: [],
  technicians: [], // { id, name, commission, active }
  users: [],       // { id, name, pin, role, technician, active }

  user: null,

  unsubscribeTickets: null,
  unsubscribeTechs: null,
  unsubscribeUsers: null
};

// edición
let currentEditingNumber = null;
let currentTechId = null;
let currentUserId = null;

// ========================
// HELPERS: STORAGE
// ========================
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
  delete copy.unsubscribeTechs;
  delete copy.unsubscribeUsers;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(copy));
}

// ========================
// FIRESTORE REFS
// ========================
function ticketsCollectionRef() { return db.collection("salonTickets"); }
function brandingDocRef() { return db.collection("branding").doc("salon"); }
function techniciansRef() { return db.collection("technicians"); }
function usersRef() { return db.collection("users"); }

// ========================
// DOM
// ========================
const authScreen = document.getElementById("authScreen");
const pinScreen  = document.getElementById("pinScreen");
const appShell   = document.getElementById("appShell");

// auth
const googleSignInBtn = document.getElementById("googleSignInBtn");

// login pin
const loginName = document.getElementById("loginName");
const loginPin  = document.getElementById("loginPin");
const pinEnterBtn = document.getElementById("pinEnterBtn");
const pinError = document.getElementById("pinError");
const logoutBtnLogin = document.getElementById("logoutBtnLogin");

// topbar
const appNameEditable = document.getElementById("appNameEditable");
const pinAppNameTitle = document.getElementById("pinAppName");
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const appLogoImg = document.getElementById("appLogo");
const pinLogoImg = document.getElementById("pinLogo");
const footerTextSpan = document.getElementById("footerText");
const roleBadge = document.getElementById("roleBadge");

// nav/pages
const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const pages = {
  dashboard: document.getElementById("page-dashboard"),
  historial: document.getElementById("page-historial"),
  caja: document.getElementById("page-caja"),
  comisiones: document.getElementById("page-comisiones"),
  propinas: document.getElementById("page-propinas"),
  retenciones: document.getElementById("page-retenciones"),
  config: document.getElementById("page-config")
};

// dashboard
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
const tipStart = document.getElementById("tipStart");
const tipEnd = document.getElementById("tipEnd");
const tipGroupBy = document.getElementById("tipGroupBy");
const tipApplyBtn = document.getElementById("tipApplyBtn");
const tipClearBtn = document.getElementById("tipClearBtn");
const tipsTableBody = document.getElementById("tipsTableBody");
const tipsTotal = document.getElementById("tipsTotal");

// retenciones
const retStart = document.getElementById("retStart");
const retEnd = document.getElementById("retEnd");
const retTech = document.getElementById("retTech");
const retApplyBtn = document.getElementById("retApplyBtn");
const retClearBtn = document.getElementById("retClearBtn");
const retTableBody = document.getElementById("retTableBody");
const retTotal = document.getElementById("retTotal");

// config branding
const logoUrlInput = document.getElementById("logoUrlInput");
const pdfHeaderTextArea = document.getElementById("pdfHeaderText");
const pdfFooterTextArea = document.getElementById("pdfFooterText");
const footerTextInput = document.getElementById("footerTextInput");
const saveBrandingBtn = document.getElementById("saveBrandingBtn");
const brandingStatus = document.getElementById("brandingStatus");

// config tech CRUD
const techTableBody = document.getElementById("techTableBody");
const techNameInput = document.getElementById("techNameInput");
const techPercentInput = document.getElementById("techPercentInput");
const techSaveBtn = document.getElementById("techSaveBtn");
const techCancelBtn = document.getElementById("techCancelBtn");

// config users CRUD
const usersTableBody = document.getElementById("usersTableBody");
const userNameInput = document.getElementById("userNameInput");
const userPinInput = document.getElementById("userPinInput");
const userTechSelect = document.getElementById("userTechSelect");
const userCreateBtn = document.getElementById("userCreateBtn");
const userCreateAdminBtn = document.getElementById("userCreateAdminBtn");
const adminNote = document.getElementById("adminNote");

// ========================
// VIEWS
// ========================
function showAuth() {
  authScreen.classList.remove("hidden");
  pinScreen.classList.add("hidden");
  appShell.classList.add("hidden");
}
function showPinLogin() {
  authScreen.classList.add("hidden");
  pinScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
  pinError.textContent = "";
  loginName.value = "";
  loginPin.value = "";
}
function showApp() {
  authScreen.classList.add("hidden");
  pinScreen.classList.add("hidden");
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
  if (pageName === "retenciones") renderRetentionsSummary();
}

// ========================
// BRANDING / UI
// ========================
function renderBranding() {
  const name = state.appName || "Nexus Salon";
  appNameEditable.textContent = name;
  pinAppNameTitle.textContent = name;

  logoUrlInput.value = state.logoUrl || "";
  pdfHeaderTextArea.value = state.pdfHeaderText || "";
  pdfFooterTextArea.value = state.pdfFooterText || "";
  footerTextInput.value = state.footerText || "© 2025 Nexus Salon — Sistema de tickets";
  footerTextSpan.textContent = state.footerText || "© 2025 Nexus Salon — Sistema de tickets";

  const logoSrc = state.logoUrl && state.logoUrl.trim() ? state.logoUrl.trim() : "assets/logo.png";
  appLogoImg.src = logoSrc;
  pinLogoImg.src = logoSrc;

  // badge rol
  if (state.session) {
    roleBadge.textContent = state.session.role === "admin"
      ? `Admin: ${state.session.name}`
      : `Técnica: ${state.session.technician || state.session.name}`;
  } else {
    roleBadge.textContent = "—";
  }
}

function applyRoleAccessUI() {
  const isAdmin = state.session && state.session.role === "admin";
  document.querySelectorAll(".nav-admin").forEach(btn => {
    btn.classList.toggle("hidden", !isAdmin);
  });

  // Empleado: bloquea selector técnica
  const isEmployee = state.session && state.session.role === "employee";
  if (isEmployee) {
    technicianSelect.disabled = true;
    technicianCustomInput.disabled = true;
  } else {
    technicianSelect.disabled = false;
    technicianCustomInput.disabled = false;
  }

  // Si empleado está en página admin, lo devolvemos
  const adminPages = ["caja","comisiones","propinas","retenciones","config"];
  if (!isAdmin) {
    adminPages.forEach(p => pages[p] && pages[p].classList.remove("active-page"));
    setActivePage("dashboard");
  }
}

// ========================
// TECHNICIANS / USERS SEED
// ========================
function getDefaultTechnicians() {
  return [
    { id: "cynthia", name: "Cynthia", commission: 40, active: true },
    { id: "carmen", name: "Carmen", commission: 35, active: true },
    { id: "yerika", name: "Yerika", commission: 35, active: true },
  ];
}
async function ensureDefaultsInCloud() {
  // Técnicas
  const snap = await techniciansRef().limit(1).get();
  if (snap.empty) {
    const batch = db.batch();
    getDefaultTechnicians().forEach(t => {
      batch.set(techniciansRef().doc(t.id), { name: t.name, commission: t.commission, active: true });
    });
    await batch.commit();
  }

  // Admin inicial (si no existe ninguno)
  const adminSnap = await usersRef().where("role", "==", "admin").limit(1).get();
  if (adminSnap.empty) {
    // admin por defecto: Admin / 1234
    await usersRef().add({ name: "Admin", pin: "1234", role: "admin", technician: "", active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  }
}

// ========================
// LISTENERS
// ========================
function startTicketsListener() {
  if (state.unsubscribeTickets) { state.unsubscribeTickets(); state.unsubscribeTickets = null; }

  state.unsubscribeTickets = ticketsCollectionRef()
    .orderBy("number", "asc")
    .onSnapshot((snap) => {
      const arr = [];
      snap.forEach((doc) => arr.push(doc.data()));
      state.tickets = arr;
      saveState();
      renderTicketNumber();
      renderTicketsTable();
      computeCajaTotals();
      renderCommissionsSummary();
      renderTipsSummary();
      renderRetentionsSummary();
    }, (err) => console.error("tickets onSnapshot error", err));
}

function startTechsListener() {
  if (state.unsubscribeTechs) { state.unsubscribeTechs(); state.unsubscribeTechs = null; }

  state.unsubscribeTechs = techniciansRef()
    .onSnapshot((snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      state.technicians = arr;
      saveState();
      renderTechniciansTable();
      loadTechniciansIntoSelects();
    }, (err) => console.error("techs onSnapshot error", err));
}

function startUsersListener() {
  if (state.unsubscribeUsers) { state.unsubscribeUsers(); state.unsubscribeUsers = null; }

  state.unsubscribeUsers = usersRef()
    .onSnapshot((snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      state.users = arr;
      saveState();
      renderUsersTable();
    }, (err) => console.error("users onSnapshot error", err));
}

// ========================
// AUTH GOOGLE
// ========================
async function signInWithGoogle() {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    state.user = result.user;
    userEmailSpan.textContent = state.user?.email || "";
    saveState();

    await ensureDefaultsInCloud();
    await loadBrandingFromCloud();

    startTicketsListener();
    startTechsListener();
    startUsersListener();

    showPinLogin();
  } catch (err) {
    console.error("Google SignIn error", err);
    alert("No se pudo iniciar sesión con Google.");
  }
}

async function signOutGoogle() {
  try { await auth.signOut(); } catch (e) { console.error(e); }

  if (state.unsubscribeTickets) state.unsubscribeTickets();
  if (state.unsubscribeTechs) state.unsubscribeTechs();
  if (state.unsubscribeUsers) state.unsubscribeUsers();

  state.unsubscribeTickets = null;
  state.unsubscribeTechs = null;
  state.unsubscribeUsers = null;

  state.user = null;
  state.session = null;

  userEmailSpan.textContent = "Sin conexión";
  saveState();
  showAuth();
}

auth.onAuthStateChanged(async (user) => {
  state.user = user || null;
  if (!user) {
    userEmailSpan.textContent = "Sin conexión";
    showAuth();
    return;
  }
  userEmailSpan.textContent = user.email || "";
});

// ========================
// INTERNAL LOGIN (NAME + PIN)
// ========================
function normalizeName(s) {
  return (s || "").trim().toLowerCase();
}

async function loginWithPin() {
  const name = (loginName.value || "").trim();
  const pin = (loginPin.value || "").trim();

  if (!name || !pin) {
    pinError.textContent = "Escribe tu nombre y PIN.";
    return;
  }

  // buscar usuario por nombre (case-insensitive)
  const found = state.users.find(u => normalizeName(u.name) === normalizeName(name) && String(u.pin || "") === String(pin));
  if (!found) {
    pinError.textContent = "Nombre o PIN incorrecto.";
    return;
  }
  if (found.active === false) {
    pinError.textContent = "Usuario desactivado. Contacta al admin.";
    return;
  }

  state.session = {
    name: found.name,
    role: found.role || "employee",
    technician: found.technician || found.name
  };

  saveState();
  renderBranding();
  applyRoleAccessUI();

  // si empleado: fuerza técnica en dashboard
  if (state.session.role === "employee") {
    technicianSelect.value = state.session.technician;
    technicianCustomInput.value = "";
  }

  showApp();
  setActivePage("dashboard");
}

// ========================
// BRANDING CLOUD
// ========================
async function loadBrandingFromCloud() {
  try {
    const snap = await brandingDocRef().get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (data.appName) state.appName = data.appName;
      if (data.logoUrl !== undefined) state.logoUrl = data.logoUrl;
      if (data.pdfHeaderText !== undefined) state.pdfHeaderText = data.pdfHeaderText;
      if (data.pdfFooterText !== undefined) state.pdfFooterText = data.pdfFooterText;
      if (data.footerText !== undefined) state.footerText = data.footerText;
      saveState();
      renderBranding();
    }
  } catch (e) {
    console.error("Error branding cloud", e);
  }
}

async function saveBrandingToCloud() {
  if (!state.session || state.session.role !== "admin") {
    brandingStatus.textContent = "Solo admin puede guardar configuración.";
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
    await brandingDocRef().set(payload, { merge: true });
    brandingStatus.textContent = "Guardado.";
  } catch (e) {
    console.error("save branding error", e);
    brandingStatus.textContent = "Error guardando.";
  }
}

// ========================
// TECHNICIANS UI/CRUD
// ========================
function getCommissionRateForTech(techName) {
  const t = state.technicians.find(x => x.name === techName);
  if (t && t.active !== false) return Number(t.commission || 0) || 0;
  // si técnica no existe (tickets viejos), comisión 0 (o 30 si quieres)
  return 0;
}

function loadTechniciansIntoSelects() {
  const list = state.technicians
    .filter(t => t.active !== false)
    .slice()
    .sort((a,b) => String(a.name).localeCompare(String(b.name)));

  // dashboard tech select
  technicianSelect.innerHTML = `<option value="">Seleccionar...</option>`;
  list.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.textContent = t.name;
    technicianSelect.appendChild(opt);
  });

  // filtros
  filterTechSelect.innerHTML = `<option value="">Todas</option>`;
  comiTechSelect.innerHTML = `<option value="">Todas</option>`;
  retTech.innerHTML = `<option value="">Todas</option>`;
  userTechSelect.innerHTML = `<option value="">Seleccionar...</option>`;

  list.forEach(t => {
    [filterTechSelect, comiTechSelect, retTech].forEach(sel => {
      const opt = document.createElement("option");
      opt.value = t.name;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });

    const optU = document.createElement("option");
    optU.value = t.name;
    optU.textContent = t.name;
    userTechSelect.appendChild(optU);
  });

  // si empleado, fija técnica
  if (state.session && state.session.role === "employee") {
    technicianSelect.value = state.session.technician || "";
    technicianSelect.disabled = true;
    technicianCustomInput.disabled = true;
    filterTechSelect.value = state.session.technician || "";
  }
}

function renderTechniciansTable() {
  if (!techTableBody) return;
  techTableBody.innerHTML = "";

  const rows = state.technicians
    .slice()
    .sort((a,b) => String(a.name).localeCompare(String(b.name)));

  rows.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="wrap">${escapeHtml(t.name || "")}</td>
      <td>${Number(t.commission || 0).toFixed(1)}%</td>
      <td>${t.active === false ? "No" : "Sí"}</td>
      <td>
        <button class="btn-table edit" data-id="${t.id}">Editar</button>
        <button class="btn-table delete" data-id="${t.id}">X</button>
      </td>
    `;
    techTableBody.appendChild(tr);
  });
}

function resetTechForm() {
  currentTechId = null;
  techNameInput.value = "";
  techPercentInput.value = "";
}

async function saveTech() {
  if (!state.session || state.session.role !== "admin") return;

  const name = (techNameInput.value || "").trim();
  const commission = Number(techPercentInput.value || 0);

  if (!name) return alert("Nombre requerido.");
  if (commission < 0 || commission > 100) return alert("Comisión 0-100.");

  try {
    if (currentTechId) {
      await techniciansRef().doc(currentTechId).set({ name, commission, active: true }, { merge: true });
    } else {
      const id = "t_" + Date.now();
      await techniciansRef().doc(id).set({ name, commission, active: true });
    }
    resetTechForm();
  } catch (e) {
    console.error("save tech error", e);
    alert("No se pudo guardar técnica.");
  }
}

if (techTableBody) {
  techTableBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (!state.session || state.session.role !== "admin") return;

    const id = btn.getAttribute("data-id");
    if (!id) return;

    const t = state.technicians.find(x => x.id === id);
    if (!t) return;

    if (btn.classList.contains("edit")) {
      currentTechId = id;
      techNameInput.value = t.name || "";
      techPercentInput.value = t.commission ?? "";
      return;
    }

    if (btn.classList.contains("delete")) {
      const ok = confirm(`¿Desactivar técnica "${t.name}"?`);
      if (!ok) return;
      try {
        await techniciansRef().doc(id).set({ active: false }, { merge: true });
      } catch (err) {
        console.error(err);
        alert("No se pudo desactivar.");
      }
    }
  });
}

// ========================
// USERS UI/CRUD
// ========================
function renderUsersTable() {
  if (!usersTableBody) return;
  usersTableBody.innerHTML = "";

  const rows = state.users
    .slice()
    .sort((a,b) => String(a.name).localeCompare(String(b.name)));

  rows.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="wrap">${escapeHtml(u.name || "")}</td>
      <td>${escapeHtml(u.role || "employee")}</td>
      <td class="wrap">${escapeHtml(u.technician || "")}</td>
      <td>${u.active === false ? "No" : "Sí"}</td>
      <td>
        <button class="btn-table edit" data-id="${u.id}">Editar</button>
        <button class="btn-table delete" data-id="${u.id}">${u.active === false ? "Activar" : "Desactivar"}</button>
      </td>
    `;
    usersTableBody.appendChild(tr);
  });

  adminNote.textContent = "Tip: Admin inicial por defecto: Admin / 1234 (cámbialo creando otro admin y desactivando ese).";
}

async function createUser(role) {
  if (!state.session || state.session.role !== "admin") return;

  const name = (userNameInput.value || "").trim();
  const pin = (userPinInput.value || "").trim();
  const tech = (userTechSelect.value || "").trim();

  if (!name) return alert("Nombre requerido.");
  if (!pin || pin.length < 4) return alert("PIN mínimo 4 dígitos.");

  if (role === "employee" && !tech) return alert("Selecciona técnica para empleado.");

  try {
    // si existe mismo nombre, alert
    const exists = state.users.some(u => normalizeName(u.name) === normalizeName(name));
    if (exists) return alert("Ya existe un usuario con ese nombre.");

    await usersRef().add({
      name,
      pin,
      role,
      technician: role === "employee" ? tech : "",
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    userNameInput.value = "";
    userPinInput.value = "";
    userTechSelect.value = "";
  } catch (e) {
    console.error("create user error", e);
    alert("No se pudo crear usuario.");
  }
}

if (usersTableBody) {
  usersTableBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (!state.session || state.session.role !== "admin") return;

    const id = btn.getAttribute("data-id");
    if (!id) return;

    const u = state.users.find(x => x.id === id);
    if (!u) return;

    if (btn.classList.contains("edit")) {
      currentUserId = id;
      // carga al form para editar (nombre/pin/tech/role)
      userNameInput.value = u.name || "";
      userPinInput.value = u.pin || "";
      userTechSelect.value = u.technician || "";
      alert("Edita los campos y crea de nuevo con el mismo nombre NO; para edición real, dime y lo dejamos con botón 'Guardar cambios'.");
      return;
    }

    if (btn.classList.contains("delete")) {
      const nextActive = (u.active === false) ? true : false;
      const ok = confirm(`${nextActive ? "¿Activar" : "¿Desactivar"} usuario "${u.name}"?`);
      if (!ok) return;
      try {
        await usersRef().doc(id).set({ active: nextActive }, { merge: true });
      } catch (err) {
        console.error(err);
        alert("No se pudo cambiar estado.");
      }
    }
  });
}

// ========================
// TICKETS LOGIC
// ========================
function nextTicketNumber() {
  if (!state.tickets.length) return 1;
  const max = state.tickets.reduce((m, t) => Math.max(m, Number(t.number || 0)), 0);
  return max + 1;
}
function renderTicketNumber() {
  ticketNumberInput.value = nextTicketNumber();
}

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
  paymentMethodSelect.value = "";
  serviceDescInput.value = "";
  quantityInput.value = 1;
  unitPriceInput.value = "";
  tipAmountInput.value = "";
  recalcTotal();
  ticketNumberInput.value = nextTicketNumber();
  formMessage.textContent = "";
  currentEditingNumber = null;

  // técnica según rol
  if (state.session && state.session.role === "employee") {
    technicianSelect.value = state.session.technician || "";
    technicianCustomInput.value = "";
  } else {
    technicianSelect.value = "";
    technicianCustomInput.value = "";
  }
}

function getEffectiveTechnician() {
  const isEmployee = state.session && state.session.role === "employee";
  if (isEmployee) return state.session.technician || "";

  const pre = technicianSelect.value;
  const custom = technicianCustomInput.value.trim();
  return custom || pre || "";
}

function collectTicketFromForm() {
  const number = Number(ticketNumberInput.value || 0);
  const date = ticketDateInput.value;
  const clientName = clientNameInput.value.trim();
  const technician = getEffectiveTechnician();
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

function getVisibleTickets() {
  if (!state.session) return [];
  if (state.session.role === "admin") return state.tickets;
  return state.tickets.filter(t => t.technician === state.session.technician);
}

async function saveTicket() {
  if (!state.user) {
    formMessage.textContent = "Conéctate con Google primero.";
    return;
  }
  if (!state.session) {
    formMessage.textContent = "Inicia sesión con tu Nombre + PIN.";
    return;
  }

  try {
    const ticket = collectTicketFromForm();
    const docId = String(ticket.number);

    await ticketsCollectionRef().doc(docId).set(ticket, { merge: true });

    formMessage.textContent = currentEditingNumber
      ? "Ticket actualizado."
      : "Ticket guardado.";

    currentEditingNumber = null;
    resetFormForNewTicket();
  } catch (err) {
    console.error("save ticket error", err);
    formMessage.textContent = err.message || "Error guardando ticket.";
  }
}

// ========================
// HISTORIAL / FILTROS
// ========================
function getFilteredTickets() {
  const start = filterStartInput.value;
  const end = filterEndInput.value;
  const tech = filterTechSelect.value;

  const base = getVisibleTickets();

  return base.filter((t) => {
    let ok = true;
    if (start && t.date < start) ok = false;
    if (end && t.date > end) ok = false;
    if (tech && t.technician !== tech) ok = false;
    return ok;
  });
}

function renderTicketsTable(listOverride) {
  const list = listOverride || getFilteredTickets();
  ticketsTableBody.innerHTML = "";

  list
    .slice()
    .sort((a, b) => (a.number || 0) - (b.number || 0))
    .forEach((t) => {
      const tr = document.createElement("tr");
      const tip = Number(t.tipAmount || 0);
      tr.innerHTML = `
        <td>${t.number || ""}</td>
        <td>${t.date || ""}</td>
        <td class="wrap">${escapeHtml(t.clientName || "")}</td>
        <td class="wrap">${escapeHtml(t.technician || "")}</td>
        <td class="wrap">${escapeHtml(t.serviceDesc || "")}</td>
        <td>${escapeHtml(t.paymentMethod || "")}</td>
        <td>$${Number(t.totalAmount || 0).toFixed(2)}</td>
        <td>$${tip.toFixed(2)}</td>
        <td>
          <button class="btn-table edit" data-action="edit" data-number="${t.number}">Editar</button>
          <button class="btn-table delete" data-action="delete" data-number="${t.number}">X</button>
        </td>
      `;
      ticketsTableBody.appendChild(tr);
    });
}

// ========================
// CAJA (ADMIN)
// ========================
function computeCajaTotals() {
  if (!state.session || state.session.role !== "admin") return;

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

// ========================
// COMISIONES (ADMIN) — ventas SIN propina
// ========================
function getFilteredTicketsForAdminRange(start, end, tech) {
  let list = state.tickets.slice();
  if (start) list = list.filter(t => t.date && t.date >= start);
  if (end) list = list.filter(t => t.date && t.date <= end);
  if (tech) list = list.filter(t => t.technician === tech);
  return list;
}

function renderCommissionsSummary() {
  if (!state.session || state.session.role !== "admin") return;
  if (!comiTableBody || !comiTotalSpan) return;

  const start = comiStartInput.value;
  const end = comiEndInput.value;
  const techFilter = comiTechSelect.value;

  const list = getFilteredTicketsForAdminRange(start, end, techFilter);

  const byTech = {};
  let totalComi = 0;

  list.forEach(t => {
    const tech = t.technician || "Sin técnica";
    const total = Number(t.totalAmount || 0);
    const tip = Number(t.tipAmount || 0);
    const salesNoTip = Math.max(0, total - tip);

    const rate = getCommissionRateForTech(tech);
    const comi = (salesNoTip * rate) / 100;

    if (!byTech[tech]) byTech[tech] = { tech, rate, salesNoTip: 0, comi: 0 };
    byTech[tech].salesNoTip += salesNoTip;
    byTech[tech].comi += comi;
    totalComi += comi;
  });

  const rows = Object.values(byTech).sort((a,b) => a.tech.localeCompare(b.tech));
  comiTableBody.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="wrap">${escapeHtml(r.tech)}</td>
      <td>${Number(r.rate).toFixed(1)}%</td>
      <td>$${r.salesNoTip.toFixed(2)}</td>
      <td>$${r.comi.toFixed(2)}</td>
    `;
    comiTableBody.appendChild(tr);
  });

  comiTotalSpan.textContent = `$${totalComi.toFixed(2)}`;
}

// ========================
// PROPINAS (ADMIN)
// ========================
function weekKeyFromDate(dateStr) {
  // ISO week simple (aprox): usamos lunes como inicio
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // lunes=0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0,10); // inicio semana
}

function renderTipsSummary() {
  if (!state.session || state.session.role !== "admin") return;

  const start = tipStart.value;
  const end = tipEnd.value;
  const group = tipGroupBy.value;

  const list = getFilteredTicketsForAdminRange(start, end, "");

  const map = new Map();
  let sum = 0;

  list.forEach(t => {
    const tip = Number(t.tipAmount || 0);
    if (!tip) return;

    let key = "—";
    if (group === "tech") key = t.technician || "Sin técnica";
    if (group === "day") key = t.date || "Sin fecha";
    if (group === "week") key = t.date ? weekKeyFromDate(t.date) : "Sin fecha";

    map.set(key, (map.get(key) || 0) + tip);
    sum += tip;
  });

  tipsTableBody.innerHTML = "";
  Array.from(map.entries()).sort((a,b)=> String(a[0]).localeCompare(String(b[0]))).forEach(([k,v]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="wrap">${escapeHtml(k)}</td><td>$${Number(v).toFixed(2)}</td>`;
    tipsTableBody.appendChild(tr);
  });

  tipsTotal.textContent = `$${sum.toFixed(2)}`;
}

// ========================
// RETENCIONES (ADMIN) — 10% después de comisión, sin propina
// ========================
function renderRetentionsSummary() {
  if (!state.session || state.session.role !== "admin") return;

  const start = retStart.value;
  const end = retEnd.value;
  const techFilter = retTech.value;

  const list = getFilteredTicketsForAdminRange(start, end, techFilter);

  const byTech = {};
  let totalRet = 0;

  list.forEach(t => {
    const tech = t.technician || "Sin técnica";
    const total = Number(t.totalAmount || 0);
    const tip = Number(t.tipAmount || 0);
    const salesNoTip = Math.max(0, total - tip);

    const rate = getCommissionRateForTech(tech);
    const comi = (salesNoTip * rate) / 100;

    const baseNeta = Math.max(0, salesNoTip - comi);
    const ret = baseNeta * 0.10;
    const netoPagar = Math.max(0, baseNeta - ret);

    if (!byTech[tech]) {
      byTech[tech] = { tech, salesNoTip: 0, comi: 0, baseNeta: 0, ret: 0, netoPagar: 0 };
    }
    byTech[tech].salesNoTip += salesNoTip;
    byTech[tech].comi += comi;
    byTech[tech].baseNeta += baseNeta;
    byTech[tech].ret += ret;
    byTech[tech].netoPagar += netoPagar;

    totalRet += ret;
  });

  retTableBody.innerHTML = "";
  Object.values(byTech).sort((a,b)=>a.tech.localeCompare(b.tech)).forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="wrap">${escapeHtml(r.tech)}</td>
      <td>$${r.salesNoTip.toFixed(2)}</td>
      <td>$${r.comi.toFixed(2)}</td>
      <td>$${r.baseNeta.toFixed(2)}</td>
      <td>$${r.ret.toFixed(2)}</td>
      <td>$${r.netoPagar.toFixed(2)}</td>
    `;
    retTableBody.appendChild(tr);
  });

  retTotal.textContent = `$${totalRet.toFixed(2)}`;
}

// ========================
// PDF + BACKUP (USA VISIBLE TICKETS)
// ========================
function exportTicketsToPDF() {
  const jsPDFLib = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDFLib) return alert("jsPDF no cargó.");

  const list = getFilteredTickets();
  if (!list.length) return alert("No hay tickets con el filtro actual.");

  const doc = new jsPDFLib({ orientation: "p", unit: "mm", format: "a4" });
  const marginLeft = 12;

  const col = {
    num: marginLeft,
    date: marginLeft + 12,
    client: marginLeft + 38,
    tech: marginLeft + 80,
    service: marginLeft + 112,
    total: 200
  };

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

  doc.text(`Generado: ${new Date().toLocaleString()}`, marginLeft, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("#", col.num, y);
  doc.text("Fecha", col.date, y);
  doc.text("Cliente", col.client, y);
  doc.text("Técnica", col.tech, y);
  doc.text("Servicio", col.service, y);
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
  if (!list.length) return alert("No hay tickets con el filtro actual.");

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

// ========================
// DELETE/EDIT tickets
// ========================
ticketsTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const number = Number(btn.dataset.number);
  if (!number) return;

  // solo tickets visibles
  const visible = getVisibleTickets();
  const ticket = visible.find(t => Number(t.number) === number);
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
    paymentMethodSelect.value = ticket.paymentMethod;

    // técnica
    const isEmployee = state.session && state.session.role === "employee";
    if (isEmployee) {
      technicianSelect.value = state.session.technician || "";
      technicianCustomInput.value = "";
    } else {
      if (state.technicians.some(x => x.name === ticket.technician)) {
        technicianSelect.value = ticket.technician;
        technicianCustomInput.value = "";
      } else {
        technicianSelect.value = "";
        technicianCustomInput.value = ticket.technician || "";
      }
    }

    recalcTotal();
    formMessage.textContent = `Editando ticket #${ticket.number}`;
    setActivePage("dashboard");
  }

  if (action === "delete") {
    if (!state.session) return alert("Inicia sesión.");
    const isEmployee = state.session.role === "employee";
    // empleado puede borrar SOLO sus tickets (ya filtrado)
    const ok = confirm(`¿Eliminar el ticket #${number}?`);
    if (!ok) return;

    try {
      await ticketsCollectionRef().doc(String(number)).delete();
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar.");
    }
  }
});

// ========================
// UTILS
// ========================
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ========================
// EVENTS
// ========================
googleSignInBtn.addEventListener("click", signInWithGoogle);
logoutBtnLogin.addEventListener("click", signOutGoogle);

pinEnterBtn.addEventListener("click", loginWithPin);
loginPin.addEventListener("keyup", (e) => { if (e.key === "Enter") loginWithPin(); });
loginName.addEventListener("keyup", (e) => { if (e.key === "Enter") loginWithPin(); });

logoutBtn.addEventListener("click", () => {
  // salir del rol (mantiene google)
  state.session = null;
  saveState();
  showPinLogin();
});

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.getAttribute("data-page");
    // bloqueo admin pages si empleado
    if (btn.classList.contains("nav-admin") && (!state.session || state.session.role !== "admin")) return;
    setActivePage(page);
  });
});

appNameEditable.addEventListener("input", () => {
  if (!state.session || state.session.role !== "admin") return; // solo admin cambia branding
  state.appName = appNameEditable.textContent.trim() || "Nexus Salon";
  saveState();
  renderBranding();
});

logoUrlInput.addEventListener("input", () => {
  if (!state.session || state.session.role !== "admin") return;
  state.logoUrl = logoUrlInput.value.trim();
  saveState();
  renderBranding();
});

pdfHeaderTextArea.addEventListener("input", () => {
  if (!state.session || state.session.role !== "admin") return;
  state.pdfHeaderText = pdfHeaderTextArea.value;
  saveState();
});
pdfFooterTextArea.addEventListener("input", () => {
  if (!state.session || state.session.role !== "admin") return;
  state.pdfFooterText = pdfFooterTextArea.value;
  saveState();
});
footerTextInput.addEventListener("input", () => {
  if (!state.session || state.session.role !== "admin") return;
  state.footerText = footerTextInput.value;
  saveState();
  footerTextSpan.textContent = state.footerText;
});

saveBrandingBtn.addEventListener("click", (e) => {
  e.preventDefault();
  saveBrandingToCloud();
});

// tech CRUD buttons
techSaveBtn.addEventListener("click", (e) => { e.preventDefault(); saveTech(); });
techCancelBtn.addEventListener("click", (e) => { e.preventDefault(); resetTechForm(); });

// user CRUD buttons
userCreateBtn.addEventListener("click", (e) => { e.preventDefault(); createUser("employee"); });
userCreateAdminBtn.addEventListener("click", (e) => { e.preventDefault(); createUser("admin"); });

// ticket buttons
newTicketBtn.addEventListener("click", (e) => { e.preventDefault(); resetFormForNewTicket(); });
quantityInput.addEventListener("input", recalcTotal);
unitPriceInput.addEventListener("input", recalcTotal);
tipAmountInput.addEventListener("input", recalcTotal);
saveTicketBtn.addEventListener("click", (e) => { e.preventDefault(); saveTicket(); });

// historial filters
applyFilterBtn.addEventListener("click", () => renderTicketsTable(getFilteredTickets()));
clearFilterBtn.addEventListener("click", () => {
  filterStartInput.value = "";
  filterEndInput.value = "";
  filterTechSelect.value = "";
  renderTicketsTable();
});

// caja
cajaApplyBtn.addEventListener("click", computeCajaTotals);
cajaClearBtn.addEventListener("click", () => {
  const today = new Date().toISOString().slice(0,10);
  cajaStartInput.value = today;
  cajaEndInput.value = today;
  computeCajaTotals();
});

// comisiones
comiApplyBtn.addEventListener("click", renderCommissionsSummary);
comiClearBtn.addEventListener("click", () => {
  comiStartInput.value = "";
  comiEndInput.value = "";
  comiTechSelect.value = "";
  renderCommissionsSummary();
});

// propinas
tipApplyBtn.addEventListener("click", renderTipsSummary);
tipClearBtn.addEventListener("click", () => {
  tipStart.value = "";
  tipEnd.value = "";
  tipGroupBy.value = "tech";
  renderTipsSummary();
});

// retenciones
retApplyBtn.addEventListener("click", renderRetentionsSummary);
retClearBtn.addEventListener("click", () => {
  retStart.value = "";
  retEnd.value = "";
  retTech.value = "";
  renderRetentionsSummary();
});

// export
exportPdfBtn.addEventListener("click", exportTicketsToPDF);
backupJsonBtn.addEventListener("click", downloadBackupJson);

// ========================
// INIT
// ========================
function init() {
  loadState();
  renderBranding();

  // default fechas
  const today = new Date().toISOString().slice(0,10);
  ticketDateInput.value = today;
  cajaStartInput.value = today;
  cajaEndInput.value = today;

  // PWA SW
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(err => console.error("SW error", err));
  }

  // si no hay google => auth
  if (!auth.currentUser) {
    showAuth();
    return;
  }

  showPinLogin();
}

init();

