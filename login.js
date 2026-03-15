const API_BASE = "https://trackvista.onrender.com";
const openLogin = document.getElementById("open-login");
const hero = document.getElementById("hero");
const auth = document.getElementById("auth");

const toggleButtons = document.querySelectorAll(".toggle-btn");
const signInForm = document.getElementById("signin-form");
const signUpForm = document.getElementById("signup-form");

const postJSON = async (path, payload) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
};

if (openLogin) {
  openLogin.addEventListener("click", () => {
    hero.classList.add("hidden");
    auth.classList.remove("hidden");
    auth.scrollIntoView({ behavior: "smooth" });
  });
}

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

if (signInForm) {
  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = signInForm.querySelector("input[type=\"text\"]")?.value.trim();
    const password = signInForm.querySelector("input[type=\"password\"]")?.value;
    if (!username || !password) return;

    try {
      const data = await postJSON("/api/auth/login", { username, password });
      localStorage.setItem("tv_token", data.token);
      localStorage.setItem("tv_username", data.user.username);
      window.location.href = "dashboard.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

if (signUpForm) {
  signUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = signUpForm.querySelector("input[type=\"text\"]")?.value.trim();
    const email = signUpForm.querySelector("input[type=\"email\"]")?.value.trim();
    const password = signUpForm.querySelector("input[type=\"password\"]")?.value;
    if (!username || !email || !password) return;

    try {
      await postJSON("/api/auth/signup", { username, email, password });
      alert("Account created. Please sign in.");
      toggleButtons.forEach((b) => b.classList.remove("active"));
      const signInButton = document.querySelector("[data-mode=\"signin\"]");
      if (signInButton) signInButton.classList.add("active");
      signUpForm.classList.add("hidden");
      signInForm.classList.remove("hidden");
    } catch (error) {
      alert(error.message);
    }
  });
}

