/* ============================================================
   КЛИЕНТ SUPABASE
============================================================ */
const db = supabaseClient;

/* ============================================================
   ЭЛЕМЕНТЫ
============================================================ */
const authPage = document.getElementById("authPage");
const appRoot = document.getElementById("appRoot");
const loadingPage = document.getElementById("loadingPage");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginError = document.getElementById("loginError");
const signupError = document.getElementById("signupError");
const signupSuccess = document.getElementById("signupSuccess");

const userNameEl = document.getElementById("userName");
const userRoleLabel = document.getElementById("userRoleLabel");
const logoutButton = document.getElementById("logoutButton");

const recordList = document.getElementById("recordList");
const adminList = document.getElementById("adminList");
const recordForm = document.getElementById("recordForm");
const submitButton = document.getElementById("submitButton");
const openCreateButton = document.getElementById("openCreateButton");

const searchInput = document.getElementById("searchInput");
const adminSearchInput = document.getElementById("adminSearchInput");

const successBanner = document.getElementById("successBanner");
const errorBanner = document.getElementById("errorBanner");
const successBannerText = document.getElementById("successBannerText");
const errorBannerText = document.getElementById("errorBannerText");

const confirmDialog = document.getElementById("confirmDialog");
const confirmCancelButton = document.getElementById("confirmCancelButton");
const dismissCancelButton = document.getElementById("dismissCancelButton");
const dialogText = document.getElementById("dialogText");

const confirmVisitDialog = document.getElementById("confirmVisitDialog");
const confirmVisitButton = document.getElementById("confirmVisitButton");
const dismissVisitButton = document.getElementById("dismissVisitButton");
const visitDialogText = document.getElementById("visitDialogText");

const reviewDialog = document.getElementById("reviewDialog");
const submitReviewButton = document.getElementById("submitReviewButton");
const dismissReviewButton = document.getElementById("dismissReviewButton");

const backToList = document.getElementById("backToList");

/* ============================================================
   СОСТОЯНИЕ
============================================================ */
let currentUser = null;
let userProfile = null;
let currentRole = "user";
let records = [];
let currentRecordId = null;
let currentFilter = "all";
let currentAdminFilter = "all";
let searchQuery = "";
let adminSearchQuery = "";
let bannerTimer = null;
let selectedRating = 0;
let reviewRecordItem = null;
let chartActivities = null;
let chartStatuses = null;

/* ============================================================
   ЭКРАНЫ
============================================================ */
function showLoading() {
  loadingPage.hidden = false;
  authPage.hidden = true;
  appRoot.hidden = true;
}

function showAuth() {
  loadingPage.hidden = true;
  authPage.hidden = false;
  appRoot.hidden = true;
}

function showApp() {
  loadingPage.hidden = true;
  authPage.hidden = true;
  appRoot.hidden = false;

  userNameEl.textContent = userProfile?.full_name || currentUser?.email || "—";
  userRoleLabel.textContent = currentRole === "admin" ? "Администратор" : "Пользователь";

  applyRoleNav();

  loadRecords().then(() => {
    loadActivitiesFilter();
    loadFormDropdowns();
    loadAnalyticsActivities();
    if (currentRole === "admin") navigate("adminPage");
    else navigate("listPage");
  });
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
============================================================ */
async function init() {
  showLoading();

  const safetyTimer = setTimeout(() => {
    console.warn("Safety timeout: показываем форму входа");
    showAuth();
  }, 5000);

  try {
    const { data, error } = await db.auth.getSession();
    if (error) console.error("getSession error:", error);

    clearTimeout(safetyTimer);

    if (data?.session?.user) {
      currentUser = data.session.user;
      await loadUserProfile();
      showApp();
    } else {
      showAuth();
    }
  } catch (err) {
    clearTimeout(safetyTimer);
    console.error("Init error:", err);
    showAuth();
  }

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      currentUser = session.user;
      await loadUserProfile();
      showApp();
    } else if (event === "SIGNED_OUT") {
      currentUser = null;
      userProfile = null;
      currentRole = "user";
      records = [];
      showAuth();
    }
  });
}

