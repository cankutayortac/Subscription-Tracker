const STORAGE_KEY = "subscription-tracker-v1";
const SETTINGS_KEY = "subscription-tracker-settings-v1";

const categories = ["Eğlence", "İş", "Bulut", "Sağlık", "Eğitim", "Diğer"];
const categoryColors = {
  "Eğlence": "#c7794a",
  "İş": "#1f5c5b",
  "Bulut": "#6c7fd8",
  "Sağlık": "#6aa06b",
  "Eğitim": "#b39428",
  "Diğer": "#7a6f68",
};

const cycleLabels = {
  weekly: "Haftalık",
  monthly: "Aylık",
  quarterly: "3 Aylık",
  yearly: "Yıllık",
};

const cycleMonthlyFactor = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

const sampleSubscriptions = [
  {
    id: createId(),
    name: "Netflix",
    price: 149.99,
    cycle: "monthly",
    category: "Eğlence",
    nextDate: offsetDate(4),
    note: "Aile profili",
    active: true,
  },
  {
    id: createId(),
    name: "Google One",
    price: 57.99,
    cycle: "monthly",
    category: "Bulut",
    nextDate: offsetDate(12),
    note: "200 GB",
    active: true,
  },
  {
    id: createId(),
    name: "Domain",
    price: 620,
    cycle: "yearly",
    category: "İş",
    nextDate: offsetDate(45),
    note: "Yıllık yenileme",
    active: true,
  },
];

let subscriptions = loadSubscriptions();
let settings = loadSettings();
let filters = {
  search: "",
  category: "all",
  status: "active",
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  setTodayLabel();
  populateCategoryFilter();
  render();
  if (window.lucide) window.lucide.createIcons();
});

function bindElements() {
  Object.assign(els, {
    todayLabel: document.querySelector("#todayLabel"),
    viewTitle: document.querySelector("#viewTitle"),
    navTabs: document.querySelectorAll(".nav-tab"),
    views: {
      dashboard: document.querySelector("#dashboardView"),
      subscriptions: document.querySelector("#subscriptionsView"),
      settings: document.querySelector("#settingsView"),
    },
    openAddDialog: document.querySelector("#openAddDialog"),
    dialog: document.querySelector("#subscriptionDialog"),
    form: document.querySelector("#subscriptionForm"),
    dialogTitle: document.querySelector("#dialogTitle"),
    closeDialog: document.querySelector("#closeDialog"),
    cancelDialog: document.querySelector("#cancelDialog"),
    deleteSubscription: document.querySelector("#deleteSubscription"),
    subscriptionId: document.querySelector("#subscriptionId"),
    nameInput: document.querySelector("#nameInput"),
    priceInput: document.querySelector("#priceInput"),
    cycleInput: document.querySelector("#cycleInput"),
    categoryInput: document.querySelector("#categoryInput"),
    nextDateInput: document.querySelector("#nextDateInput"),
    noteInput: document.querySelector("#noteInput"),
    activeInput: document.querySelector("#activeInput"),
    monthlyTotal: document.querySelector("#monthlyTotal"),
    activeCount: document.querySelector("#activeCount"),
    upcomingCount: document.querySelector("#upcomingCount"),
    yearlyTotal: document.querySelector("#yearlyTotal"),
    upcomingList: document.querySelector("#upcomingList"),
    nextPaymentBadge: document.querySelector("#nextPaymentBadge"),
    categoryBreakdown: document.querySelector("#categoryBreakdown"),
    subscriptionList: document.querySelector("#subscriptionList"),
    searchInput: document.querySelector("#searchInput"),
    categoryFilter: document.querySelector("#categoryFilter"),
    statusFilter: document.querySelector("#statusFilter"),
    currencyButtons: document.querySelector("#currencyButtons"),
    exportJson: document.querySelector("#exportJson"),
    exportCsv: document.querySelector("#exportCsv"),
    importJson: document.querySelector("#importJson"),
    toast: document.querySelector("#toast"),
  });
}

function bindEvents() {
  els.navTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  els.openAddDialog.addEventListener("click", () => openDialog());
  els.closeDialog.addEventListener("click", closeDialog);
  els.cancelDialog.addEventListener("click", closeDialog);
  els.form.addEventListener("submit", saveSubscription);
  els.deleteSubscription.addEventListener("click", deleteCurrentSubscription);

  els.searchInput.addEventListener("input", (event) => {
    filters.search = event.target.value.trim().toLocaleLowerCase("tr-TR");
    renderSubscriptionList();
  });

  els.categoryFilter.addEventListener("change", (event) => {
    filters.category = event.target.value;
    renderSubscriptionList();
  });

  els.statusFilter.addEventListener("change", (event) => {
    filters.status = event.target.value;
    renderSubscriptionList();
  });

  els.currencyButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-currency]");
    if (!button) return;
    settings.currency = button.dataset.currency;
    saveSettings();
    render();
    showToast("Para birimi güncellendi.");
  });

  els.exportJson.addEventListener("click", exportJson);
  els.exportCsv.addEventListener("click", exportCsv);
  els.importJson.addEventListener("change", importJson);
}

