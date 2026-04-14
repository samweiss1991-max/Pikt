// pickt Chrome Extension — Content Script
// Injects drawer into ATS pages and handles DOM detection.

(function () {
  "use strict";

  let drawerOpen = false;
  let drawerEl = null;

  // ── ATS Detection ────────────────────────────────────────

  function detectATS() {
    const host = window.location.hostname;
    if (host.includes("greenhouse.io")) return "Greenhouse";
    if (host.includes("lever.co")) return "Lever";
    if (host.includes("workable.com")) return "Workable";
    if (host.includes("ashbyhq.com")) return "Ashby";
    return null;
  }

  // Best-effort candidate detection from ATS DOM.
  // These selectors are heuristic and may need updating as ATS platforms change.
  function detectCandidate() {
    const ats = detectATS();
    let name = null;
    let role = null;
    let email = null;
    let stage = null;
    let skills = [];
    let interviews = 0;

    try {
      if (ats === "Greenhouse") {
        name =
          document.querySelector(".candidate-name")?.textContent?.trim() ||
          document.querySelector("h1")?.textContent?.trim();
        role =
          document.querySelector(".job-name")?.textContent?.trim() ||
          document.querySelector('[class*="job"]')?.textContent?.trim();
        stage =
          document.querySelector(".stage-name")?.textContent?.trim() ||
          document.querySelector('[class*="stage"]')?.textContent?.trim();
        const skillEls = document.querySelectorAll(".tag, .skill-tag, [class*='skill']");
        skills = Array.from(skillEls)
          .map((el) => el.textContent?.trim())
          .filter(Boolean)
          .slice(0, 10);
      } else if (ats === "Lever") {
        name =
          document.querySelector(".candidate-name")?.textContent?.trim() ||
          document.querySelector("h1")?.textContent?.trim();
        role =
          document.querySelector(".posting-title")?.textContent?.trim();
        stage =
          document.querySelector(".stage-label")?.textContent?.trim();
        const tagEls = document.querySelectorAll(".tag-list .tag, .tag");
        skills = Array.from(tagEls)
          .map((el) => el.textContent?.trim())
          .filter(Boolean)
          .slice(0, 10);
      } else if (ats === "Workable") {
        name =
          document.querySelector(".candidate-header h1")?.textContent?.trim() ||
          document.querySelector("h1")?.textContent?.trim();
        stage =
          document.querySelector('[class*="pipeline"]')?.textContent?.trim();
      } else if (ats === "Ashby") {
        name =
          document.querySelector('[data-testid="candidate-name"]')?.textContent?.trim() ||
          document.querySelector("h1")?.textContent?.trim();
        stage =
          document.querySelector('[data-testid*="stage"]')?.textContent?.trim();
      }

      // Fallback: largest h1 + email pattern
      if (!name) {
        const h1s = document.querySelectorAll("h1");
        if (h1s.length > 0) name = h1s[0].textContent?.trim();
      }
      if (!email) {
        const bodyText = document.body.innerText || "";
        const emailMatch = bodyText.match(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
        );
        if (emailMatch) email = emailMatch[0];
      }

      // Count interview-like sections
      const interviewEls = document.querySelectorAll(
        '[class*="interview"], [class*="scorecard"], [class*="feedback"]'
      );
      interviews = interviewEls.length || 0;
    } catch (e) {
      console.warn("[pickt] ATS detection error:", e);
    }

    return {
      ats,
      name: name || null,
      role: role || null,
      email: email || null,
      stage: stage || null,
      skills: skills.length > 0 ? skills : [],
      interviews,
    };
  }

  // ── Drawer ───────────────────────────────────────────────

  function createDrawer() {
    if (drawerEl) return;

    drawerEl = document.createElement("div");
    drawerEl.id = "pickt-drawer";
    drawerEl.className = "pickt-drawer pickt-drawer--closed";

    const detected = detectCandidate();

    drawerEl.innerHTML = getDrawerHTML(detected);
    document.body.appendChild(drawerEl);

    // Bind events after insertion
    setupDrawerEvents(detected);
  }

  function getDrawerHTML(detected) {
    const atsName = detected.ats || "Unknown ATS";
    const hasDetection = detected.name || detected.role;

    return `
      <div class="pickt-header">
        <span class="pickt-logo">pick<span class="pickt-logo-t">t</span></span>
        <button class="pickt-close" id="pickt-close">×</button>
      </div>

      <div class="pickt-tabs">
        <button class="pickt-tab pickt-tab--active" data-tab="refer">Refer candidate</button>
        <button class="pickt-tab" data-tab="search">Search pickt</button>
      </div>

      <!-- Auth screen (hidden when logged in) -->
      <div class="pickt-auth" id="pickt-auth" style="display:none">
        <div class="pickt-auth-inner">
          <span class="pickt-logo pickt-logo--lg">pick<span class="pickt-logo-t">t</span></span>
          <p class="pickt-auth-text">Sign in to refer candidates and search the marketplace.</p>
          <button class="pickt-btn pickt-btn--primary" id="pickt-login-btn">Sign in to pickt</button>
        </div>
      </div>

      <!-- Refer tab -->
      <div class="pickt-panel" id="pickt-panel-refer">
        ${
          hasDetection
            ? `
        <div class="pickt-detection">
          <span class="pickt-detection-label">Detected on page</span>
          <p class="pickt-detection-name">${detected.name || "Unknown candidate"}</p>
          <p class="pickt-detection-meta">${detected.role || "Role unknown"} · ${atsName}</p>
          ${
            detected.skills.length > 0
              ? `<div class="pickt-detection-skills">${detected.skills.map((s) => `<span class="pickt-pill">${s}</span>`).join("")}</div>`
              : ""
          }
          ${
            detected.interviews > 0
              ? `<span class="pickt-interviews-pill">${detected.interviews} interview${detected.interviews !== 1 ? "s" : ""}</span>`
              : ""
          }
        </div>`
            : `
        <div class="pickt-detection pickt-detection--empty">
          <span class="pickt-detection-label">No candidate detected</span>
          <p class="pickt-detection-meta">Navigate to a candidate profile in your ATS.</p>
        </div>`
        }

        <div class="pickt-form" id="pickt-refer-form">
          <div class="pickt-field">
            <label class="pickt-label">Role title *</label>
            <input class="pickt-input" id="pickt-role" value="${detected.role || ""}" placeholder="e.g. Senior Frontend Engineer" />
          </div>
          <div class="pickt-field">
            <label class="pickt-label">Why not hired? *</label>
            <select class="pickt-input" id="pickt-why">
              <option value="">Select reason</option>
              <option>Headcount freeze</option>
              <option>Skills mismatch</option>
              <option>Timing</option>
              <option>Overqualified</option>
              <option>Culture fit</option>
              <option>Other</option>
            </select>
          </div>
          <div class="pickt-field">
            <label class="pickt-label">Key strengths</label>
            <input class="pickt-input" id="pickt-strengths" placeholder="What stood out?" />
          </div>
          <div class="pickt-field">
            <label class="pickt-label">Development areas</label>
            <input class="pickt-input" id="pickt-gaps" placeholder="Where could they improve?" />
          </div>
          <div class="pickt-fee-row">
            <input class="pickt-fee-input" id="pickt-fee" type="number" min="0" max="100" value="8" />
            <span class="pickt-fee-label">% of first-year salary</span>
          </div>
          <label class="pickt-consent">
            <input type="checkbox" id="pickt-consent" />
            <span>Candidate has consented to referral</span>
          </label>
          <button class="pickt-btn pickt-btn--primary pickt-btn--full" id="pickt-submit">
            Refer to pickt marketplace
          </button>
        </div>

        <div class="pickt-success" id="pickt-success" style="display:none">
          <div class="pickt-success-icon">✓</div>
          <p class="pickt-success-title">Candidate live on pickt</p>
          <a class="pickt-success-link" href="http://localhost:3000/dashboard/my-candidates" target="_blank">View on marketplace →</a>
        </div>
      </div>

      <!-- Search tab -->
      <div class="pickt-panel" id="pickt-panel-search" style="display:none">
        <div class="pickt-field">
          <input class="pickt-input" id="pickt-search-input" placeholder="Search roles, skills, locations…" />
        </div>
        <div class="pickt-search-label" id="pickt-search-label" style="display:none">
          Results — click to view profile
        </div>
        <div id="pickt-search-results" class="pickt-search-results"></div>
      </div>
    `;
  }

  function setupDrawerEvents(detected) {
    // Close button
    document.getElementById("pickt-close").addEventListener("click", toggleDrawer);

    // Tabs
    drawerEl.querySelectorAll(".pickt-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        drawerEl.querySelectorAll(".pickt-tab").forEach((t) => t.classList.remove("pickt-tab--active"));
        tab.classList.add("pickt-tab--active");
        const tabId = tab.dataset.tab;
        document.getElementById("pickt-panel-refer").style.display =
          tabId === "refer" ? "block" : "none";
        document.getElementById("pickt-panel-search").style.display =
          tabId === "search" ? "block" : "none";
      });
    });

    // Login button
    document.getElementById("pickt-login-btn")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
    });

    // Submit referral
    document.getElementById("pickt-submit").addEventListener("click", handleSubmit);

    // Search with debounce
    let searchTimeout;
    document.getElementById("pickt-search-input").addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
    });

    // Check auth on load
    checkAuth();
  }

  function handleSubmit() {
    const role = document.getElementById("pickt-role").value.trim();
    const why = document.getElementById("pickt-why").value;
    const strengths = document.getElementById("pickt-strengths").value.trim();
    const gaps = document.getElementById("pickt-gaps").value.trim();
    const fee = Number(document.getElementById("pickt-fee").value) || 8;
    const consent = document.getElementById("pickt-consent").checked;

    if (!role) return alert("Role title is required.");
    if (!why) return alert("Please select a reason for not hiring.");
    if (!consent) return alert("Please confirm candidate consent.");

    const detected = detectCandidate();
    const btn = document.getElementById("pickt-submit");
    btn.textContent = "Submitting…";
    btn.disabled = true;

    chrome.runtime.sendMessage(
      {
        type: "API_REQUEST",
        method: "POST",
        path: "/api/candidates/quick",
        body: {
          role_applied_for: role,
          why_not_hired: why,
          strengths: strengths || null,
          gaps: gaps || null,
          fee_percentage: fee,
          consent_given: consent,
          full_name: detected.name || null,
          email: detected.email || null,
          skills: detected.skills,
          interview_stage_reached: detected.stage || null,
          interviews_completed: detected.interviews || 0,
          ats_platform: detected.ats || null,
        },
      },
      (response) => {
        btn.textContent = "Refer to pickt marketplace";
        btn.disabled = false;

        if (response?.ok) {
          document.getElementById("pickt-refer-form").style.display = "none";
          document.getElementById("pickt-success").style.display = "block";
        } else {
          alert(response?.data?.error || "Failed to submit. Please try again.");
        }
      }
    );
  }

  function handleSearch(query) {
    const resultsEl = document.getElementById("pickt-search-results");
    const labelEl = document.getElementById("pickt-search-label");

    if (!query.trim()) {
      resultsEl.innerHTML = "";
      labelEl.style.display = "none";
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "API_REQUEST",
        method: "GET",
        path: `/api/candidates/search?q=${encodeURIComponent(query)}`,
      },
      (response) => {
        if (!response?.ok) {
          resultsEl.innerHTML = '<p class="pickt-no-results">Search failed.</p>';
          return;
        }

        const candidates = response.data.candidates || [];
        labelEl.style.display = candidates.length > 0 ? "block" : "none";

        if (candidates.length === 0) {
          resultsEl.innerHTML = '<p class="pickt-no-results">No candidates found.</p>';
          return;
        }

        resultsEl.innerHTML = candidates
          .map(
            (c) => `
          <div class="pickt-result-card">
            <p class="pickt-result-role">${c.role_applied_for || "Unknown role"}</p>
            <p class="pickt-result-meta">
              ${c.seniority_level || ""} · ${c.location_city || ""} · ${c.interviews_completed || 0} interviews
              ${c.referring_company ? `· Referred by ${c.referring_company}` : ""}
            </p>
            <div class="pickt-result-footer">
              <span class="pickt-result-fee">${c.fee_percentage || 8}%</span>
              <a class="pickt-result-link" href="http://localhost:3000/dashboard/candidates/${c.id}" target="_blank">View profile</a>
            </div>
          </div>
        `
          )
          .join("");
      }
    );
  }

  function checkAuth() {
    chrome.runtime.sendMessage({ type: "GET_AUTH" }, (response) => {
      const authScreen = document.getElementById("pickt-auth");
      const referPanel = document.getElementById("pickt-panel-refer");
      const searchPanel = document.getElementById("pickt-panel-search");

      if (!response?.token) {
        authScreen.style.display = "flex";
        referPanel.style.display = "none";
        searchPanel.style.display = "none";
      } else {
        authScreen.style.display = "none";
      }
    });
  }

  // ── Toggle ───────────────────────────────────────────────

  function toggleDrawer() {
    if (!drawerEl) createDrawer();

    drawerOpen = !drawerOpen;

    if (drawerOpen) {
      drawerEl.classList.remove("pickt-drawer--closed");
      drawerEl.classList.add("pickt-drawer--open");
      document.body.style.marginRight = "300px";
      document.body.style.transition = "margin-right 0.25s ease";
    } else {
      drawerEl.classList.remove("pickt-drawer--open");
      drawerEl.classList.add("pickt-drawer--closed");
      document.body.style.marginRight = "0";
    }
  }

  // ── Message handler ──────────────────────────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_DRAWER") {
      toggleDrawer();
    }
    if (message.type === "AUTH_TOKEN") {
      // Received token from login page
      chrome.runtime.sendMessage({
        type: "SET_AUTH",
        token: message.token,
        user: message.user,
      });
      checkAuth();
    }
  });
})();
