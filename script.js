"use strict";

if (!window.weddingContent || !Array.isArray(window.weddingContent.days) || !Array.isArray(window.weddingContent.weeks)) {
  throw new Error("תוכן לוח הספירה לא נטען כראוי.");
}

const { weeks, days } = window.weddingContent;
const STORAGE_KEY = "masa-el-hupa-progress-v1";
const doorGrid = document.getElementById("doorGrid");
const dialog = document.getElementById("dayDialog");
const flipCard = document.getElementById("flipCard");
const flipFront = document.getElementById("flipFront");
const flipBack = document.getElementById("flipBack");
const flipWeekIcon = document.getElementById("flipWeekIcon");
const flipWeekTitle = document.getElementById("flipWeekTitle");
const flipDayNumber = document.getElementById("flipDayNumber");
const flipQuote = document.getElementById("flipQuote");
const flipImage = document.getElementById("flipImage");
const flipEmoji = document.getElementById("flipEmoji");
const flipPlaceholder = document.getElementById("flipPlaceholder");
const flipStatus = document.getElementById("flipStatus");
const storageNotice = document.getElementById("storageNotice");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const progressBar = document.querySelector('[role="progressbar"]');
const countdownNumber = document.getElementById("countdownNumber");
const previewDateInput = document.getElementById("previewDate");
let activeDay = null;
let progress = { startDate: todayString(), completed: [] };
let storageAvailable = true;
let lastLiveDate = todayString();

function todayString() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function dayIndex(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function shiftDate(dateString, daysToShift) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + daysToShift);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function selectedDate() {
  const value = previewDateInput.value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(dayIndex(value)) ? value : todayString();
}

function showStorageError(message) {
  storageNotice.textContent = message;
  storageNotice.hidden = false;
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      return;
    }

    const parsed = JSON.parse(saved);
    if (
      !parsed ||
      typeof parsed.startDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate) ||
      !Array.isArray(parsed.completed) ||
      parsed.completed.some(day => !Number.isInteger(day) || day < 1 || day > 50)
    ) {
      throw new Error("נתוני המשחק השמורים אינם תקינים.");
    }
    progress = { startDate: parsed.startDate, completed: [...new Set(parsed.completed)] };
  } catch (error) {
    storageAvailable = false;
    console.error("לא ניתן לטעון או לשמור את התקדמות המשחק.", error);
    showStorageError("לא הצלחנו לטעון או לשמור את ההתקדמות בדפדפן. אפשר להמשיך לשחק, אבל ההתקדמות לא תישמר לאחר סגירת העמוד.");
  }
}

function saveProgress() {
  if (!storageAvailable) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch (error) {
    storageAvailable = false;
    console.error("לא ניתן לשמור את התקדמות המשחק.", error);
    showStorageError("הדפדפן לא הצליח לשמור את ההתקדמות. אפשר להמשיך לשחק בעמוד הזה, אבל השינויים הבאים לא יישמרו.");
    return false;
  }
}

function elapsedDays() {
  return Math.max(0, dayIndex(selectedDate()) - dayIndex(progress.startDate));
}

function availableThrough() {
  const elapsed = elapsedDays();
  return Math.max(1, 50 - Math.min(elapsed, 49));
}

function renderCountdown() {
  const remaining = Math.max(1, 50 - Math.min(elapsedDays(), 49));
  countdownNumber.textContent = String(remaining);
  document.querySelector(".sign-line").setAttribute("aria-label", `עוד ${remaining} יום את גרה NOT`);
}

function createWeekBanner(week) {
  const banner = document.createElement("div");
  banner.className = "week-banner";
  banner.setAttribute("aria-label", `שבוע ${week.id}: ${week.title}`);
  if (week.icon) {
    const icon = document.createElement("img");
    icon.src = week.icon;
    icon.alt = "";
    banner.append(icon);
  }

  const copy = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = week.title;
  const range = document.createElement("p");
  range.textContent = week.finalWeek
    ? `השבוע האחרון · ימים ${week.firstDay}–${week.lastDay}`
    : `ימים ${week.firstDay}–${week.lastDay}`;
  copy.append(title, range);
  banner.append(copy);
  return banner;
}