async function loadUserProfile() {
  if (!currentUser) return;

  const { data, error } = await db
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (!error && data) {
    userProfile = data;
    currentRole = data.role || "user";
    return;
  }

  const { data: created } = await db
    .from("profiles")
    .upsert({
      id: currentUser.id,
      email: currentUser.email,
      full_name: currentUser.user_metadata?.full_name || currentUser.email,
      role: "user"
    })
    .select()
    .maybeSingle();

  if (created) {
    userProfile = created;
    currentRole = created.role || "user";
  } else {
    currentRole = "user";
    userProfile = {
      full_name: currentUser.user_metadata?.full_name || currentUser.email,
      role: "user"
    };
  }
}

function applyRoleNav() {
  document.querySelectorAll("#appRoot .nav-link").forEach((link) => {
    const allowed = link.dataset.role;
    if (!allowed) { link.hidden = false; return; }
    link.hidden = allowed !== currentRole;
  });
}

/* ============================================================
   ВКЛАДКИ АВТОРИЗАЦИИ
============================================================ */
document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const isLogin = tab.dataset.authTab === "login";
    loginForm.hidden = !isLogin;
    signupForm.hidden = isLogin;
    loginError.hidden = true;
    signupError.hidden = true;
    signupSuccess.hidden = true;
  });
});

/* ============================================================
   ВХОД
============================================================ */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const btn = loginForm.querySelector("button[type=submit]");

  btn.disabled = true;
  btn.textContent = "Вход...";

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
      loginError.textContent = translateAuthError(error.message);
      loginError.hidden = false;
      return;
    }

    currentUser = data.user;
    await loadUserProfile();
    showApp();
    loginForm.reset();
  } catch (err) {
    loginError.textContent = "Ошибка сети. Проверьте подключение.";
    loginError.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Войти";
  }
});

/* ============================================================
   РЕГИСТРАЦИЯ
============================================================ */
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.hidden = true;
  signupSuccess.hidden = true;

  const fullName = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const passwordConfirm = document.getElementById("signupPasswordConfirm").value;
  const btn = signupForm.querySelector("button[type=submit]");

  if (password.length < 6) {
    signupError.textContent = "Пароль должен быть не короче 6 символов.";
    signupError.hidden = false;
    return;
  }

  if (password !== passwordConfirm) {
    signupError.textContent = "Пароли не совпадают.";
    signupError.hidden = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Создание...";

  try {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: "user" } }
    });

    if (error) {
      signupError.textContent = translateAuthError(error.message);
      signupError.hidden = false;
      return;
    }

    if (!data.session) {
      signupSuccess.textContent = "Аккаунт создан! Проверьте email.";
      signupSuccess.hidden = false;
      signupForm.reset();
      return;
    }

    currentUser = data.user;
    await loadUserProfile();
    showApp();
    signupForm.reset();
  } catch (err) {
    signupError.textContent = "Ошибка сети.";
    signupError.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Создать аккаунт";
  }
});

function translateAuthError(message) {
  const map = {
    "Invalid login credentials": "Неверный email или пароль.",
    "Email not confirmed": "Email не подтверждён. Проверьте почту.",
    "User already registered": "Пользователь с таким email уже зарегистрирован.",
    "Password should be at least 6 characters": "Пароль должен быть не короче 6 символов.",
    "Unable to validate email address: invalid format": "Некорректный формат email.",
    "Failed to fetch": "Нет связи с сервером.",
    "Database error saving new user": "Ошибка БД при создании пользователя."
  };
  return map[message] || message;
}

/* ============================================================
   ВЫХОД
============================================================ */
logoutButton.addEventListener("click", async () => {
  await db.auth.signOut();
});

/* ============================================================
   НАВИГАЦИЯ
============================================================ */
function navigate(pageId) {
  if (pageId === "adminPage" && currentRole !== "admin") pageId = "listPage";
  if (pageId === "listPage" && currentRole === "admin") pageId = "adminPage";
  if (pageId === "createPage" && currentRole !== "user") pageId = "listPage";

  document.querySelectorAll("#appRoot .page").forEach((page) => {
    page.hidden = page.id !== pageId;
  });

  document.querySelectorAll("#appRoot .nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === pageId);
  });

  if (pageId === "listPage") renderRecords();
  if (pageId === "adminPage") {
    renderAdmin();
    renderCharts();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-page]");
  if (target) navigate(target.dataset.page);
});

openCreateButton?.addEventListener("click", () => {
  if (currentRole !== "user") return;
  clearValidation();
  recordForm.reset();
  hideBanners();
  navigate("createPage");
});

