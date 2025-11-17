// app.js (tipo module)

// ========== IMPORTS FIREBASE (CDN V9+ MODULAR) ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

// ========== CONFIGURACIÓN FIREBASE (Rellena esto con tus datos) ==========
const firebaseConfig = {
  apiKey: "AIzaSyCCYTfZGh_Cmtb4Qx4JT9Sma5Wf5BDzIdI",
  authDomain: "nexus-salon.firebaseapp.com",
  projectId: "nexus-salon",
  storageBucket: "nexus-salon.firebasestorage.app",
  messagingSenderId: "104208041652",
  appId: "1:104208041652:web:c717c5fff3617b29d8f9e1"
};

// ========== INICIALIZAR FIREBASE ==========
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// ========== jsPDF ==========
const { jsPDF } = window.jspdf;

// ========== ESTADO LOCAL ==========
const LOCAL_KEY = "nexus_salon_state_v1";

let state = {
  pin: "1234",
  appName: "Nexus Salon",
  pdfHeaderText: "",
  pdfFooterText: "",
  footerText: "© 2025 Nexus Salon — Sistema de tickets",
  lastTicketNumber: 0,
  tickets: [], // {id?, number, date, clientName, technician, paymentMethod, serviceDesc, quantity, unitPrice, tipAmount, totalAmount}
  logoUrl: null,
  user: null
};

// ========== UTILIDADES LOCALSTORAGE ==========
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
  const clone = { ...state };
  // No guardes el objeto user completo
  delete clone.user;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(clone));
}

// ========== REFERENCIAS DOM ==========
const pinScreen = document.getElementById("pinScreen");
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");

// PIN
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");
const pinEnterBtn = document.getElementById("pinEnterBtn");

// Auth
const googleSignInBtn = document.getElementById("googleSignInBtn");
const authBackToPinBtn = document.getElementById("authBackToPinBtn");

// Topbar
const appNameEditable = document.getElementById("appNameEditable");
const userEmailSpan = document.getElementById("userEmail");
const googleStatusBtn = document.getElementById("googleStatusBtn");
const syncBtn = document.getElementById("syncBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Ticket form
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

// Historial
const ticketsTableBody = document.getElementById("ticketsTableBody");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const backupJsonBtn = document.getElementById("backupJsonBtn");

// Filtros
const filterStartInput = document.getElementById("filterStart");
const filterEndInput = document.getElementById("filterEnd");
const filterTechSelect = document.getElementById("filterTech");
const applyFilterBtn = document.getElementById("applyFilterBtn");
const clearFilterBtn = document.getElementById("clearFilterBtn");

// Branding
const pinLogoImg = document.getElementById("pinLogo");
const appLogoImg = document.getElementById("appLogo");
const logoFileInput = document.getElementById("logoFileInput");
const uploadLogoBtn = document.getElementById("uploadLogoBtn");
const logoStatus = document.getElementById("logoStatus");
const pdfHeaderTextArea = document.getElementById("pdfHeaderText");
const pdfFooterTextArea = document.getElementById("pdfFooterText");
const newPinInput = document.getElementById("newPinInput");
const changePinBtn = document.getElementById("changePinBtn");
const pinChangeMessage = document.getElementById("pinChangeMessage");
const footerTextSpan = document.getElementById("footerText");
const pinAppNameTitle = document.getElementById("pinAppName");

// ========== RENDER ==========
function renderBranding() {
  appNameEditable.textContent = state.appName || "Nexus Salon";
  pinAppNameTitle.textContent = state.appName || "Nexus Salon";
  pdfHeaderTextArea.value = state.pdfHeaderText || "";
  pdfFooterTextArea.value = state.pdfFooterText || "";
  footerTextSpan.textContent = state.footerText || "© 2025 Nexus Salon — Sistema de tickets";

  if (state.logoUrl) {
    pinLogoImg.src = state.logoUrl;
    appLogoImg.src = state.logoUrl;
  }
}

function renderTicketNumber() {
  ticketNumberInput.value = state.lastTicketNumber + 1;
}

function renderTicketsTable(filteredTickets = null) {
  const list = filteredTickets || state.tickets;
  ticketsTableBody.innerHTML = "";
  list
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

// ========== NAVEGACIÓN ENTRE VISTAS ==========

function showPinScreen() {
  pinScreen.classList.remove("hidden");
  authScreen.classList.add("hidden");
  appScreen.classList.add("hidden");
  pinInput.value = "";
  pinError.textContent = "";
}

function showAuthScreen() {
  pinScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function showAppScreen() {
  pinScreen.classList.add("hidden");
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

// ========== LÓGICA PIN ==========
function handlePinEnter() {
  const pin = (pinInput.value || "").trim();
  if (!pin) {
    pinError.textContent = "Ingrese el PIN.";
    return;
  }

  if (pin === state.pin) {
    pinError.textContent = "";
    // Si ya hay usuario Google -> app; si no -> pantalla auth
    if (state.user) {
      showAppScreen();
    } else {
      showAuthScreen();
    }
  } else {
    pinError.textContent = "PIN incorrecto.";
  }
}

// ========== AUTENTICACIÓN GOOGLE ==========
async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    state.user = user;
    userEmailSpan.textContent = user.email || "";
    googleStatusBtn.textContent = "Desconectar Google";
    saveState();
    // Cargar logo y tickets desde la nube
    await loadRemoteBranding();
    await loadRemoteTickets();
    showAppScreen();
  } catch (err) {
    console.error("Error Google SignIn", err);
    alert("No se pudo iniciar sesión con Google.");
  }
}

async function doSignOut() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("Error signOut", e);
  }
  state.user = null;
  userEmailSpan.textContent = "Sin conexión a Google";
  googleStatusBtn.textContent = "Conectar Google";
  saveState();
  showPinScreen();
}