function createDoor(number) {
  const button = document.createElement("button");
  const isCompleted = progress.completed.includes(number);
  const isAvailable = number >= availableThrough();
  button.type = "button";
  button.className = "door" + (isCompleted ? " completed" : isAvailable ? " available" : "");
  button.disabled = !isAvailable;
  button.setAttribute("aria-label", isCompleted
    ? `יום ${number}, הכרטיס נפתח והושלם`
    : isAvailable ? `יום ${number}, פתוח` : `יום ${number}, נעול`);

  const numberLabel = document.createElement("span");
  numberLabel.className = "door-number";
  numberLabel.textContent = String(number);
  const label = document.createElement("span");
  label.className = "door-label";
  label.textContent = isCompleted ? "הכרטיס נפתח" : isAvailable ? "הדלת מחכה לך" : "עוד לא הגיע היום";
  const mark = document.createElement("span");
  mark.className = "door-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = isCompleted ? "♡" : isAvailable ? "✦" : "🔒";
  button.append(numberLabel, label, mark);
  if (isAvailable) button.addEventListener("click", () => openDay(number));
  return button;
}

function renderDoors() {
  doorGrid.replaceChildren();
  for (const week of weeks) {
    doorGrid.append(createWeekBanner(week));
    const weekDays = days
      .filter(item => item.week === week.id)
      .sort((left, right) => right.day - left.day);
    for (const item of weekDays) doorGrid.append(createDoor(item.day));
  }

  const completedCount = progress.completed.length;
  progressText.textContent = `${completedCount} מתוך 50`;
  progressFill.style.width = `${completedCount * 2}%`;
  progressBar.setAttribute("aria-valuenow", String(completedCount));
}

function setCardFace(isFlipped) {
  flipCard.classList.toggle("is-flipped", isFlipped);
  flipCard.setAttribute("aria-pressed", String(isFlipped));
  flipCard.setAttribute("aria-label", isFlipped ? "להפוך חזרה ולקרוא את המסר" : "להפוך את הכרטיס ולראות את התמונה");
  flipFront.setAttribute("aria-hidden", String(isFlipped));
  flipBack.setAttribute("aria-hidden", String(!isFlipped));
}

function openDay(number) {
  if (number < availableThrough()) return;
  activeDay = days.find(item => item.day === number);
  if (!activeDay) return;

  const week = weeks.find(item => item.id === activeDay.week);
  document.getElementById("dayKicker").textContent = `יום ${number} מתוך 50`;
  document.getElementById("modalTitle").textContent = "הכרטיס היומי";
  flipWeekTitle.textContent = week.title;
  flipWeekIcon.hidden = !week.icon;
  if (week.icon) flipWeekIcon.src = week.icon;
  flipDayNumber.textContent = `יום ${number}`;
  flipQuote.textContent = activeDay.text;

  flipImage.hidden = !activeDay.image;
  flipEmoji.hidden = !activeDay.emoji;
  flipPlaceholder.hidden = Boolean(activeDay.image || activeDay.emoji);
  if (activeDay.image) {
    flipImage.src = activeDay.image;
    flipImage.alt = `תמונה ליום ${number}`;
  } else {
    flipImage.removeAttribute("src");
    flipImage.alt = "";
  }
  flipEmoji.textContent = activeDay.emoji || "";
  flipStatus.textContent = "";
  setCardFace(false);
  dialog.showModal();
}

flipCard.addEventListener("click", () => {
  if (!activeDay) return;
  const isFlipped = !flipCard.classList.contains("is-flipped");
  setCardFace(isFlipped);
  if (!isFlipped || progress.completed.includes(activeDay.day)) return;

  progress.completed.push(activeDay.day);
  progress.completed.sort((left, right) => left - right);
  const saved = saveProgress();
  flipStatus.textContent = saved
    ? "הכרטיס נפתח וההתקדמות נשמרה ♡"
    : "הכרטיס נפתח, אך ההתקדמות לא נשמרה בדפדפן.";
  renderDoors();
});

document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

document.getElementById("resetProgress").addEventListener("click", () => {
  if (!window.confirm("בטוחה שתרצי לאפס את כל הדלתות ולהתחיל מחדש?")) return;
  progress = { startDate: todayString(), completed: [] };
  saveProgress();
  renderDoors();
  renderCountdown();
  if (dialog.open) dialog.close();
});

previewDateInput.value = todayString();
previewDateInput.addEventListener("change", () => {
  renderCountdown();
  renderDoors();
});

document.getElementById("previewNextDay").addEventListener("click", () => {
  previewDateInput.value = shiftDate(selectedDate(), 1);
  renderCountdown();
  renderDoors();
});

document.getElementById("resetPreview").addEventListener("click", () => {
  previewDateInput.value = todayString();
  renderCountdown();
  renderDoors();
});

loadProgress();
renderCountdown();
renderDoors();

window.setInterval(() => {
  const liveDate = todayString();
  if (liveDate === lastLiveDate) return;
  if (previewDateInput.value === lastLiveDate) previewDateInput.value = liveDate;
  lastLiveDate = liveDate;
  renderCountdown();
  renderDoors();
}, 60_000);