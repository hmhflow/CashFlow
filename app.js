const TRANSACTION_STORAGE_KEY = "cashflow.transactions.v1";
const CATEGORY_STORAGE_KEY = "cashflow.categories.v1";
const PANEL_STORAGE_KEY = "cashflow.panels.v1";

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
const resetFilterButton = document.getElementById("reset-filter");
const activeRangeLabelElement = document.getElementById("active-range-label");

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

initializeCollapsiblePanels();
saveTransactions(transactions);
saveCategories(categories);
ensureDefaultTransactionDate();
syncFilterControls();
bindEvents();
render();

function bindEvents() {
  transactionForm.addEventListener("submit", handleAddTransaction);
  clearAllButton.addEventListener("click", handleClearAllTransactions);
  transactionListElement.addEventListener("click", handleDeleteTransaction);

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

  resetFilterButton.addEventListener("click", handleResetFilter);

  exportJsonButton.addEventListener("click", handleExportJson);
  exportCsvButton.addEventListener("click", handleExportCsv);
  importTriggerButton.addEventListener("click", handleOpenImportDialog);
  importFileInput.addEventListener("change", handleImportFile);
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
  const rawAmount = Number(amountInput.value);
  const amount = Number.isFinite(rawAmount) ? Math.round(rawAmount) : NaN;

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Số tiền phải lớn hơn 0.");
    return;
  }

  const transaction = {
    id: createId(),
    categoryId: selectedCategory.id,
    categoryName: selectedCategory.name,
    type: selectedCategory.type,
    amount,
    date,
    note,
    createdAt: Date.now(),
  };

  transactions = [transaction, ...transactions];
  saveTransactions(transactions);
  render();

  const selectedCategoryId = selectedCategory.id;
  transactionForm.reset();
  ensureDefaultTransactionDate();
  if (categories.some((item) => item.id === selectedCategoryId)) {
    categoryInput.value = selectedCategoryId;
  }
  updateSelectedCategoryHint();
}

function handleDeleteTransaction(event) {
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
  saveTransactions(transactions);
  render();
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
  syncFilterControls();
  render();
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
  const csvData = serializeTransactionsToCsv(transactions);
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

    if (importedData.transactions.length === 0) {
      alert("File không có giao dịch hợp lệ để nhập.");
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
  updateSelectedCategoryHint();

  const filteredTransactions = applyFilters(transactions, filterState);
  const summary = summarizeTransactions(filteredTransactions);

  activeRangeLabelElement.textContent = `Đang xem: ${describeActiveFilters(filterState)}`;
  renderSummary(summary);
  renderTransactions(filteredTransactions);
  renderCharts(summary);
}

function renderCategorySelect() {
  const previousValue = categoryInput.value;

  if (categories.length === 0) {
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
          <td><button class="icon-btn" type="button" data-delete-id="${escapeHtml(item.id)}">Xóa</button></td>
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

  if (expenseCategoryChart) {
    expenseCategoryChart.destroy();
  }

  expenseCategoryChart = new Chart(document.getElementById("expense-category-chart"), {
    type: "doughnut",
    data: {
      labels: expenseLabels,
      datasets: [
        {
          data: expenseValues,
          backgroundColor: expenseColors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
        },
        tooltip: {
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

  cashflowChart = new Chart(document.getElementById("cashflow-chart"), {
    type: "bar",
    data: {
      labels: ["Thu nhập", "Chi tiêu"],
      datasets: [
        {
          label: "Tổng tiền",
          data: [summary.totalIncome, summary.totalExpense],
          backgroundColor: ["#10b981", "#ef4444"],
          borderRadius: 8,
          maxBarThickness: 72,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return currencyFormatter.format(Number(value));
            },
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
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
    throw new Error("CSV không có dữ liệu giao dịch.");
  }

  const headers = rows[0];
  const headerMap = {};

  headers.forEach((header, index) => {
    const key = mapCsvHeader(header);
    if (key && headerMap[key] === undefined) {
      headerMap[key] = index;
    }
  });

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

function serializeTransactionsToCsv(items) {
  const headers = ["id", "date", "categoryId", "categoryName", "type", "amount", "note", "createdAt"];
  const lines = [headers.join(",")];

  for (const item of items) {
    const row = [
      item.id,
      item.date,
      item.categoryId,
      item.categoryName,
      item.type,
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
    id: "id",
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