backToList.addEventListener("click", () => {
  navigate(currentRole === "admin" ? "adminPage" : "listPage");
});

/* ============================================================
   БАННЕРЫ
============================================================ */
function hideBanners() {
  clearTimeout(bannerTimer);
  successBanner.hidden = true;
  errorBanner.hidden = true;
}

function showSuccessBanner(message) {
  hideBanners();
  successBannerText.textContent = message;
  successBanner.hidden = false;
  bannerTimer = setTimeout(() => (successBanner.hidden = true), 4000);
}

function showErrorBanner(message) {
  hideBanners();
  errorBannerText.textContent = message;
  errorBanner.hidden = false;
  bannerTimer = setTimeout(() => (errorBanner.hidden = true), 5000);
}

/* ============================================================
   ВАЛИДАЦИЯ + БИЗНЕС-ПРАВИЛО
============================================================ */
function clearValidation() {
  document.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
  recordForm.querySelectorAll("input, select, textarea").forEach((el) =>
    el.classList.remove("input-error")
  );
}

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}Error`);
  if (field) field.classList.add("input-error");
  if (error) error.textContent = message;
}

async function validateForm() {
  clearValidation();
  let valid = true;

  const activity = recordForm.elements.activity.value;
  const date = recordForm.elements.date.value;
  const time = recordForm.elements.time.value;
  const trainerSelect = recordForm.elements.trainer;
  const trainerText = trainerSelect.value;

  if (!activity) { setFieldError("activity", "Выберите вид спорта"); valid = false; }

  let prettyDate = null;
  if (!date) {
    setFieldError("date", "Укажите дату");
    valid = false;
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const chosen = new Date(date);
    if (chosen < today) {
      setFieldError("date", "Дата не может быть в прошлом");
      valid = false;
    } else {
      const months = ["Января","Февраля","Марта","Апреля","Мая","Июня",
                      "Июля","Августа","Сентября","Октября","Ноября","Декабря"];
      const days = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
      prettyDate = `${chosen.getDate()} ${months[chosen.getMonth()]}, ${days[chosen.getDay()]}`;
    }
  }

  if (!time) { setFieldError("time", "Укажите время"); valid = false; }

  // БИЗНЕС-ПРАВИЛО: занят ли слот у этого тренера
  if (valid && trainerText && prettyDate && time) {
    const { data: conflicts } = await db
      .from("records")
      .select("id")
      .eq("date", prettyDate)
      .eq("time_slot", time)
      .eq("trainer", trainerText)
      .eq("status", "Подтверждена");

    if (conflicts && conflicts.length > 0) {
      setFieldError("time", "Этот слот уже занят у выбранного тренера");
      valid = false;
    }
  }

  return valid;
}

/* ============================================================
   ЗАГРУЗКА СПРАВОЧНИКОВ
============================================================ */
async function loadFormDropdowns() {
  const activitySelect = document.getElementById("activity");
  const trainerSelect = document.getElementById("trainer");

  if (activitySelect) {
    const { data } = await db.from("activities").select("name").order("name");
    activitySelect.innerHTML = '<option value="">Выберите вид спорта...</option>' +
      (data || []).map((a) => `<option>${escapeHtml(a.name)}</option>`).join("");
  }

  if (trainerSelect) {
    const { data } = await db.from("trainers").select("full_name, specialization").order("full_name");
    trainerSelect.innerHTML = '<option value="">Любой свободный тренер</option>' +
      (data || []).map((t) => `<option>${escapeHtml(t.full_name)}</option>`).join("");
  }
}

async function loadActivitiesFilter() {
  const { data } = await db.from("activities").select("name").order("name");
  const select = document.getElementById("filterActivity");
  if (!select) return;
  select.innerHTML = '<option value="">Все виды спорта</option>' +
    (data || []).map((a) => `<option>${escapeHtml(a.name)}</option>`).join("");
}

async function loadAnalyticsActivities() {
  const { data } = await db.from("activities").select("name").order("name");
  const select = document.getElementById("analyticsActivity");
  if (!select) return;
  select.innerHTML = '<option value="">Все</option>' +
    (data || []).map((a) => `<option>${escapeHtml(a.name)}</option>`).join("");
}

/* ============================================================
   ЗАГРУЗКА ЗАПИСЕЙ
============================================================ */
async function loadRecords() {
  try {
    if (currentRole === "admin") {
      const { data, error } = await db.rpc("get_records_with_client");
      if (error) {
        const fallback = await db.from("records").select("*").order("created_at", { ascending: false });
        records = fallback.data || [];
      } else {
        records = data || [];
      }
    } else {
      const { data, error } = await db
        .from("records")
        .select("*")
        .order("created_at", { ascending: false });
      records = error ? [] : (data || []);
    }
  } catch (err) {
    records = [];
  }
}

/* ============================================================
   СОЗДАНИЕ ЗАПИСИ
============================================================ */
recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (currentRole !== "user" || !currentUser) return;
  if (!(await validateForm())) return;

  submitButton.disabled = true;
  submitButton.textContent = "Сохранение...";
  hideBanners();

  const dateValue = recordForm.elements.date.value;
  const dateObj = new Date(dateValue);
  const months = ["Января","Февраля","Марта","Апреля","Мая","Июня",
                  "Июля","Августа","Сентября","Октября","Ноября","Декабря"];
  const days = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
  const prettyDate = `${dateObj.getDate()} ${months[dateObj.getMonth()]}, ${days[dateObj.getDay()]}`;

  const activitySelect = recordForm.elements.activity;
  const activityText = activitySelect.options[activitySelect.selectedIndex].text;
  const trainerText = recordForm.elements.trainer.value || "Любой свободный тренер";

  const { data: act } = await db.from("activities").select("id").eq("name", activityText).maybeSingle();
  const { data: trn } = await db.from("trainers").select("id").eq("full_name", trainerText).maybeSingle();

  const newRecord = {
    user_id: currentUser.id,
    number: 20000 + Math.floor(Math.random() * 999),
    activity: activityText,
    activity_id: act?.id || null,
    place: recordForm.elements.place.value.trim() || "Уточняется",
    date: prettyDate,
    time_slot: recordForm.elements.time.value,
    trainer: trainerText,
    trainer_id: trn?.id || null,
    comment: recordForm.elements.comment.value.trim() || "Без дополнительных пожеланий.",
    status: "Подтверждена"
  };

  try {
    const { error } = await db.from("records").insert(newRecord);

    if (error) {
      if (error.message.includes("занят")) {
        showErrorBanner("Этот слот уже занят. Выберите другое время.");
      } else {
        showErrorBanner("Не удалось сохранить запись. Попробуйте ещё раз.");
      }
      return;
    }

    recordForm.reset();
    await loadRecords();
    navigate("listPage");
    showSuccessBanner("Запись успешно создана!");
  } catch (err) {
    showErrorBanner("Ошибка сети.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Записаться";
  }
});

/* ============================================================
   ФИЛЬТРЫ ПОЛЬЗОВАТЕЛЯ
============================================================ */
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderRecords();
});

document.querySelectorAll(".filter[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter[data-filter]").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderRecords();
  });
});

document.getElementById("filterActivity")?.addEventListener("change", renderRecords);
document.getElementById("filterStatus")?.addEventListener("change", renderRecords);
document.getElementById("filterSort")?.addEventListener("change", renderRecords);

function applyUserFilters(items) {
  const filterActivity = document.getElementById("filterActivity")?.value || "";
  const filterStatus = document.getElementById("filterStatus")?.value || "";
  const filterSort = document.getElementById("filterSort")?.value || "date-desc";

  let result = items.filter((item) => {
    if (currentFilter === "upcoming" && item.status !== "Подтверждена") return false;
    if (currentFilter === "past" && item.status === "Подтверждена") return false;
    if (filterActivity && item.activity !== filterActivity) return false;
    if (filterStatus && item.status !== filterStatus) return false;

    if (searchQuery) {
      const haystack = `${item.activity} ${item.trainer || ""} ${item.place || ""}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  });

  if (filterSort === "date-desc") {
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (filterSort === "date-asc") {
    result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (filterSort === "activity") {
    result.sort((a, b) => a.activity.localeCompare(b.activity, "ru"));
  }

  return result;
}

function renderRecords() {
  const visible = applyUserFilters(records);

  if (visible.length === 0) {
    recordList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="5" width="18" height="16" rx="2"/>
            <path d="M16 3v4M8 3v4M3 11h18"/>
          </svg>
        </div>
        <h2>У вас пока нет записей</h2>
        <p>Запланируйте свои первые тренировки прямо сейчас!</p>
        <button class="button button-primary" data-page="createPage">
          <span class="plus">+</span> Создать первую запись
        </button>
      </div>
    `;
    return;
  }

  recordList.innerHTML = visible.map((item) => `
    <article class="record-card" tabindex="0" data-record-id="${item.id}">
      ${recordCardInner(item, false)}
    </article>
  `).join("");
}

/* ============================================================
   АДМИН-ПАНЕЛЬ
============================================================ */
adminSearchInput.addEventListener("input", (e) => {
  adminSearchQuery = e.target.value.toLowerCase().trim();
  renderAdmin();
});

document.querySelectorAll(".filter[data-admin-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter[data-admin-filter]").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    currentAdminFilter = button.dataset.adminFilter;
    renderAdmin();
  });
});

document.getElementById("analyticsPeriod")?.addEventListener("change", () => {
  renderAdmin();
  renderCharts();
});

document.getElementById("analyticsActivity")?.addEventListener("change", () => {
  renderAdmin();
  renderCharts();
});

function getFilteredRecordsForAnalytics() {
  const period = document.getElementById("analyticsPeriod")?.value || "all";
  const activity = document.getElementById("analyticsActivity")?.value || "";

  let filtered = [...records];

  if (period !== "all") {
    const daysAgo = Number(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysAgo);
    filtered = filtered.filter((r) => new Date(r.created_at) >= cutoff);
  }

  if (activity) filtered = filtered.filter((r) => r.activity === activity);

  return filtered;
}

function renderAdmin() {
  updateStats();

  const visible = records.filter((item) => {
    if (currentAdminFilter !== "all" && item.status !== currentAdminFilter) return false;
    if (adminSearchQuery) {
      const haystack = `${item.client_name || ""} ${item.activity} ${item.trainer || ""}`.toLowerCase();
      if (!haystack.includes(adminSearchQuery)) return false;
    }
    return true;
  });

  if (visible.length === 0) {
    adminList.innerHTML = `
      <div class="empty-state">
        <h2>Записей не найдено</h2>
        <p>Измените фильтр или поисковый запрос.</p>
      </div>
    `;
    return;
  }

  adminList.innerHTML = visible.map((item) => `
    <article class="record-card" tabindex="0" data-record-id="${item.id}">
      ${recordCardInner(item, true)}
    </article>
  `).join("");
}

async function updateStats() {
  const filtered = getFilteredRecordsForAnalytics();

  document.getElementById("statTotal").textContent = filtered.length;
  document.getElementById("statConfirmed").textContent = filtered.filter((r) => r.status === "Подтверждена").length;
  document.getElementById("statVisited").textContent = filtered.filter((r) => r.status === "Посещено").length;
  document.getElementById("statCancelled").textContent = filtered.filter((r) => r.status === "Отменена").length;

  const { count: usersCount } = await db.from("profiles").select("*", { count: "exact", head: true });
  const { count: reviewsCount } = await db.from("reviews").select("*", { count: "exact", head: true });

  document.getElementById("statUsers").textContent = usersCount || 0;
  document.getElementById("statReviews").textContent = reviewsCount || 0;
}

function renderCharts() {
  const filtered = getFilteredRecordsForAnalytics();

  const activityCounts = {};
  filtered.forEach((r) => { activityCounts[r.activity] = (activityCounts[r.activity] || 0) + 1; });

  const ctxA = document.getElementById("chartActivities");
  if (ctxA && window.Chart) {
    if (chartActivities) chartActivities.destroy();
    chartActivities = new Chart(ctxA, {
      type: "bar",
      data: {
        labels: Object.keys(activityCounts),
        datasets: [{
          label: "Записей",
          data: Object.values(activityCounts),
          backgroundColor: "#2563eb",
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  const statusCounts = { "Подтверждена": 0, "Посещено": 0, "Отменена": 0 };
  filtered.forEach((r) => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  const ctxS = document.getElementById("chartStatuses");
  if (ctxS && window.Chart) {
    if (chartStatuses) chartStatuses.destroy();
    chartStatuses = new Chart(ctxS, {
      type: "doughnut",
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: ["#10b981", "#6b7280", "#ef4444"]
        }]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
  }
}

/* ============================================================
   ШАБЛОН КАРТОЧКИ
============================================================ */
function recordCardInner(item, showClient) {
  return `
    <div class="record-main">
      <div class="record-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 3c2 3 3 6 3 9s-1 6-3 9M12 3c-2 3-3 6-3 9s1 6 3 9M3 12h18"/>
        </svg>
      </div>
      <div>
        <div class="record-title">${escapeHtml(item.activity)}</div>
        <div class="record-place">
          ${showClient && item.client_name ? "👤 " + escapeHtml(item.client_name) + " · " : ""}
          ${escapeHtml(item.place || "Место уточняется")}
        </div>
      </div>
    </div>

    <div>
      <div class="record-block-label">Дата</div>
      <div class="record-block-value">${escapeHtml(item.date)}</div>
      <div class="record-block-sub">${escapeHtml(item.time_slot)}</div>
    </div>

    <div>
      <div class="record-block-label">Тренер</div>
      <div class="record-block-value">${escapeHtml(item.trainer || "—")}</div>
    </div>

    <div class="record-right">
      <span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span>
      <button class="details-button" type="button">
        Детали
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 6 6 6-6 6"/>
        </svg>
      </button>
    </div>
  `;
}

function statusClass(status) {
  if (status === "Подтверждена") return "status-confirmed";
  if (status === "Посещено") return "status-visited";
  if (status === "Отменена") return "status-cancelled";
  return "";
}

/* ============================================================
   ОТКРЫТИЕ КАРТОЧКИ
============================================================ */
[recordList, adminList].forEach((listEl) => {
  listEl.addEventListener("click", openRecordFromEvent);
  listEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") openRecordFromEvent(event);
  });
});

function openRecordFromEvent(event) {
  const card = event.target.closest("[data-record-id]");
  if (!card) return;
  openRecord(card.dataset.recordId);
}

function openRecord(id) {
  const item = records.find((r) => String(r.id) === String(id));
  if (!item) return;

  currentRecordId = item.id;
  renderRecordDetails(item);
  hideBanners();
  navigate("detailPage");
}

/* ============================================================
   ДЕТАЛИ
============================================================ */
function renderRecordDetails(item) {
  document.getElementById("detailTitle").textContent = `Запись #${item.number}`;
  document.getElementById("detailActivity").textContent = item.activity;
  document.getElementById("detailDate").textContent = `${item.date} (${item.time_slot})`;
  document.getElementById("detailTrainer").textContent = item.trainer || "—";
  document.getElementById("detailPlace").textContent = item.place || "—";
  document.getElementById("detailComment").textContent = item.comment || "Без дополнительных пожеланий.";

  const clientBlock = document.getElementById("detailClientBlock");
  if (currentRole === "admin") {
    clientBlock.hidden = false;
    document.getElementById("detailClient").textContent = item.client_name || "—";
  } else {
    clientBlock.hidden = true;
  }

  const statusEl = document.getElementById("detailStatus");
  statusEl.textContent = item.status;
  statusEl.className = `status ${statusClass(item.status)}`;

  const actions = document.getElementById("detailActions");
  actions.innerHTML = "";

  if (currentRole === "user") {
    if (item.status === "Подтверждена") {
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "button button-danger";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Отменить запись";
      cancelBtn.addEventListener("click", () => {
        dialogText.textContent = `Отменить запись на ${item.activity} ${item.date}?`;
        confirmDialog.showModal();
      });
      actions.appendChild(cancelBtn);
    }

    if (item.status === "Посещено") {
      const reviewBtn = document.createElement("button");
      reviewBtn.className = "button button-primary";
      reviewBtn.type = "button";
      reviewBtn.textContent = "Оставить оценку";
      reviewBtn.addEventListener("click", () => openReviewDialog(item));
      actions.appendChild(reviewBtn);
    }

    if (item.status === "Отменена") {
      const note = document.createElement("p");
      note.style.color = "#6b7280";
      note.style.fontSize = "14px";
      note.textContent = "Запись отменена — действия недоступны.";
      actions.appendChild(note);
    }
  } else {
    if (item.status === "Подтверждена") {
      const visitBtn = document.createElement("button");
      visitBtn.className = "button button-primary";
      visitBtn.type = "button";
      visitBtn.textContent = "Отметить как посещённое";
      visitBtn.addEventListener("click", () => {
        visitDialogText.textContent = `Подтвердите, что клиент посетил «${item.activity}» ${item.date}.`;
        confirmVisitDialog.showModal();
      });
      actions.appendChild(visitBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "button button-danger";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Отменить запись";
      cancelBtn.addEventListener("click", () => {
        dialogText.textContent = `Отменить запись клиента на «${item.activity}»?`;
        confirmDialog.showModal();
      });
      actions.appendChild(cancelBtn);
    } else {
      const note = document.createElement("p");
      note.style.color = "#6b7280";
      note.style.fontSize = "14px";
      note.textContent = item.status === "Посещено"
        ? "Запись уже отмечена как посещённая."
        : "Запись отменена — действия недоступны.";
      actions.appendChild(note);
    }
  }

  loadHistory(item.id);
}

/* ============================================================
   ИСТОРИЯ СТАТУСОВ
============================================================ */
async function loadHistory(recordId) {
  const historyList = document.getElementById("historyList");
  const historyBlock = document.getElementById("historyBlock");
  if (!historyList || !historyBlock) return;

  historyList.innerHTML = '<div style="color:#6b7280;font-size:13px;">Загрузка...</div>';

  const { data, error } = await db
    .from("status_history")
    .select("*")
    .eq("record_id", recordId)
    .order("changed_at", { ascending: false });

  if (error || !data || data.length === 0) {
    historyBlock.hidden = true;
    return;
  }

  historyBlock.hidden = false;

  historyList.innerHTML = data.map((item) => `
    <div class="history-item">
      <div>
        ${item.old_status ? `<span class="status-from">${escapeHtml(item.old_status)} →</span> ` : ""}
        <span class="status-to">${escapeHtml(item.new_status)}</span>
      </div>
      <div class="history-date">${formatDate(item.changed_at)}</div>
    </div>
  `).join("");
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

/* ============================================================
   ОТМЕНА
============================================================ */
confirmCancelButton.addEventListener("click", async () => {
  const { error } = await db.from("records").update({ status: "Отменена" }).eq("id", currentRecordId);
  confirmDialog.close();

  if (error) {
    showErrorBanner("Не удалось отменить запись.");
    return;
  }

  await loadRecords();
  const updated = records.find((r) => r.id === currentRecordId);
  if (updated) renderRecordDetails(updated);
});

dismissCancelButton.addEventListener("click", () => confirmDialog.close());

/* ============================================================
   ПОСЕЩЕНО
============================================================ */
confirmVisitButton.addEventListener("click", async () => {
  const { error } = await db.from("records").update({ status: "Посещено" }).eq("id", currentRecordId);
  confirmVisitDialog.close();

  if (error) {
    showErrorBanner("Не удалось отметить посещение.");
    return;
  }

  await loadRecords();
  const updated = records.find((r) => r.id === currentRecordId);
  if (updated) renderRecordDetails(updated);
});

dismissVisitButton.addEventListener("click", () => confirmVisitDialog.close());

/* ============================================================
   ОЦЕНКА ТРЕНЕРА
============================================================ */
function openReviewDialog(item) {
  reviewRecordItem = item;
  selectedRating = 0;
  document.getElementById("reviewComment").value = "";
  document.querySelectorAll("#ratingStars button").forEach((b) => b.classList.remove("active"));
  reviewDialog.showModal();
}

document.querySelectorAll("#ratingStars button").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedRating = Number(btn.dataset.rating);
    document.querySelectorAll("#ratingStars button").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.rating) <= selectedRating);
    });
  });
});

dismissReviewButton.addEventListener("click", () => reviewDialog.close());

submitReviewButton.addEventListener("click", async () => {
  if (selectedRating === 0) {
    alert("Выберите оценку");
    return;
  }

  const comment = document.getElementById("reviewComment").value.trim();

  const { error } = await db.from("reviews").insert({
    record_id: reviewRecordItem.id,
    user_id: currentUser.id,
    trainer_id: reviewRecordItem.trainer_id,
    rating: selectedRating,
    comment: comment || null
  });

  if (error) {
    if (error.message.includes("duplicate")) {
      alert("Вы уже оставляли оценку этому занятию");
    } else {
      alert("Не удалось сохранить оценку");
    }
    return;
  }

  reviewDialog.close();
  showSuccessBanner("Спасибо за оценку!");
});

/* ============================================================
   ЭКРАНИРОВАНИЕ
============================================================ */
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ============================================================
   СТАРТ
============================================================ */
init();