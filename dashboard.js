const API_BASE = "https://trackvista.vercel.app";
const token = localStorage.getItem("tv_token");

if (!token) {
  window.location.href = "index.html";
}

const accountName = document.getElementById("account-name");
const storedName = localStorage.getItem("tv_username");
if (accountName && storedName) {
  accountName.textContent = storedName;
}

const navLinks = document.querySelectorAll(".nav-link");
const pages = document.querySelectorAll(".panel.page");
const pageTitle = document.getElementById("page-title");

const trackPage = document.getElementById("page-track");
const trackItems = trackPage ? Array.from(trackPage.querySelectorAll(".reveal")) : [];

const trackNameEl = document.getElementById("track-project-name");
const trackIdEl = document.getElementById("track-project-id");
const trackTypeEl = document.getElementById("track-project-type");
const trackDescEl = document.getElementById("track-project-desc");
const trackHealthEl = document.getElementById("track-health-current");
const trackProgressBar = document.getElementById("track-progress-bar");
const trackProgressText = document.getElementById("track-progress-text");
const trackDeadlineEl = document.getElementById("track-deadline");
const trackRemainingEl = document.getElementById("track-remaining");

const calendarMonth = document.getElementById("calendar-month");
const calendarDays = document.getElementById("calendar-days");
const calPrev = document.getElementById("cal-prev");
const calNext = document.getElementById("cal-next");
const meetingDateInputs = document.querySelectorAll("#page-meetings input[type=\"date\"]");

const newProjectForm = document.getElementById("new-project-form");
const projectStatus = document.getElementById("project-status");

const meetingForm = document.getElementById("meeting-form");
const meetingStatus = document.getElementById("meeting-status");

const feedbackForm = document.getElementById("feedback-form");
const feedbackConfirm = document.getElementById("feedback-confirm");

const helpYes = document.getElementById("help-yes");
const helpNo = document.getElementById("help-no");
const helpStatus = document.getElementById("help-status");

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const logoutBtn = document.getElementById("logout-btn");

const apiFetch = async (path, options = {}) => {
  const headers = Object.assign({}, options.headers || {}, {
    Authorization: `Bearer ${token}`,
  });
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
};

const postJSON = (path, payload) =>
  apiFetch(path, { method: "POST", body: JSON.stringify(payload) });

const loadProfile = async () => {
  try {
    const data = await apiFetch("/api/me");
    if (accountName && data.username) {
      accountName.textContent = data.username;
    }
  } catch (error) {
    // Ignore profile load errors
  }
};

const loadLatestProject = async () => {
  if (!trackNameEl) return;
  try {
    const data = await apiFetch("/api/projects/latest");
    trackNameEl.textContent = data.projectName || "New Project";
    trackIdEl.textContent = data.projectId || `TV-${data.id}`;
    trackTypeEl.textContent = data.projectType || "-";
    trackDescEl.textContent = data.projectDescription || "-";
    trackHealthEl.textContent = data.health || "On Track";

    const progress = Number.isFinite(data.progress) ? data.progress : 0;
    trackProgressBar.style.width = `${progress}%`;
    trackProgressText.textContent = `${progress}%`;

    if (data.deadline) {
      trackDeadlineEl.textContent = data.deadline;
      const deadlineDate = new Date(data.deadline);
      if (!Number.isNaN(deadlineDate.getTime())) {
        const diffMs = deadlineDate - new Date();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        trackRemainingEl.textContent = days >= 0 ? `${days} Days` : "Past due";
      }
    }
  } catch (error) {
    // Keep defaults if no project exists
  }
};

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
        loadLatestProject();
        window.setTimeout(updateTrackReveal, 50);
      }
      if (target.id === "page-communicate") {
        startChatPolling();
      } else {
        stopChatPolling();
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

if (newProjectForm) {
  newProjectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(newProjectForm);
    const file = formData.get("attachment");
    const payload = {
      projectType: formData.get("projectType"),
      projectCategory: formData.get("projectCategory"),
      projectDescription: formData.get("projectDescription"),
      projectObjective: formData.get("projectObjective"),
      projectRequirements: formData.get("projectRequirements"),
      designRequirements: formData.get("designRequirements"),
      targetUsers: formData.get("targetUsers"),
      technologyPreferences: formData.get("technologyPreferences"),
      budget: formData.get("budget"),
      deadline: formData.get("deadline"),
      attachmentName: file && file.name ? file.name : "",
    };

    try {
      await postJSON("/api/projects", payload);
      if (projectStatus) {
        projectStatus.classList.remove("hidden");
      }
      loadLatestProject();
    } catch (error) {
      alert(error.message);
    }
  });
}

