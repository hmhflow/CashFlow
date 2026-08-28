const TRANSACTION_STORAGE_KEY = "cashflow.transactions.v1";
const CATEGORY_STORAGE_KEY = "cashflow.categories.v1";
const PANEL_STORAGE_KEY = "cashflow.panels.v1";
const VIEW_STORAGE_KEY = "cashflow.active-view.v1";

const DEFAULT_CATEGORIES = [
  { id: "cat-salary", name: "Nhận lương", type: "income" },
  { id: "cat-haircut", name: "Cắt tóc", type: "expense" },
  { id: "cat-shopping", name: "Mua đồ dùng", type: "expense" },
  { id: "cat-fuel", name: "Xăng xe", type: "expense" },
];

const CHART_COLORS = [
  "#0ea5e9",
  "#f97316",
  "#8b5cf6",
  "#10b981",
  "#ec4899",
  "#f59e0b",
  "#14b8a6",
  "#6366f1",
  "#ef4444",
];

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN");
const canonicalFormatter = new Intl.Collator("vi", { sensitivity: "base" });

const transactionPanelElement = document.getElementById("transaction-panel");
const categoryPanelElement = document.getElementById("category-panel");

const transactionForm = document.getElementById("transaction-form");
const categoryInput = document.getElementById("category");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("date");
const noteInput = document.getElementById("note");
const submitTransactionButton = document.getElementById("submit-transaction");
const cancelEditTransactionButton = document.getElementById("cancel-edit-transaction");
const editingTransactionHintElement = document.getElementById("editing-transaction-hint");
const categoryTypeHintElement = document.getElementById("category-type-hint");

const categoryForm = document.getElementById("category-form");
const newCategoryNameInput = document.getElementById("new-category-name");
const newCategoryTypeInput = document.getElementById("new-category-type");
const categoryListElement = document.getElementById("category-list");

const filterModeInput = document.getElementById("filter-mode");
const filterMonthInput = document.getElementById("filter-month");
const fromDateInput = document.getElementById("from-date");
const toDateInput = document.getElementById("to-date");
const filterTypeInput = document.getElementById("filter-type");
const filterCategoryInput = document.getElementById("filter-category");
const minAmountInput = document.getElementById("min-amount");
const maxAmountInput = document.getElementById("max-amount");
const keywordFilterInput = document.getElementById("keyword-filter");
const monthFilterWrap = document.getElementById("month-filter-wrap");
const fromDateWrap = document.getElementById("from-date-wrap");
const toDateWrap = document.getElementById("to-date-wrap");
const advancedFilterPanelElement = document.getElementById("advanced-filter-panel");
const toggleAdvancedFilterButton = document.getElementById("toggle-advanced-filter");
const resetFilterButton = document.getElementById("reset-filter");
const activeRangeLabelElement = document.getElementById("active-range-label");
const pageMenuButtons = Array.from(document.querySelectorAll("button[data-view-target]"));
const viewSections = Array.from(document.querySelectorAll(".app-view[data-view]"));

const exportJsonButton = document.getElementById("export-json");
const exportCsvButton = document.getElementById("export-csv");
const importTriggerButton = document.getElementById("import-trigger");
const importFileInput = document.getElementById("import-file");

const balanceElement = document.getElementById("balance");
const totalIncomeElement = document.getElementById("total-income");
const totalExpenseElement = document.getElementById("total-expense");
const totalTransactionsElement = document.getElementById("total-transactions");
const transactionListElement = document.getElementById("transaction-list");
const clearAllButton = document.getElementById("clear-all");

let expenseCategoryChart;
let cashflowChart;

let transactions = loadTransactions();
let categories = loadCategories(transactions);
let filterState = createInitialFilterState();
let activeView = loadActiveView();
let advancedFilterOpen = false;
let editingTransactionId = null;

initializeCollapsiblePanels();
initializeViewNavigation();
saveTransactions(transactions);
saveCategories(categories);
ensureDefaultTransactionDate();
formatAmountInputValue();
syncFilterControls();
applyAdvancedFilterVisibility();
bindEvents();
render();

function bindEvents() {
  transactionForm.addEventListener("submit", handleAddTransaction);
  amountInput.addEventListener("input", handleAmountInputInput);
  clearAllButton.addEventListener("click", handleClearAllTransactions);
  transactionListElement.addEventListener("click", handleTransactionListClick);
  cancelEditTransactionButton.addEventListener("click", handleCancelEditTransaction);

  categoryInput.addEventListener("change", updateSelectedCategoryHint);
  categoryForm.addEventListener("submit", handleAddCategory);
  categoryListElement.addEventListener("click", handleDeleteCategory);

  filterModeInput.addEventListener("change", handleFilterModeChange);
  filterMonthInput.addEventListener("change", handleTimeFilterFieldChange);
  fromDateInput.addEventListener("change", handleTimeFilterFieldChange);
  toDateInput.addEventListener("change", handleTimeFilterFieldChange);

  filterTypeInput.addEventListener("change", handleAdvancedFilterChange);
  filterCategoryInput.addEventListener("change", handleAdvancedFilterChange);
  minAmountInput.addEventListener("input", handleAdvancedFilterChange);
  maxAmountInput.addEventListener("input", handleAdvancedFilterChange);
  keywordFilterInput.addEventListener("input", handleAdvancedFilterChange);
  toggleAdvancedFilterButton.addEventListener("click", handleToggleAdvancedFilter);

  resetFilterButton.addEventListener("click", handleResetFilter);

  exportJsonButton.addEventListener("click", handleExportJson);
  exportCsvButton.addEventListener("click", handleExportCsv);
  importTriggerButton.addEventListener("click", handleOpenImportDialog);
  importFileInput.addEventListener("change", handleImportFile);

  for (const button of pageMenuButtons) {
    button.addEventListener("click", handleSwitchView);
  }
}

function initializeCollapsiblePanels() {
  const panelState = loadPanelState();

  if (typeof panelState.transactionOpen === "boolean") {
    transactionPanelElement.open = panelState.transactionOpen;
  }
  if (typeof panelState.categoryOpen === "boolean") {
    categoryPanelElement.open = panelState.categoryOpen;
  }

  transactionPanelElement.addEventListener("toggle", persistPanelState);
  categoryPanelElement.addEventListener("toggle", persistPanelState);
}

