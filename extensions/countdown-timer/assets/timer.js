
document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector(".countdown_timer");
  if (!root) {
    return;
  }

  const shop = (root.dataset.shop || "").trim();
  const apiBase = (root.dataset.apiBase || "").replace(/\/$/, "");

  if (!shop || !apiBase) {
    console.warn(
      "Countdown timer: set data-shop and data-api-base on .countdown_timer (theme block settings)."
    );
    return;
  }

  const productId = (root.dataset.productId || "").trim();

  const url = new URL("/api/public/timer", apiBase);
  url.searchParams.set("shop", shop);
  url.searchParams.set("productId", productId);

  fetch(url.toString(), { method: "GET", credentials: "omit" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
        console.log("Timer API response", data);
      
        if (!data?.success || !data?.timer) {
          root.style.display = "none";
          return;
        }
      
        const timer = data.timer;
      
        // Optional: check status
        if (timer.status !== "ACTIVE") {
          root.style.display = "none";
          return;
        }
      
        const countdownTarget = resolveCountdownTarget({
          timer,
          shop,
        });
        if (!countdownTarget) {
          root.style.display = "none";
          return;
        }
      
        // Show timer
        root.style.display = "block";
      
        let labelEl = root.querySelector(".timer-label");
        let valueEl = root.querySelector(".timer-value");
        if (!valueEl) {
          valueEl = document.createElement("span");
          valueEl.className = "timer-value";
          valueEl.setAttribute("role", "timer");
          root.appendChild(valueEl);
        }
        if (!labelEl) {
          labelEl = document.createElement("span");
          labelEl.className = "timer-label";
          labelEl.setAttribute("aria-hidden", "true");
          root.insertBefore(labelEl, valueEl);
        }

        if (timer.label) {
          labelEl.textContent = `⏳ ${timer.label}: `;
        }

        startCountdown(valueEl, countdownTarget);
    })
    .catch((err) => {
      console.error("Timer fetch failed", err);
    });
});


function resolveCountdownTarget({ timer, shop }) {
  const now = Date.now();
  const timerType = timer?.timerType || "FIXED_WINDOW";

  if (timerType === "EVERGREEN") {
    const durationSeconds = Number(timer?.evergreenDurationSeconds);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return null;
    }

    const sessionKey = [
      "countdown_timer",
      "evergreen",
      shop || "unknown-shop",
      timer.id || "unknown-timer",
    ].join(":");

    const startedAt = getOrCreateSessionStart(sessionKey, now);
    const endMs = startedAt + Math.floor(durationSeconds * 1000);
    if (now >= endMs) {
      return null;
    }
    return new Date(endMs).toISOString();
  }

  const start = new Date(timer.startAtUtc).getTime();
  const end = new Date(timer.endAtUtc).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }
  if (now < start || now > end) {
    return null;
  }
  return timer.endAtUtc;
}

function getOrCreateSessionStart(key, nowMs) {
  try {
    const existingRaw = sessionStorage.getItem(key);
    const existing = Number(existingRaw);
    if (Number.isFinite(existing) && existing > 0) {
      return existing;
    }
    sessionStorage.setItem(key, String(nowMs));
  } catch (_error) {
    return nowMs;
  }
  return nowMs;
}

function startCountdown(el, endTime) {
    if (!el || !(el instanceof Element)) {
      console.warn("Countdown timer: missing .timer-value element");
      return;
    }

    const end = new Date(endTime).getTime();
    if (Number.isNaN(end)) {
      el.textContent = "";
      return;
    }

    function update() {
      const now = new Date().getTime();
      const diff = end - now;
  
      if (diff <= 0) {
        el.textContent = "Expired";
        return;
      }
  
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
  
      el.textContent =
        (days > 0 ? `${days}d ` : "") +
        `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
  
    function pad(n) {
      return n < 10 ? "0" + n : n;
    }
  
    update();
    setInterval(update, 1000);
}