// Escucha cambios de sesión
onAuthStateChanged(auth, (user) => {
  state.user = user || null;
  if (user) {
    userEmailSpan.textContent = user.email || "";
    googleStatusBtn.textContent = "Desconectar Google";
    // No forzamos navegación aquí, la controla el PIN
  } else {
    userEmailSpan.textContent = "Sin conexión a Google";
    googleStatusBtn.textContent = "Conectar Google";
  }
});

// ========== TICKETS: CÁLCULOS Y CRUD LOCAL ==========

function recalcTotal() {
  const qty = Number(quantityInput.value || 0);
  const unit = Number(unitPriceInput.value || 0);
  const tip = Number(tipAmountInput.value || 0);
  const subtotal = qty * unit;
  const total = subtotal + tip;
  totalAmountInput.value = total.toFixed(2);
}

function resetFormForNewTicket() {
  state.lastTicketNumber = state.lastTicketNumber || 0;
  ticketNumberInput.value = state.lastTicketNumber + 1;

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
  totalAmountInput.value = "";

  formMessage.textContent = "";
  recalcTotal();
}

function collectTicketFromForm() {
  const number = Number(ticketNumberInput.value || 0);
  const date = ticketDateInput.value;
  const clientName = clientNameInput.value.trim();
  const technicianPre = technicianSelect.value;
  const technicianCustom = technicianCustomInput.value.trim();
  const technician = technicianCustom || technicianPre || "";
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
    totalAmount
  };
}

function saveTicketLocal(ticket) {
  // Si ya existe ese número, lo reemplaza
  const existingIndex = state.tickets.findIndex((t) => t.number === ticket.number);
  if (existingIndex >= 0) {
    state.tickets[existingIndex] = { ...state.tickets[existingIndex], ...ticket };
  } else {
    state.tickets.push(ticket);
  }

  if (ticket.number > (state.lastTicketNumber || 0)) {
    state.lastTicketNumber = ticket.number;
  }

  saveState();
  renderTicketNumber();
  renderTicketsTable();
}

// ========== FIRESTORE: TICKETS ==========
function getTicketsCollectionRef(user) {
  return collection(db, "users", user.uid, "salonTickets");
}

async function loadRemoteTickets() {
  if (!state.user) return;
  try {
    const q = query(getTicketsCollectionRef(state.user), orderBy("number", "asc"));
    const snap = await getDocs(q);
    const remoteTickets = [];
    snap.forEach((docSnap) => {
      remoteTickets.push(docSnap.data());
    });

    // Fusionar remoto con local (prioridad remoto)
    const localByNumber = {};
    state.tickets.forEach((t) => { localByNumber[t.number] = t; });
    remoteTickets.forEach((rt) => {
      localByNumber[rt.number] = { ...localByNumber[rt.number], ...rt };
    });
    state.tickets = Object.values(localByNumber);
    // Actualizar lastTicketNumber
    state.lastTicketNumber = state.tickets.reduce((max, t) => Math.max(max, t.number || 0), 0);
    saveState();
    renderTicketNumber();
    renderTicketsTable();
  } catch (e) {
    console.error("Error cargando tickets remotos", e);
  }
}

async function syncLocalTicketsToFirestore() {
  if (!state.user) {
    alert("Conecta tu cuenta de Google primero.");
    return;
  }
  try {
    const colRef = getTicketsCollectionRef(state.user);
    for (const t of state.tickets) {
      const id = String(t.number);
      await setDoc(doc(colRef, id), t, { merge: true });
    }
    alert("Sincronización completada.");
  } catch (e) {
    console.error("Error sincronizando tickets", e);
    alert("Error al sincronizar con la nube.");
  }
}

// ========== FIRESTORE: BRANDING (logo + textos) ==========
function getBrandingDocRef(user) {
  return doc(db, "users", user.uid, "branding", "salon");
}

async function loadRemoteBranding() {
  if (!state.user) return;
  try {
    const docSnap = await getDoc(getBrandingDocRef(state.user));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.appName) state.appName = data.appName;
      if (data.pdfHeaderText !== undefined) state.pdfHeaderText = data.pdfHeaderText;
      if (data.pdfFooterText !== undefined) state.pdfFooterText = data.pdfFooterText;
      if (data.footerText !== undefined) state.footerText = data.footerText;
      if (data.logoUrl) state.logoUrl = data.logoUrl;
      saveState();
      renderBranding();
    }
  } catch (e) {
    console.error("Error cargando branding remoto", e);
  }
}