function persistPanelState() {
  const nextState = {
    transactionOpen: transactionPanelElement.open,
    categoryOpen: categoryPanelElement.open,
  };

  try {
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    console.error("Không thể lưu trạng thái thu gọn/mở rộng.", error);
  }
}

function loadPanelState() {
  const rawData = localStorage.getItem(PANEL_STORAGE_KEY);
  if (!rawData) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawData);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return {};
  } catch (error) {
    console.error("Không thể đọc trạng thái thu gọn/mở rộng.", error);
    return {};
  }
}

function initializeViewNavigation() {
  if (!isValidView(activeView)) {
    activeView = "overview";
  }

  applyActiveView();
  saveActiveView(activeView);
}

function handleSwitchView(event) {
  const target = event.currentTarget;
  if (!target || !target.dataset) {
    return;
  }

  const nextView = target.dataset.viewTarget;
  if (!isValidView(nextView) || nextView === activeView) {
    return;
  }

  activeView = nextView;
  applyActiveView();
  saveActiveView(activeView);
  render();
}

function applyActiveView() {
  for (const section of viewSections) {
    const sectionView = section.dataset.view;
    section.classList.toggle("hidden", sectionView !== activeView);
  }

  for (const button of pageMenuButtons) {
    const buttonView = button.dataset.viewTarget;
    button.classList.toggle("is-active", buttonView === activeView);
  }
}

function loadActiveView() {
  const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
  if (isValidView(savedView)) {
    return savedView;
  }
  return "overview";
}

function saveActiveView(view) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch (error) {
    console.error("Không thể lưu trạng thái trang hiện tại.", error);
  }
}

function isValidView(view) {
  return view === "overview" || view === "manage" || view === "backup";
}

function handleAddTransaction(event) {
  event.preventDefault();

  if (categories.length === 0) {
    alert("Vui lòng thêm ít nhất một danh mục trước khi tạo giao dịch.");
    return;
  }

  const selectedCategory = categories.find((item) => item.id === categoryInput.value);
  if (!selectedCategory) {
    alert("Danh mục không hợp lệ. Vui lòng chọn lại.");
    return;
  }

  const date = normalizeDateValue(dateInput.value);
  const note = noteInput.value.trim();
  const amount = parseCurrencyInput(amountInput.value);

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Số tiền phải lớn hơn 0.");
    return;
  }

  const transactionPayload = {
    categoryId: selectedCategory.id,
    categoryName: selectedCategory.name,
    type: selectedCategory.type,
    amount,
    date,
    note,
  };

  if (editingTransactionId) {
    const editingIndex = transactions.findIndex((item) => item.id === editingTransactionId);
    if (editingIndex < 0) {
      alert("Không tìm thấy giao dịch cần chỉnh sửa. Vui lòng thao tác lại.");
      clearEditingTransactionState();
      return;
    }

    const currentTransaction = transactions[editingIndex];
    const updatedTransaction = {
      ...currentTransaction,
      ...transactionPayload,
      id: currentTransaction.id,
      createdAt: currentTransaction.createdAt,
    };

    const nextTransactions = [...transactions];
    nextTransactions[editingIndex] = updatedTransaction;
    transactions = nextTransactions;
  } else {
    const transaction = {
      id: createId(),
      ...transactionPayload,
      createdAt: Date.now(),
    };
    transactions = [transaction, ...transactions];
  }

  clearEditingTransactionState();
  saveTransactions(transactions);
  render();

  const selectedCategoryId = selectedCategory.id;
  transactionForm.reset();
  ensureDefaultTransactionDate();
  formatAmountInputValue();
  if (categories.some((item) => item.id === selectedCategoryId)) {
    categoryInput.value = selectedCategoryId;
  }
  updateSelectedCategoryHint();
}

function handleAmountInputInput() {
  const digits = extractDigits(amountInput.value);
  if (!digits) {
    amountInput.value = "";
    return;
  }

  amountInput.value = formatThousandsFromDigits(digits);
}

function handleTransactionListClick(event) {
  const editButton = event.target.closest("button[data-edit-id]");
  if (editButton) {
    startEditingTransaction(editButton.dataset.editId);
    return;
  }

  const removeButton = event.target.closest("button[data-delete-id]");
  if (!removeButton) {
    return;
  }

  const id = removeButton.dataset.deleteId;
  const nextTransactions = transactions.filter((item) => item.id !== id);
  if (nextTransactions.length === transactions.length) {
    return;
  }

  transactions = nextTransactions;
  if (editingTransactionId === id) {
    clearEditingTransactionState();
  }
  saveTransactions(transactions);
  render();
}

function handleCancelEditTransaction() {
  if (!editingTransactionId) {
    return;
  }

  clearEditingTransactionState();
  transactionForm.reset();
  ensureDefaultTransactionDate();
  formatAmountInputValue();
  if (categories.length > 0) {
    categoryInput.value = categories[0].id;
    updateSelectedCategoryHint();
  }
}

function startEditingTransaction(transactionId) {
  const transaction = transactions.find((item) => item.id === transactionId);
  if (!transaction) {
    alert("Không tìm thấy giao dịch để chỉnh sửa.");
    return;
  }

  editingTransactionId = transaction.id;

  if (activeView !== "manage") {
    activeView = "manage";
    applyActiveView();
    saveActiveView(activeView);
  }

  if (transactionPanelElement) {
    transactionPanelElement.open = true;
  }

  const categoryExists = categories.some((item) => item.id === transaction.categoryId);
  if (categoryExists) {
    categoryInput.value = transaction.categoryId;
  } else if (categories.length > 0) {
    categoryInput.value = categories[0].id;
  }

  amountInput.value = formatThousandsFromDigits(String(transaction.amount));
  dateInput.value = normalizeDateValue(transaction.date);
  noteInput.value = transaction.note || "";

  applyEditingTransactionStateUI();
  updateSelectedCategoryHint();
  activeRangeLabelElement.textContent = describeHeaderPillText(activeView, filterState);
  amountInput.focus();
}