if (meetingForm) {
  meetingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(meetingForm);
    const payload = {
      meetingTitle: formData.get("meetingTitle"),
      projectName: formData.get("projectName"),
      meetingDate: formData.get("meetingDate"),
      timeStart: formData.get("timeStart"),
      timeEnd: formData.get("timeEnd"),
      meetingType: formData.get("meetingType"),
    };

    try {
      await postJSON("/api/meetings", payload);
      if (meetingStatus) {
        meetingStatus.classList.remove("hidden");
      }
    } catch (error) {
      alert(error.message);
    }
  });
}

if (feedbackForm && feedbackConfirm) {
  feedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(feedbackForm);
    const payload = {
      projectSelection: formData.get("projectSelection"),
      stars: formData.get("stars"),
      comment: formData.get("comment"),
      communication: formData.get("communication"),
      development: formData.get("development"),
      design: formData.get("design"),
      management: formData.get("management"),
      deliverySatisfaction: formData.get("deliverySatisfaction"),
      suggestion: formData.get("suggestion"),
      anonymous: formData.get("anonymous") === "on",
    };

    try {
      await postJSON("/api/feedback", payload);
      feedbackConfirm.classList.remove("hidden");
    } catch (error) {
      alert(error.message);
    }
  });
}

let chatPoller = null;

const formatTime = (isoString) => {
  if (!isoString) return "Now";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const renderMessages = (messages) => {
  if (!chatMessages) return;
  chatMessages.innerHTML = "";

  if (!messages || messages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No messages yet.";
    chatMessages.appendChild(empty);
    return;
  }

  messages.forEach((msg) => {
    const messageEl = document.createElement("div");
    messageEl.className = `message${msg.senderType === "client" ? " me" : ""}`;

    const header = document.createElement("div");
    header.className = "message-header";

    const name = document.createElement("span");
    name.className = "message-name";
    name.textContent = msg.senderName || (msg.senderType === "team" ? "Dev Team" : "You");

    const time = document.createElement("span");
    time.textContent = formatTime(msg.createdAt);

    header.appendChild(name);
    header.appendChild(time);

    const text = document.createElement("p");
    text.textContent = msg.text;

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const status = document.createElement("span");
    status.className = "status";
    status.textContent = msg.senderType === "client" ? "Sent" : "Delivered";

    meta.appendChild(status);

    messageEl.appendChild(header);
    messageEl.appendChild(text);
    messageEl.appendChild(meta);

    chatMessages.appendChild(messageEl);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
};

const fetchMessages = async () => {
  try {
    const data = await apiFetch("/api/messages");
    renderMessages(Array.isArray(data) ? data : []);
  } catch (error) {
    // Ignore message load errors
  }
};

const startChatPolling = () => {
  if (chatPoller) return;
  fetchMessages();
  chatPoller = window.setInterval(fetchMessages, 3000);
};

const stopChatPolling = () => {
  if (!chatPoller) return;
  window.clearInterval(chatPoller);
  chatPoller = null;
};

const sendMessage = async () => {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  if (!text) return;

  try {
    await postJSON("/api/messages", { text, senderType: "client" });
    chatInput.value = "";
    fetchMessages();

    window.setTimeout(async () => {
      await postJSON("/api/messages", {
        text: "Thanks for the update. We are reviewing it now.",
        senderType: "team",
        senderName: "Dev Team",
      });
      fetchMessages();
    }, 1000);
  } catch (error) {
    alert(error.message);
  }
};

if (chatSend) {
  chatSend.addEventListener("click", sendMessage);
}

if (chatInput) {
  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
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

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("tv_token");
    localStorage.removeItem("tv_username");
    window.location.href = "index.html";
  });
}

loadProfile();