async function saveBrandingToCloud() {
  if (!state.user) return;
  try {
    const payload = {
      appName: state.appName,
      pdfHeaderText: state.pdfHeaderText,
      pdfFooterText: state.pdfFooterText,
      footerText: state.footerText,
      logoUrl: state.logoUrl || null
    };
    await setDoc(getBrandingDocRef(state.user), payload, { merge: true });
  } catch (e) {
    console.error("Error guardando branding remoto", e);
  }
}

// ========== STORAGE: LOGO ==========
async function uploadLogoFile() {
  if (!state.user) {
    alert("Conecta tu cuenta de Google antes de subir el logo.");
    return;
  }
  const file = logoFileInput.files[0];
  if (!file) {
    alert("Selecciona una imagen primero.");
    return;
  }
  logoStatus.textContent = "Subiendo logo...";
  try {
    const storageRef = ref(storage, `users/${state.user.uid}/branding/salon-logo`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    state.logoUrl = url;
    saveState();
    renderBranding();
    await saveBrandingToCloud();
    logoStatus.textContent = "Logo subido y sincronizado correctamente.";
  } catch (e) {
    console.error("Error subiendo logo", e);
    logoStatus.textContent = "Error al subir el logo.";
  }
}

// ========== FILTROS ==========
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

// ========== EXPORTAR A PDF (jsPDF) ==========
function exportTicketsToPDF() {
  const list = getFilteredTickets();
  if (!list.length) {
    alert("No hay tickets para exportar con el filtro actual.");
    return;
  }

  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const marginLeft = 12;
  let y = 14;

  // Header
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

  // Fecha de generación
  const now = new Date();
  const genDate = now.toLocaleString();
  doc.text(`Generado: ${genDate}`, marginLeft, y);
  y += 6;

  // Encabezados tabla
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
    doc.text(`$${Number(t.totalAmount || 0).toFixed(2)}`, marginLeft + 182 - 10, y, { align: "right" });
    y += 4;
  });

  // Footer
  if (state.pdfFooterText) {
    const footerLines = doc.splitTextToSize(state.pdfFooterText, 180);
    doc.setFontSize(9);
    doc.text(footerLines, marginLeft, 288);
  }

  doc.save("tickets-nexus-salon.pdf");
}

// ========== BACKUP JSON ==========
function downloadBackupJson() {
  const list = getFilteredTickets();
  if (!list.length) {
    alert("No hay tickets para exportar con el filtro actual.");
    return;
  }
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

// ========== CAMBIO DE PIN ==========
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

// ========== LISTENERS ==========
pinEnterBtn.addEventListener("click", handlePinEnter);
pinInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") handlePinEnter();
});

googleSignInBtn.addEventListener("click", signInWithGoogle);
authBackToPinBtn.addEventListener("click", showPinScreen);

googleStatusBtn.addEventListener("click", () => {
  if (state.user) {
    doSignOut();
  } else {
    signInWithGoogle();
  }
});

logoutBtn.addEventListener("click", () => {
  // Sale a la caja de PIN (no borra sesión de Google, solo cambia vista)
  showPinScreen();
});

syncBtn.addEventListener("click", syncLocalTicketsToFirestore);

appNameEditable.addEventListener("input", () => {
  state.appName = appNameEditable.textContent.trim() || "Nexus Salon";
  saveState();
  renderBranding();
  if (state.user) {
    saveBrandingToCloud();
  }
});

pdfHeaderTextArea.addEventListener("input", () => {
  state.pdfHeaderText = pdfHeaderTextArea.value;
  saveState();
  if (state.user) saveBrandingToCloud();
});

pdfFooterTextArea.addEventListener("input", () => {
  state.pdfFooterText = pdfFooterTextArea.value;
  saveState();
  if (state.user) saveBrandingToCloud();
});

changePinBtn.addEventListener("click", changePin);

[newTicketBtn].forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    resetFormForNewTicket();
  });
});

quantityInput.addEventListener("input", recalcTotal);
unitPriceInput.addEventListener("input", recalcTotal);
tipAmountInput.addEventListener("input", recalcTotal);

saveTicketBtn.addEventListener("click", (e) => {
  e.preventDefault();
  try {
    const ticket = collectTicketFromForm();
    saveTicketLocal(ticket);
    formMessage.textContent = "Ticket guardado localmente. Usa 'Sincronizar' para subirlo a la nube.";
  } catch (err) {
    formMessage.textContent = err.message;
  }
});

exportPdfBtn.addEventListener("click", exportTicketsToPDF);
backupJsonBtn.addEventListener("click", downloadBackupJson);

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

uploadLogoBtn.addEventListener("click", (e) => {
  e.preventDefault();
  uploadLogoFile();
});

// ========== INICIALIZACIÓN ==========
function init() {
  loadState();
  renderBranding();
  renderTicketNumber();
  renderTicketsTable();
  resetFormForNewTicket();
  showPinScreen(); // Siempre arranca en PIN
}

init();