function switchView(viewName) {
  const titles = {
    dashboard: "Özet",
    subscriptions: "Abonelikler",
    settings: "Ayarlar",
  };

  els.navTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  Object.entries(els.views).forEach(([name, view]) => {
    view.classList.toggle("active", name === viewName);
  });
  els.viewTitle.textContent = titles[viewName];
}

function render() {
  renderDashboard();
  renderSubscriptionList();
  renderCurrencyButtons();
  if (window.lucide) window.lucide.createIcons();
}

function renderDashboard() {
  const active = subscriptions.filter((item) => item.active);
  const monthly = active.reduce((total, item) => total + monthlyValue(item), 0);
  const upcoming = getUpcoming(active, 7);

  els.monthlyTotal.textContent = formatMoney(monthly);
  els.activeCount.textContent = String(active.length);
  els.upcomingCount.textContent = String(upcoming.length);
  els.yearlyTotal.textContent = formatMoney(monthly * 12);

  renderUpcoming(active);
  renderBreakdown(active);
}

function renderUpcoming(active) {
  const upcoming = [...active]
    .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate))
    .slice(0, 6);

  if (!upcoming.length) {
    els.upcomingList.innerHTML = `<div class="empty-state">Henüz yaklaşan ödeme yok.</div>`;
    els.nextPaymentBadge.textContent = "";
    return;
  }

  const firstDays = daysUntil(upcoming[0].nextDate);
  els.nextPaymentBadge.textContent = firstDays <= 0 ? "Bugün" : `${firstDays} gün`;

  els.upcomingList.innerHTML = upcoming
    .map((item) => {
      const days = daysUntil(item.nextDate);
      const dueText = days <= 0 ? "Bugün ödenecek" : `${days} gün sonra`;
      return `
        <article class="timeline-item">
          <div>
            <div class="item-title">
              <span class="category-dot" style="background:${categoryColors[item.category] || categoryColors.Diğer}"></span>
              <strong>${escapeHtml(item.name)}</strong>
            </div>
            <p class="meta">${dueText} · ${formatDate(item.nextDate)} · ${cycleLabels[item.cycle]}</p>
          </div>
          <div class="amount">${formatMoney(item.price)}<span>${escapeHtml(item.category)}</span></div>
        </article>
      `;
    })
    .join("");
}

