const openLogin = document.getElementById("open-login");
const hero = document.getElementById("hero");
const auth = document.getElementById("auth");
const dashboard = document.getElementById("dashboard");
const accountName = document.getElementById("account-name");

const toggleButtons = document.querySelectorAll(".toggle-btn");
const signInForm = document.getElementById("signin-form");
const signUpForm = document.getElementById("signup-form");
const navLinks = document.querySelectorAll(".nav-link");
const pages = document.querySelectorAll(".panel.page");
const pageTitle = document.getElementById("page-title");
const trackPage = document.getElementById("page-track");
const trackItems = trackPage ? Array.from(trackPage.querySelectorAll(".reveal")) : [];
const calendarMonth = document.getElementById("calendar-month");
const calendarDays = document.getElementById("calendar-days");
const calPrev = document.getElementById("cal-prev");
const calNext = document.getElementById("cal-next");
const meetingDateInputs = document.querySelectorAll("#page-meetings input[type=\"date\"]");
const feedbackForm = document.querySelector(".feedback-form");
const feedbackConfirm = document.getElementById("feedback-confirm");
const helpYes = document.getElementById("help-yes");
const helpNo = document.getElementById("help-no");
const helpStatus = document.getElementById("help-status");

openLogin.addEventListener("click", () => {
  hero.classList.add("hidden");
  auth.classList.remove("hidden");
  auth.scrollIntoView({ behavior: "smooth" });
});

toggleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    toggleButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    if (btn.dataset.mode === "signup") {
      signInForm.classList.add("hidden");
      signUpForm.classList.remove("hidden");
    } else {
      signUpForm.classList.add("hidden");
      signInForm.classList.remove("hidden");
    }
  });
});

// Prevent demo forms from navigating away
signInForm.addEventListener("submit", (event) => {
  event.preventDefault();
  auth.classList.add("hidden");
  dashboard.classList.remove("hidden");
  dashboard.scrollIntoView({ behavior: "smooth" });

  const usernameInput = signInForm.querySelector("input[type=\"text\"]");
  if (usernameInput && accountName) {
    accountName.textContent = usernameInput.value || "Client Name";
  }
});

signUpForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((btn) => btn.classList.remove("active"));
    link.classList.add("active");

    pages.forEach((page) => page.classList.add("hidden"));
    const target = document.getElementById(link.dataset.target);
    if (target) {
      target.classList.remove("hidden");
      target.classList.remove("opening");
      if (target.id === "page-new") {
        target.classList.add("opening");
        window.setTimeout(() => target.classList.remove("opening"), 700);
      }
      if (target.id === "page-track") {
        window.setTimeout(updateTrackReveal, 50);
      }
      pageTitle.textContent = link.textContent;
    }
  });
});

let scrollTicking = false;

const updateTrackReveal = () => {
  if (!trackPage || trackPage.classList.contains("hidden")) return;
  if (trackItems.length === 0) return;

  const viewportFocus = window.innerHeight * 0.55;
  let closest = trackItems[0];
  let minDistance = Number.POSITIVE_INFINITY;

  trackItems.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - viewportFocus);
    if (distance < minDistance) {
      minDistance = distance;
      closest = item;
    }
  });

  trackItems.forEach((item) => {
    item.classList.toggle("visible", item === closest);
  });
};

const onScroll = () => {
  if (scrollTicking) return;
  scrollTicking = true;
  window.requestAnimationFrame(() => {
    updateTrackReveal();
    scrollTicking = false;
  });
};

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", updateTrackReveal);

if (calendarMonth && calendarDays && calPrev && calNext) {
  let currentDate = new Date();
  let selectedDate = null;

  const formatMonth = (date) =>
    date.toLocaleString("en-US", { month: "long", year: "numeric" });

  const formatDateInput = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    calendarMonth.textContent = formatMonth(currentDate);

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    calendarDays.innerHTML = "";

    for (let i = startDay; i > 0; i--) {
      const day = document.createElement("span");
      day.className = "day muted";
      day.textContent = prevLastDay - i + 1;
      day.dataset.offset = -1;
      calendarDays.appendChild(day);
    }

    for (let d = 1; d <= totalDays; d++) {
      const day = document.createElement("span");
      day.className = "day";
      day.textContent = d;
      day.dataset.day = d;
      if (
        selectedDate &&
        selectedDate.getFullYear() === year &&
        selectedDate.getMonth() === month &&
        selectedDate.getDate() === d
      ) {
        day.classList.add("selected");
      }
      calendarDays.appendChild(day);
    }

    const totalCells = calendarDays.children.length;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const day = document.createElement("span");
      day.className = "day muted";
      day.textContent = i;
      day.dataset.offset = 1;
      calendarDays.appendChild(day);
    }
  };

  const setSelectedDate = (date) => {
    selectedDate = date;
    meetingDateInputs.forEach((input) => {
      input.value = formatDateInput(date);
    });
    renderCalendar();
  };

  calendarDays.addEventListener("click", (event) => {
    const target = event.target;
    if (!target.classList.contains("day")) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dayNumber = Number(target.textContent);

    if (target.dataset.offset === "-1") {
      setSelectedDate(new Date(year, month - 1, dayNumber));
      currentDate = new Date(year, month - 1, 1);
    } else if (target.dataset.offset === "1") {
      setSelectedDate(new Date(year, month + 1, dayNumber));
      currentDate = new Date(year, month + 1, 1);
    } else {
      setSelectedDate(new Date(year, month, dayNumber));
    }
  });

  calPrev.addEventListener("click", () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    renderCalendar();
  });

  calNext.addEventListener("click", () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    renderCalendar();
  });

  renderCalendar();
}

if (feedbackForm && feedbackConfirm) {
  feedbackForm.addEventListener("submit", (event) => {
    event.preventDefault();
    feedbackConfirm.classList.remove("hidden");
  });
}

const setHelpFeedback = (choice) => {
  if (!helpStatus) return;
  helpStatus.textContent = `Thanks for your feedback (${choice}).`;
  helpStatus.classList.remove("hidden");
  [helpYes, helpNo].forEach((btn) => btn && btn.classList.remove("active"));
  if (choice === "Yes" && helpYes) helpYes.classList.add("active");
  if (choice === "No" && helpNo) helpNo.classList.add("active");
};

if (helpYes) {
  helpYes.addEventListener("click", () => setHelpFeedback("Yes"));
}

if (helpNo) {
  helpNo.addEventListener("click", () => setHelpFeedback("No"));
}