function clearEditingTransactionState() {
  if (!editingTransactionId) {
    applyEditingTransactionStateUI();
    return;
  }

  editingTransactionId = null;
  applyEditingTransactionStateUI();
}

function applyEditingTransactionStateUI() {
  const isEditing = Boolean(editingTransactionId);
  submitTransactionButton.textContent = isEditing ? "Cập nhật giao dịch" : "Lưu giao dịch";
  cancelEditTransactionButton.classList.toggle("hidden", !isEditing);

  if (!isEditing) {
    editingTransactionHintElement.classList.add("hidden");
    editingTransactionHintElement.textContent = "";
    return;
  }

  const transaction = transactions.find((item) => item.id === editingTransactionId);
  if (!transaction) {
    editingTransactionId = null;
    editingTransactionHintElement.classList.add("hidden");
    editingTransactionHintElement.textContent = "";
    submitTransactionButton.textContent = "Lưu giao dịch";
    cancelEditTransactionButton.classList.add("hidden");
    return;
  }

  editingTransactionHintElement.textContent =
    `Đang chỉnh sửa: ${formatDate(transaction.date)} • ${transaction.categoryName} • ${currencyFormatter.format(transaction.amount)}`;
  editingTransactionHintElement.classList.remove("hidden");
}

function handleClearAllTransactions() {
  if (transactions.length === 0) {
    return;
  }

  const confirmed = confirm("Bạn chắc chắn muốn xóa toàn bộ dữ liệu giao dịch?");
  if (!confirmed) {
    return;
  }

  transactions = [];
  clearEditingTransactionState();
  saveTransactions(transactions);
  render();
}

function handleAddCategory(event) {
  event.preventDefault();

  const name = normalizeCategoryName(newCategoryNameInput.value);
  const type = newCategoryTypeInput.value === "income" ? "income" : "expense";

  if (!name) {
    alert("Tên danh mục không được để trống.");
    return;
  }

  const isDuplicate = categories.some((item) => isSameName(item.name, name));
  if (isDuplicate) {
    alert("Danh mục này đã tồn tại.");
    return;
  }

  const newCategory = {
    id: createId(),
    name,
    type,
  };

  categories = [...categories, newCategory];
  saveCategories(categories);
  render();

  categoryInput.value = newCategory.id;
  updateSelectedCategoryHint();

  categoryForm.reset();
  newCategoryTypeInput.value = "expense";
}

function handleDeleteCategory(event) {
  const removeButton = event.target.closest("button[data-remove-category-id]");
  if (!removeButton) {
    return;
  }

  const categoryId = removeButton.dataset.removeCategoryId;
  const category = categories.find((item) => item.id === categoryId);
  if (!category) {
    return;
  }

  const usageCount = getCategoryUsageCount(category);
  if (usageCount > 0) {
    alert("Không thể xóa danh mục đã có giao dịch.");
    return;
  }

  categories = categories.filter((item) => item.id !== categoryId);
  if (filterState.categoryId === categoryId) {
    filterState.categoryId = "all";
  }

  saveCategories(categories);
  render();
}

function handleFilterModeChange() {
  filterState.mode = filterModeInput.value;

  if ((filterState.mode === "month" || filterState.mode === "custom") && !advancedFilterOpen) {
    advancedFilterOpen = true;
    applyAdvancedFilterVisibility();
  }

  toggleFilterFieldsByMode();
  render();
}

function handleTimeFilterFieldChange() {
  filterState.month = filterMonthInput.value;
  filterState.fromDate = fromDateInput.value;
  filterState.toDate = toDateInput.value;
  render();
}

function handleAdvancedFilterChange() {
  filterState.type = filterTypeInput.value;
  filterState.categoryId = filterCategoryInput.value;
  filterState.minAmount = minAmountInput.value.trim();
  filterState.maxAmount = maxAmountInput.value.trim();
  filterState.keyword = keywordFilterInput.value.trim();
  render();
}

function handleResetFilter() {
  filterState = createInitialFilterState();
  advancedFilterOpen = false;
  syncFilterControls();
  applyAdvancedFilterVisibility();
  render();
}

function handleToggleAdvancedFilter() {
  advancedFilterOpen = !advancedFilterOpen;
  applyAdvancedFilterVisibility();
}

function handleExportJson() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    categories,
    transactions,
  };

  const fileName = `cashflow-backup-${formatFileTimestamp(new Date())}.json`;
  downloadTextFile(fileName, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
}

function handleExportCsv() {
  const csvData = serializeBackupToCsv(categories, transactions);
  const fileName = `cashflow-backup-${formatFileTimestamp(new Date())}.csv`;
  downloadTextFile(fileName, csvData, "text/csv;charset=utf-8");
}

function handleOpenImportDialog() {
  importFileInput.click();
}

async function handleImportFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const importedData = parseImportedFile(file.name, text);

    if (importedData.transactions.length === 0 && importedData.categories.length === 0) {
      alert("File không có dữ liệu hợp lệ để nhập.");
      return;
    }

    const confirmed = confirm(
      `Khôi phục ${importedData.transactions.length} giao dịch và ${importedData.categories.length} danh mục từ "${file.name}"? Dữ liệu hiện tại sẽ bị thay thế.`,
    );
    if (!confirmed) {
      return;
    }

    transactions = importedData.transactions;
    categories = importedData.categories;
    filterState = createInitialFilterState();
    clearEditingTransactionState();

    saveTransactions(transactions);
    saveCategories(categories);
    syncFilterControls();
    render();
    alert("Nhập dữ liệu thành công.");
  } catch (error) {
    console.error("Không thể nhập dữ liệu từ file.", error);
    alert("Không thể nhập dữ liệu. Hãy kiểm tra định dạng file JSON/CSV.");
  } finally {
    importFileInput.value = "";
  }
}

function render() {
  renderCategorySelect();
  renderCategoryList();
  renderCategoryFilterOptions();
  applyEditingTransactionStateUI();
  updateSelectedCategoryHint();

  const filteredTransactions = applyFilters(transactions, filterState);
  const summary = summarizeTransactions(filteredTransactions);

  activeRangeLabelElement.textContent = describeHeaderPillText(activeView, filterState);
  renderSummary(summary);
  renderTransactions(filteredTransactions);

  if (activeView === "overview") {
    renderCharts(summary);
  } else {
    destroyCharts();
  }
}