function renderBreakdown(active) {
  if (!active.length) {
    els.categoryBreakdown.innerHTML = `<div class="empty-state">Kategori grafiği için abonelik ekleyin.</div>`;
    return;
  }

  const totals = categories
    .map((category) => ({
      category,
      total: active
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + monthlyValue(item), 0),
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  const max = Math.max(...totals.map((row) => row.total));

  els.categoryBreakdown.innerHTML = totals
    .map((row) => {
      const width = Math.max(5, Math.round((row.total / max) * 100));
      return `
        <div class="bar-row">
          <div class="bar-label">
            <span>${escapeHtml(row.category)}</span>
            <span>${formatMoney(row.total)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%; background:${categoryColors[row.category] || categoryColors.Diğer}"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSubscriptionList() {
  const visible = subscriptions
    .filter((item) => {
      const matchesSearch = item.name.toLocaleLowerCase("tr-TR").includes(filters.search);
      const matchesCategory = filters.category === "all" || item.category === filters.category;
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" && item.active) ||
        (filters.status === "paused" && !item.active);
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));

  if (!visible.length) {
    els.subscriptionList.innerHTML = `<div class="empty-state">Bu filtreyle abonelik bulunamadı.</div>`;
    return;
  }

  els.subscriptionList.innerHTML = visible
    .map((item) => {
      const status = item.active ? "Aktif" : "Pasif";
      return `
        <article class="subscription-card">
          <div>
            <div class="item-title">
              <span class="category-dot" style="background:${categoryColors[item.category] || categoryColors.Diğer}"></span>
              <strong>${escapeHtml(item.name)}</strong>
            </div>
            <p class="meta">${escapeHtml(item.category)} · ${cycleLabels[item.cycle]} · ${formatDate(item.nextDate)} · ${status}</p>
            ${item.note ? `<p class="meta">${escapeHtml(item.note)}</p>` : ""}
          </div>
          <div>
            <div class="amount">${formatMoney(item.price)}<span>Aylık karşılığı ${formatMoney(monthlyValue(item))}</span></div>
            <div class="card-actions">
              <button class="icon-button" type="button" aria-label="${escapeHtml(item.name)} düzenle" data-edit-id="${item.id}">
                <i data-lucide="pencil"></i>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  els.subscriptionList.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = subscriptions.find((subscription) => subscription.id === button.dataset.editId);
      if (item) openDialog(item);
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function openDialog(item = null) {
  els.form.reset();
  els.dialogTitle.textContent = item ? "Aboneliği Düzenle" : "Abonelik Ekle";
  els.subscriptionId.value = item?.id || "";
  els.nameInput.value = item?.name || "";
  els.priceInput.value = item?.price ?? "";
  els.cycleInput.value = item?.cycle || "monthly";
  els.categoryInput.value = item?.category || "Eğlence";
  els.nextDateInput.value = item?.nextDate || offsetDate(7);
  els.noteInput.value = item?.note || "";
  els.activeInput.checked = item?.active ?? true;
  els.deleteSubscription.classList.toggle("hidden", !item);
  els.dialog.showModal();
}

function closeDialog() {
  els.dialog.close();
}

function saveSubscription(event) {
  event.preventDefault();
  const id = els.subscriptionId.value || createId();
  const item = {
    id,
    name: els.nameInput.value.trim(),
    price: Number(els.priceInput.value),
    cycle: els.cycleInput.value,
    category: els.categoryInput.value,
    nextDate: els.nextDateInput.value,
    note: els.noteInput.value.trim(),
    active: els.activeInput.checked,
  };

  const existingIndex = subscriptions.findIndex((subscription) => subscription.id === id);
  if (existingIndex >= 0) {
    subscriptions[existingIndex] = item;
  } else {
    subscriptions.push(item);
  }

  persistSubscriptions();
  closeDialog();
  render();
  showToast("Abonelik kaydedildi.");
}

function deleteCurrentSubscription() {
  const id = els.subscriptionId.value;
  if (!id) return;
  subscriptions = subscriptions.filter((item) => item.id !== id);
  persistSubscriptions();
  closeDialog();
  render();
  showToast("Abonelik silindi.");
}

function populateCategoryFilter() {
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.append(option);
  });
}

function renderCurrencyButtons() {
  els.currencyButtons.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.currency === settings.currency);
  });
}

function loadSubscriptions() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return sampleSubscriptions;
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : sampleSubscriptions;
  } catch {
    return sampleSubscriptions;
  }
}

function persistSubscriptions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
}

function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (!saved) return { currency: "TRY" };
  try {
    return { currency: "TRY", ...JSON.parse(saved) };
  } catch {
    return { currency: "TRY" };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function monthlyValue(item) {
  return Number(item.price || 0) * cycleMonthlyFactor[item.cycle];
}

function getUpcoming(items, dayLimit) {
  return items.filter((item) => {
    const days = daysUntil(item.nextDate);
    return days >= 0 && days <= dayLimit;
  });
}

function daysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
}

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: settings.currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function setTodayLabel() {
  els.todayLabel.textContent = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function exportJson() {
  downloadFile(
    "abonelikler.json",
    JSON.stringify({ settings, subscriptions }, null, 2),
    "application/json"
  );
  showToast("JSON dosyası hazırlandı.");
}

function exportCsv() {
  const header = ["Ad", "Tutar", "Döngü", "Kategori", "Sonraki ödeme", "Durum", "Not"];
  const rows = subscriptions.map((item) => [
    item.name,
    item.price,
    cycleLabels[item.cycle],
    item.category,
    item.nextDate,
    item.active ? "Aktif" : "Pasif",
    item.note,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  downloadFile("abonelikler.csv", csv, "text/csv");
  showToast("CSV dosyası hazırlandı.");
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = Array.isArray(parsed) ? parsed : parsed.subscriptions;
      if (!Array.isArray(imported)) throw new Error("Invalid data");
      subscriptions = imported.map((item) => ({
        id: item.id || createId(),
        name: String(item.name || "Adsız"),
        price: Number(item.price || 0),
        cycle: cycleMonthlyFactor[item.cycle] ? item.cycle : "monthly",
        category: categories.includes(item.category) ? item.category : "Diğer",
        nextDate: item.nextDate || offsetDate(7),
        note: String(item.note || ""),
        active: item.active !== false,
      }));
      if (parsed.settings?.currency) settings.currency = parsed.settings.currency;
      persistSubscriptions();
      saveSettings();
      render();
      showToast("Veriler içe aktarıldı.");
    } catch {
      showToast("JSON dosyası okunamadı.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