function renderCategorySelect() {
  const previousValue = categoryInput.value;

  if (categories.length === 0) {
    clearEditingTransactionState();
    categoryInput.innerHTML = "<option value=''>Chưa có danh mục</option>";
    categoryInput.value = "";
    toggleTransactionFormDisabled(true);
    categoryTypeHintElement.textContent = "Hãy thêm danh mục để bắt đầu tạo giao dịch.";
    return;
  }

  categoryInput.innerHTML = categories
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
    .join("");

  const hasPreviousValue = categories.some((item) => item.id === previousValue);
  categoryInput.value = hasPreviousValue ? previousValue : categories[0].id;
  toggleTransactionFormDisabled(false);
}

function renderCategoryFilterOptions() {
  const currentValue = filterState.categoryId;
  const options = [
    "<option value='all'>Tất cả danh mục</option>",
    ...categories.map((item) => {
      const suffix = item.type === "income" ? " (Thu nhập)" : " (Chi tiêu)";
      return `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name + suffix)}</option>`;
    }),
  ];

  filterCategoryInput.innerHTML = options.join("");

  const stillExists = currentValue === "all" || categories.some((item) => item.id === currentValue);
  filterState.categoryId = stillExists ? currentValue : "all";
  filterCategoryInput.value = filterState.categoryId;
}

function renderCategoryList() {
  if (categories.length === 0) {
    categoryListElement.innerHTML = "<p class='empty'>Chưa có danh mục nào.</p>";
    return;
  }

  const rows = categories
    .map((item) => {
      const typeLabel = item.type === "income" ? "Thu nhập" : "Chi tiêu";
      const typeClass = item.type === "income" ? "income" : "expense";
      const count = getCategoryUsageCount(item);
      const canDelete = count === 0;

      const actionButton = canDelete
        ? `<button type="button" class="icon-btn" data-remove-category-id="${escapeHtml(item.id)}">Xóa</button>`
        : "<button type='button' class='icon-btn' disabled title='Đã có giao dịch'>Khóa</button>";

      return `
        <div class="category-item">
          <div class="category-meta">
            <span class="category-name">${escapeHtml(item.name)}</span>
            <span class="type-pill ${typeClass}">${typeLabel}</span>
            <span class="count-pill">${count} giao dịch</span>
          </div>
          ${actionButton}
        </div>
      `;
    })
    .join("");

  categoryListElement.innerHTML = rows;
}

function renderSummary(summary) {
  const balance = summary.totalIncome - summary.totalExpense;
  balanceElement.textContent = currencyFormatter.format(balance);
  balanceElement.classList.toggle("negative", balance < 0);

  totalIncomeElement.textContent = currencyFormatter.format(summary.totalIncome);
  totalExpenseElement.textContent = currencyFormatter.format(summary.totalExpense);
  totalTransactionsElement.textContent = String(summary.totalTransactions);
}

function renderTransactions(items) {
  if (items.length === 0) {
    transactionListElement.innerHTML = `
      <tr>
        <td colspan="6" class="empty">Không có giao dịch trong bộ lọc hiện tại.</td>
      </tr>
    `;
    return;
  }

  const sortedItems = [...items].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) {
      return byDate;
    }
    return b.createdAt - a.createdAt;
  });

  transactionListElement.innerHTML = sortedItems
    .map((item) => {
      const typeLabel = item.type === "income" ? "Thu nhập" : "Chi tiêu";
      const typeClass = item.type === "income" ? "income" : "expense";
      const amountClass = item.type === "income" ? "amount-income" : "amount-expense";
      const amountLabel = item.type === "income" ? `+${currencyFormatter.format(item.amount)}` : `-${currencyFormatter.format(item.amount)}`;

      return `
        <tr>
          <td>${escapeHtml(formatDate(item.date))}</td>
          <td>${escapeHtml(item.categoryName)}</td>
          <td><span class="type-pill ${typeClass}">${typeLabel}</span></td>
          <td>${escapeHtml(item.note || "-")}</td>
          <td class="${amountClass}">${amountLabel}</td>
          <td>
            <div class="table-actions">
              <button class="icon-btn edit-btn" type="button" data-edit-id="${escapeHtml(item.id)}">Sửa</button>
              <button class="icon-btn" type="button" data-delete-id="${escapeHtml(item.id)}">Xóa</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderCharts(summary) {
  const expenseEntries = Object.entries(summary.expenseByCategory)
    .filter((entry) => entry[1] > 0)
    .sort((a, b) => b[1] - a[1]);

  const hasExpenseData = expenseEntries.length > 0;
  const expenseLabels = hasExpenseData ? expenseEntries.map((entry) => entry[0]) : ["Chưa có dữ liệu chi tiêu"];
  const expenseValues = hasExpenseData ? expenseEntries.map((entry) => entry[1]) : [1];
  const expenseColors = hasExpenseData
    ? expenseLabels.map((name, index) => getCategoryColor(name, index))
    : ["#cbd5e1"];
  const expenseChartCanvas = document.getElementById("expense-category-chart");
  const cashflowCanvas = document.getElementById("cashflow-chart");

  if (expenseCategoryChart) {
    expenseCategoryChart.destroy();
  }

  expenseCategoryChart = new Chart(expenseChartCanvas, {
    type: "doughnut",
    data: {
      labels: expenseLabels,
      datasets: [
        {
          data: expenseValues,
          backgroundColor: expenseColors,
          borderColor: "#ffffff",
          borderWidth: 2,
          spacing: 2,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "64%",
      layout: {
        padding: 6,
      },
      animation: {
        duration: 700,
        easing: "easeOutQuart",
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#24486b",
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8,
            padding: 14,
            font: {
              size: 12,
              weight: "600",
            },
          },
        },
        tooltip: {
          backgroundColor: "#0f4c81",
          titleColor: "#f0f9ff",
          bodyColor: "#f0f9ff",
          cornerRadius: 10,
          padding: 10,
          callbacks: {
            label(context) {
              if (!hasExpenseData) {
                return "Chưa có khoản chi";
              }
              const label = context.label || "";
              const value = context.parsed || 0;
              return `${label}: ${currencyFormatter.format(value)}`;
            },
          },
        },
      },
    },
  });

  if (cashflowChart) {
    cashflowChart.destroy();
  }

  const incomeBarGradient = createVerticalGradient(cashflowCanvas, "#36b6ff", "#0b6ed0");
  const expenseBarGradient = createVerticalGradient(cashflowCanvas, "#ff8aa0", "#e24f6a");

  cashflowChart = new Chart(cashflowCanvas, {
    type: "bar",
    data: {
      labels: ["Thu nhập", "Chi tiêu"],
      datasets: [
        {
          label: "Tổng tiền",
          data: [summary.totalIncome, summary.totalExpense],
          backgroundColor: [incomeBarGradient, expenseBarGradient],
          borderRadius: 12,
          borderSkipped: false,
          maxBarThickness: 66,
          categoryPercentage: 0.58,
          barPercentage: 0.88,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 8,
          left: 6,
          right: 6,
          bottom: 2,
        },
      },
      animation: {
        duration: 760,
        easing: "easeOutQuart",
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            color: "#245681",
            font: {
              size: 12,
              weight: "700",
            },
          },
        },
        y: {
          beginAtZero: true,
          grace: "10%",
          grid: {
            color: "rgba(12, 74, 138, 0.14)",
            drawBorder: false,
          },
          ticks: {
            color: "#2f5f8c",
            maxTicksLimit: 5,
            callback(value) {
              return formatAxisCurrency(Number(value));
            },
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#0f4c81",
          titleColor: "#f0f9ff",
          bodyColor: "#f0f9ff",
          cornerRadius: 10,
          padding: 10,
          callbacks: {
            label(context) {
              return currencyFormatter.format(context.parsed.y || 0);
            },
          },
        },
      },
    },
  });
}

function destroyCharts() {
  if (expenseCategoryChart) {
    expenseCategoryChart.destroy();
    expenseCategoryChart = null;
  }

  if (cashflowChart) {
    cashflowChart.destroy();
    cashflowChart = null;
  }
}

function createVerticalGradient(canvas, startColor, endColor) {
  const context = canvas.getContext("2d");
  if (!context) {
    return startColor;
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height || 300);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  return gradient;
}

function applyFilters(items, filters) {
  const timeFiltered = applyTimeFilter(items, filters);
  const amountRange = resolveAmountBounds(filters.minAmount, filters.maxAmount);
  const keyword = normalizeLookupText(filters.keyword);

  return timeFiltered.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) {
      return false;
    }

    if (filters.categoryId !== "all" && item.categoryId !== filters.categoryId) {
      return false;
    }

    if (amountRange.min !== null && item.amount < amountRange.min) {
      return false;
    }

    if (amountRange.max !== null && item.amount > amountRange.max) {
      return false;
    }

    if (keyword) {
      const noteText = normalizeLookupText(item.note || "");
      if (!noteText.includes(keyword)) {
        return false;
      }
    }

    return true;
  });
}

function resolveAmountBounds(minAmountValue, maxAmountValue) {
  let min = parseFilterAmount(minAmountValue);
  let max = parseFilterAmount(maxAmountValue);

  if (min !== null && max !== null && min > max) {
    const temp = min;
    min = max;
    max = temp;
  }

  return { min, max };
}

function parseFilterAmount(rawValue) {
  if (rawValue === "") {
    return null;
  }

  const number = Number(rawValue);
  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return Math.round(number);
}

function summarizeTransactions(items) {
  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory = {};

  for (const item of items) {
    if (item.type === "income") {
      totalIncome += item.amount;
      continue;
    }

    totalExpense += item.amount;
    expenseByCategory[item.categoryName] = (expenseByCategory[item.categoryName] || 0) + item.amount;
  }

  return {
    totalIncome,
    totalExpense,
    totalTransactions: items.length,
    expenseByCategory,
  };
}

function applyTimeFilter(items, filters) {
  const range = resolveFilterRange(filters);
  if (!range) {
    return [...items];
  }

  return items.filter((item) => item.date >= range.start && item.date <= range.end);
}

function resolveFilterRange(filters) {
  if (filters.mode === "all") {
    return null;
  }

  if (filters.mode === "this-month") {
    return getMonthBounds(new Date());
  }

  if (filters.mode === "last-month") {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return getMonthBounds(previousMonth);
  }

  if (filters.mode === "month") {
    if (!isMonthInput(filters.month)) {
      return null;
    }

    const [year, month] = filters.month.split("-").map(Number);
    return getMonthBounds(new Date(year, month - 1, 1));
  }

  if (filters.mode === "custom") {
    const hasFromDate = isDateInput(filters.fromDate);
    const hasToDate = isDateInput(filters.toDate);

    if (!hasFromDate && !hasToDate) {
      return null;
    }

    let start = hasFromDate ? filters.fromDate : "0000-01-01";
    let end = hasToDate ? filters.toDate : "9999-12-31";

    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }

    return { start, end };
  }

  return null;
}

function describeActiveFilters(filters) {
  const parts = [describeFilterRange(filters)];
  const amountRange = resolveAmountBounds(filters.minAmount, filters.maxAmount);

  if (filters.type === "income") {
    parts.push("Loại: Thu nhập");
  } else if (filters.type === "expense") {
    parts.push("Loại: Chi tiêu");
  }

  if (filters.categoryId !== "all") {
    const category = categories.find((item) => item.id === filters.categoryId);
    if (category) {
      parts.push(`Danh mục: ${category.name}`);
    }
  }

  if (amountRange.min !== null || amountRange.max !== null) {
    const minLabel = amountRange.min !== null ? currencyFormatter.format(amountRange.min) : "0 ₫";
    const maxLabel = amountRange.max !== null ? currencyFormatter.format(amountRange.max) : "Không giới hạn";
    parts.push(`Tiền: ${minLabel} - ${maxLabel}`);
  }

  if (filters.keyword) {
    parts.push(`Ghi chú chứa: "${filters.keyword}"`);
  }

  if (parts.length === 1) {
    return parts[0];
  }
  return `${parts[0]} | ${parts.slice(1).join(" • ")}`;
}

function describeHeaderPillText(view, filters) {
  if (view === "manage") {
    return "Trang giao dịch & danh mục";
  }

  if (view === "backup") {
    return "Trang sao lưu & khôi phục";
  }

  return `Trang tổng quan | ${describeActiveFilters(filters)}`;
}

function applyAdvancedFilterVisibility() {
  if (!advancedFilterPanelElement || !toggleAdvancedFilterButton) {
    return;
  }

  advancedFilterPanelElement.classList.toggle("hidden", !advancedFilterOpen);
  toggleAdvancedFilterButton.setAttribute("aria-expanded", advancedFilterOpen ? "true" : "false");
  toggleAdvancedFilterButton.textContent = advancedFilterOpen ? "Thu gọn lọc nâng cao" : "Mở lọc nâng cao";
}

function describeFilterRange(filters) {
  if (filters.mode === "all") {
    return "Toàn bộ thời gian";
  }

  if (filters.mode === "this-month") {
    return `Tháng ${formatMonthText(toDateInputValue(new Date()).slice(0, 7))}`;
  }

  if (filters.mode === "last-month") {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
    return `Tháng ${formatMonthText(monthKey)}`;
  }

  if (filters.mode === "month") {
    return filters.month ? `Tháng ${formatMonthText(filters.month)}` : "Theo tháng cụ thể";
  }

  if (filters.mode === "custom") {
    const hasFromDate = isDateInput(filters.fromDate);
    const hasToDate = isDateInput(filters.toDate);

    if (hasFromDate && hasToDate) {
      const range = resolveFilterRange(filters);
      return `${formatDate(range.start)} - ${formatDate(range.end)}`;
    }
    if (hasFromDate) {
      return `Từ ${formatDate(filters.fromDate)}`;
    }
    if (hasToDate) {
      return `Đến ${formatDate(filters.toDate)}`;
    }
    return "Khoảng tùy chọn";
  }

  return "Toàn bộ thời gian";
}

function toggleFilterFieldsByMode() {
  const mode = filterState.mode;
  monthFilterWrap.classList.toggle("hidden", mode !== "month");
  fromDateWrap.classList.toggle("hidden", mode !== "custom");
  toDateWrap.classList.toggle("hidden", mode !== "custom");
}

function syncFilterControls() {
  filterModeInput.value = filterState.mode;
  filterMonthInput.value = filterState.month;
  fromDateInput.value = filterState.fromDate;
  toDateInput.value = filterState.toDate;
  filterTypeInput.value = filterState.type;
  filterCategoryInput.value = filterState.categoryId;
  minAmountInput.value = filterState.minAmount;
  maxAmountInput.value = filterState.maxAmount;
  keywordFilterInput.value = filterState.keyword;

  toggleFilterFieldsByMode();
}

function createInitialFilterState() {
  const today = new Date();
  const todayText = toDateInputValue(today);
  const month = todayText.slice(0, 7);

  return {
    mode: "this-month",
    month,
    fromDate: `${month}-01`,
    toDate: todayText,
    type: "all",
    categoryId: "all",
    minAmount: "",
    maxAmount: "",
    keyword: "",
  };
}

function getMonthBounds(date) {
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const firstDate = new Date(year, monthIndex, 1);
  const lastDate = new Date(year, monthIndex + 1, 0);

  return {
    start: toDateInputValue(firstDate),
    end: toDateInputValue(lastDate),
  };
}

function updateSelectedCategoryHint() {
  const selectedCategory = categories.find((item) => item.id === categoryInput.value);
  if (!selectedCategory) {
    return;
  }

  const typeLabel = selectedCategory.type === "income" ? "Thu nhập" : "Chi tiêu";
  categoryTypeHintElement.textContent = `Danh mục đang chọn thuộc nhóm: ${typeLabel}.`;
}

function toggleTransactionFormDisabled(disabled) {
  categoryInput.disabled = disabled;
  amountInput.disabled = disabled;
  dateInput.disabled = disabled;
  noteInput.disabled = disabled;
  submitTransactionButton.disabled = disabled;
}

function getCategoryUsageCount(category) {
  return transactions.filter((item) => item.categoryId === category.id || isSameName(item.categoryName, category.name)).length;
}

function getCategoryColor(name, index) {
  const key = normalizeLookupText(name);
  let hash = 0;

  for (const character of key) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return CHART_COLORS[(hash + index) % CHART_COLORS.length];
}

function ensureDefaultTransactionDate() {
  if (!dateInput.value) {
    dateInput.value = toDateInputValue(new Date());
  }
}

function formatAmountInputValue() {
  const digits = extractDigits(amountInput.value);
  amountInput.value = digits ? formatThousandsFromDigits(digits) : "";
}

function parseCurrencyInput(value) {
  const digits = extractDigits(value);
  if (!digits) {
    return NaN;
  }

  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : NaN;
}

function extractDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatThousandsFromDigits(digits) {
  const normalized = digits.replace(/^0+(?=\d)/, "");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseImportedFile(fileName, content) {
  const lowerName = fileName.toLowerCase();
  const trimmedContent = content.trim();

  if (lowerName.endsWith(".json")) {
    return parseJsonImport(trimmedContent);
  }

  if (lowerName.endsWith(".csv")) {
    return parseCsvImport(trimmedContent);
  }

  if (trimmedContent.startsWith("{") || trimmedContent.startsWith("[")) {
    return parseJsonImport(trimmedContent);
  }

  return parseCsvImport(trimmedContent);
}

function parseJsonImport(content) {
  const parsed = JSON.parse(content);
  let categoryCandidates = [];
  let transactionCandidates = [];

  if (Array.isArray(parsed)) {
    transactionCandidates = parsed;
  } else if (parsed && typeof parsed === "object") {
    categoryCandidates = Array.isArray(parsed.categories) ? parsed.categories : [];
    transactionCandidates = Array.isArray(parsed.transactions) ? parsed.transactions : [];
  } else {
    throw new Error("JSON không đúng định dạng.");
  }

  const normalizedTransactions = transactionCandidates.map(normalizeTransaction).filter(isValidTransaction);
  const normalizedCategoryCandidates = categoryCandidates.map(normalizeCategory).filter(Boolean);
  const normalizedCategories = buildCategoriesWithTransactions(normalizedCategoryCandidates, normalizedTransactions);

  return { categories: normalizedCategories, transactions: normalizedTransactions };
}

function parseCsvImport(content) {
  const rows = parseCsvRows(content);
  if (rows.length < 2) {
    throw new Error("CSV không có dữ liệu.");
  }

  const headers = rows[0];
  const headerMap = {};

  headers.forEach((header, index) => {
    const key = mapCsvHeader(header);
    if (key && headerMap[key] === undefined) {
      headerMap[key] = index;
    }
  });

  if (headerMap.recordType !== undefined) {
    return parseStructuredCsvImport(rows, headerMap);
  }

  return parseLegacyTransactionCsvImport(rows, headerMap);
}

function parseStructuredCsvImport(rows, headerMap) {
  const importedCategoryCandidates = [];
  const importedTransactions = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const recordType = normalizeCsvRecordType(getCsvCell(row, headerMap.recordType));

    if (recordType === "category") {
      const categoryName = getCsvCell(row, headerMap.name) || getCsvCell(row, headerMap.categoryName);
      const category = normalizeCategory({
        id: getCsvCell(row, headerMap.id),
        name: categoryName,
        type: getCsvCell(row, headerMap.type),
      });

      if (category) {
        importedCategoryCandidates.push(category);
      }
      continue;
    }

    if (recordType !== "transaction" && recordType !== "") {
      continue;
    }

    const rawCategoryName = getCsvCell(row, headerMap.categoryName) || getCsvCell(row, headerMap.name);
    if (!normalizeCategoryName(rawCategoryName)) {
      continue;
    }

    const transaction = normalizeTransaction({
      id: getCsvCell(row, headerMap.id),
      categoryId: getCsvCell(row, headerMap.categoryId),
      categoryName: rawCategoryName,
      type: getCsvCell(row, headerMap.type),
      amount: getCsvCell(row, headerMap.amount),
      date: getCsvCell(row, headerMap.date),
      note: getCsvCell(row, headerMap.note),
      createdAt: getCsvCell(row, headerMap.createdAt),
    });

    if (isValidTransaction(transaction)) {
      importedTransactions.push(transaction);
    }
  }

  if (importedCategoryCandidates.length === 0 && importedTransactions.length === 0) {
    throw new Error("CSV không chứa dữ liệu hợp lệ.");
  }

  const importedCategories = buildCategoriesWithTransactions(importedCategoryCandidates, importedTransactions);
  return { categories: importedCategories, transactions: importedTransactions };
}

function parseLegacyTransactionCsvImport(rows, headerMap) {
  const hasDate = headerMap.date !== undefined;
  const hasAmount = headerMap.amount !== undefined;
  const hasCategoryName = headerMap.categoryName !== undefined;
  if (!hasDate || !hasAmount || !hasCategoryName) {
    throw new Error("CSV thiếu cột bắt buộc: date, amount, categoryName.");
  }

  const importedTransactions = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rawCategoryName = getCsvCell(row, headerMap.categoryName);
    if (!normalizeCategoryName(rawCategoryName)) {
      continue;
    }

    const transaction = normalizeTransaction({
      id: getCsvCell(row, headerMap.id),
      categoryId: getCsvCell(row, headerMap.categoryId),
      categoryName: rawCategoryName,
      type: getCsvCell(row, headerMap.type),
      amount: getCsvCell(row, headerMap.amount),
      date: getCsvCell(row, headerMap.date),
      note: getCsvCell(row, headerMap.note),
      createdAt: getCsvCell(row, headerMap.createdAt),
    });

    if (isValidTransaction(transaction)) {
      importedTransactions.push(transaction);
    }
  }

  if (importedTransactions.length === 0) {
    throw new Error("CSV không chứa giao dịch hợp lệ.");
  }

  const importedCategories = buildCategoriesWithTransactions([], importedTransactions);
  return { categories: importedCategories, transactions: importedTransactions };
}

function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inQuotes) {
      if (char === "\"") {
        if (content[i + 1] === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((line) => line.some((value) => value.trim() !== ""));
}

function serializeBackupToCsv(categoryList, transactionList) {
  const headers = ["recordType", "id", "name", "type", "date", "categoryId", "categoryName", "amount", "note", "createdAt"];
  const lines = [headers.join(",")];

  for (const category of categoryList) {
    const row = [
      "category",
      category.id,
      category.name,
      category.type,
      "",
      "",
      "",
      "",
      "",
      "",
    ].map(toCsvCell);

    lines.push(row.join(","));
  }

  for (const item of transactionList) {
    const row = [
      "transaction",
      item.id,
      "",
      item.type,
      item.date,
      item.categoryId,
      item.categoryName,
      item.amount,
      item.note || "",
      item.createdAt,
    ].map(toCsvCell);

    lines.push(row.join(","));
  }

  return lines.join("\r\n");
}

function toCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function mapCsvHeader(header) {
  const normalized = normalizeLookupText(header);
  const map = {
    recordtype: "recordType",
    loaibanghi: "recordType",
    kieu: "recordType",
    id: "id",
    name: "name",
    ten: "name",
    date: "date",
    ngay: "date",
    categoryid: "categoryId",
    categoryname: "categoryName",
    category: "categoryName",
    danhmuc: "categoryName",
    type: "type",
    loai: "type",
    loaigiaodich: "type",
    amount: "amount",
    sotien: "amount",
    note: "note",
    ghichu: "note",
    createdat: "createdAt",
    thoigiantao: "createdAt",
  };

  return map[normalized] || null;
}

function normalizeCsvRecordType(value) {
  const normalized = normalizeLookupText(value);
  if (normalized === "category" || normalized === "danhmuc") {
    return "category";
  }
  if (normalized === "transaction" || normalized === "giaodich") {
    return "transaction";
  }
  return "";
}

function getCsvCell(row, index) {
  if (index === undefined || index < 0 || index >= row.length) {
    return "";
  }
  return row[index];
}

function downloadTextFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatFileTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function loadTransactions() {
  const rawData = localStorage.getItem(TRANSACTION_STORAGE_KEY);
  if (!rawData) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawData);
    if (!Array.isArray(parsed)) {
      console.error("Dữ liệu giao dịch trong localStorage không hợp lệ.");
      return [];
    }

    return parsed.map(normalizeTransaction).filter(isValidTransaction);
  } catch (error) {
    console.error("Không thể đọc dữ liệu giao dịch.", error);
    return [];
  }
}

function loadCategories(existingTransactions) {
  const rawData = localStorage.getItem(CATEGORY_STORAGE_KEY);
  let categoryCandidates = [];

  if (rawData) {
    try {
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed)) {
        categoryCandidates = parsed;
      } else {
        console.error("Dữ liệu danh mục trong localStorage không hợp lệ.");
      }
    } catch (error) {
      console.error("Không thể đọc dữ liệu danh mục.", error);
    }
  }

  if (categoryCandidates.length === 0) {
    categoryCandidates = DEFAULT_CATEGORIES.map((item) => ({ ...item }));
  }

  return buildCategoriesWithTransactions(categoryCandidates, existingTransactions);
}

function buildCategoriesWithTransactions(categoryCandidates, transactionList) {
  const uniqueCategories = [];
  const seenIds = new Set();
  const seenNames = new Set();

  for (const item of categoryCandidates) {
    const normalized = normalizeCategory(item);
    if (!normalized) {
      continue;
    }

    const nameKey = normalizeLookupText(normalized.name);
    if (seenNames.has(nameKey)) {
      continue;
    }

    let categoryId = normalized.id;
    if (seenIds.has(categoryId)) {
      categoryId = createId();
    }

    const category = {
      id: categoryId,
      name: normalized.name,
      type: normalized.type,
    };

    uniqueCategories.push(category);
    seenIds.add(category.id);
    seenNames.add(nameKey);
  }

  for (const transaction of transactionList) {
    const transactionName = normalizeCategoryName(transaction.categoryName) || "Khác";
    let matchedCategory = null;

    if (transaction.categoryId) {
      matchedCategory = uniqueCategories.find((item) => item.id === transaction.categoryId);
    }
    if (!matchedCategory) {
      matchedCategory = uniqueCategories.find((item) => isSameName(item.name, transactionName));
    }

    if (matchedCategory) {
      transaction.categoryId = matchedCategory.id;
      transaction.categoryName = matchedCategory.name;
      continue;
    }

    let categoryId = transaction.categoryId || createId();
    if (seenIds.has(categoryId)) {
      categoryId = createId();
    }

    const category = {
      id: categoryId,
      name: transactionName,
      type: transaction.type,
    };

    uniqueCategories.push(category);
    seenIds.add(category.id);
    seenNames.add(normalizeLookupText(category.name));
    transaction.categoryId = category.id;
    transaction.categoryName = category.name;
  }

  return uniqueCategories;
}

function saveTransactions(data) {
  try {
    localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Không thể lưu dữ liệu giao dịch vào localStorage.", error);
    alert("Không thể lưu dữ liệu giao dịch. Hãy kiểm tra dung lượng localStorage của trình duyệt.");
  }
}

function saveCategories(data) {
  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Không thể lưu dữ liệu danh mục vào localStorage.", error);
    alert("Không thể lưu dữ liệu danh mục. Hãy kiểm tra dung lượng localStorage của trình duyệt.");
  }
}

function normalizeTransaction(item) {
  const source = item && typeof item === "object" ? item : {};
  const categoryFromName = typeof source.categoryName === "string" ? source.categoryName : source.category;
  const categoryName = normalizeCategoryName(categoryFromName);
  const type = normalizeTransactionType(source.type, categoryName);

  return {
    id: typeof source.id === "string" && source.id ? source.id : createId(),
    categoryId: typeof source.categoryId === "string" ? source.categoryId : "",
    categoryName: categoryName || "Khác",
    type,
    amount: normalizeAmount(source.amount),
    date: normalizeDateValue(source.date),
    note: typeof source.note === "string" ? source.note.trim() : "",
    createdAt: Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : Date.now(),
  };
}

function normalizeCategory(item) {
  const source = item && typeof item === "object" ? item : {};
  const name = normalizeCategoryName(source.name);
  if (!name) {
    return null;
  }

  return {
    id: typeof source.id === "string" && source.id ? source.id : createId(),
    name,
    type: source.type === "income" ? "income" : "expense",
  };
}

function isValidTransaction(item) {
  return (
    item &&
    typeof item.id === "string" &&
    typeof item.categoryName === "string" &&
    item.categoryName.length > 0 &&
    (item.type === "income" || item.type === "expense") &&
    Number.isFinite(item.amount) &&
    item.amount > 0 &&
    isDateInput(item.date)
  );
}

function normalizeTransactionType(type, categoryName) {
  if (type === "income" || type === "expense") {
    return type;
  }

  const lookup = normalizeLookupText(categoryName);
  const incomeHints = ["luong", "salary", "thunhap", "doanhthu", "thuong", "bonus"];
  if (incomeHints.some((hint) => lookup.includes(hint))) {
    return "income";
  }

  return "expense";
}

function normalizeAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  return Math.round(number);
}

function normalizeDateValue(value) {
  if (isDateInput(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return toDateInputValue(parsed);
  }

  return toDateInputValue(new Date());
}

function normalizeCategoryName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function normalizeLookupText(value) {
  return normalizeCategoryName(value)
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isSameName(a, b) {
  return canonicalFormatter.compare(normalizeCategoryName(a), normalizeCategoryName(b)) === 0;
}

function formatMonthText(monthValue) {
  if (!isMonthInput(monthValue)) {
    return monthValue;
  }

  const [year, month] = monthValue.split("-");
  return `${month}/${year}`;
}

function formatAxisCurrency(value) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 1000000000) {
    return `${sign}${(absolute / 1000000000).toFixed(1).replace(".0", "")} tỷ`;
  }

  if (absolute >= 1000000) {
    return `${sign}${(absolute / 1000000).toFixed(1).replace(".0", "")}tr`;
  }

  if (absolute >= 1000) {
    return `${sign}${(absolute / 1000).toFixed(0)}k`;
  }

  return `${sign}${absolute}`;
}

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateFormatter.format(parsed);
}

function isDateInput(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMonthInput(value) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
