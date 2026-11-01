(() => {
  const root = document.querySelector("#adminRoot");
  if (!root || !window.location.pathname.startsWith("/admin")) return;
  document.body.classList.add("admin-shell");
  root.hidden = false;
  const STATUSES = [
    "DRAFT",
    "PENDING_REVIEW",
    "APPROVED",
    "PUBLISHED",
    "REJECTED",
    "EXPIRED",
    "ARCHIVED",
  ];
  const state = {
    user: null,
    path: window.location.pathname,
    page: 1,
    filters: {},
    resourceMessage: "",
  };
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const newTranslationId = () => window.crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
    const random = Math.random() * 16 | 0;
    return (character === "x" ? random : (random & 3) | 8).toString(16);
  });
  const button = (label, action, cls = "") => {
    const b = el("button", `admin-button ${cls}`, label);
    b.type = "button";
    if (typeof action === "function") b.addEventListener("click", action);
    return b;
  };
  const api = async (path, options = {}) => {
    const request = () =>
      fetch(`${window.JPEDIA_CONFIG?.API_BASE_URL || "/api"}${path}`, {
        credentials: "include",
        ...options,
        headers: {
          ...(options.body && !(options.body instanceof FormData)
            ? { "Content-Type": "application/json" }
            : {}),
          ...(options.headers || {}),
        },
      });
    let response = await request();
    if (response.status === 401 && path !== "/auth/refresh") {
      const refreshed = await fetch(`${window.JPEDIA_CONFIG?.API_BASE_URL || "/api"}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (refreshed.ok) response = await request();
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      const error = new Error(
        result.error?.message || `Request failed (${response.status})`,
      );
      error.status = response.status;
      error.code = result.error?.code;
      error.details = result.error?.details;
      throw error;
    }
    return { data: result.data, pagination: result.pagination };
  };
  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";
  const statusBadge = (value) =>
    el(
      "span",
      `admin-status status-${String(value || "UNKNOWN").toLowerCase()}`,
      value || "UNKNOWN",
    );
  const params = (values) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(values))
      if (v !== "" && v !== undefined && v !== null) q.set(k, v);
    return q.toString();
  };
  function notice(message, kind = "") {
    const n = el("div", `admin-notice ${kind}`, message);
    n.setAttribute("role", "status");
    return n;
  }
  function gate(code, title, message) {
    root.replaceChildren();
    const box = el("section", "admin-gate");
    box.append(
      el("div", "admin-wordmark", "SetBGet Admin"),
      el("h1", "", title),
      el("p", "", message),
    );
    if (code === 401) {
      const a = el("a", "admin-button", "Sign in on SetBGet");
      a.href = "/";
      box.append(a);
    }
    const back = el("a", "admin-back", "Return to SetBGet");
    back.href = "/";
    box.append(back);
    root.append(box);
  }
  const navItems = [
    ["Dashboard", "/admin", "dashboard"],
    ["Jobs", "/admin/jobs", "jobs"],
    ["Job Discovery", "/admin/job-discovery", "discovery"],
    ["Users", "/admin/users", "users"],
    ["Authors", "/admin/authors", "authors"],
    ["Boards", "/admin/boards", "boards"],
    ["Communities", "/admin/communities", "communities"],
    ["Resources", "/admin/resources", "resources"],
    ["Templates", "/admin/templates", "templates"],
    ["Notifications", "/admin/notifications", "notifications"],
    ["FAQs", "/admin/faqs", "faqs"],
    ["Recruitment Sources", "/admin/recruitment-sources", "sources"],
  ];
  const authorNavItems = [
    ["Dashboard", "/admin", "dashboard"],
    ["My Jobs", "/admin/jobs", "jobs"],
    ["Create Job", "/admin/jobs/new", "create"],
    ["Drafts", "/admin/jobs/drafts", "drafts"],
    ["Pending Review", "/admin/jobs/pending", "pending"],
    ["Rejected", "/admin/jobs/rejected", "rejected"],
    ["Published", "/admin/jobs/published", "published"],
    ["Resources", "/admin/resources", "resources"],
    ["Templates", "/admin/templates", "templates"],
    ["Saved Sections", "/admin/saved-sections", "sections"],
    ["Profile", "/admin/profile", "profile"],
  ];
  function shell(active) {
    const layout = el("div", "admin-layout");
    const sidebar = el("aside", "admin-sidebar");
    sidebar.append(
      el(
        "div",
        "admin-brand",
        state.user.role === "AUTHOR" ? "SetBGet Author" : "SetBGet Admin",
      ),
    );
    const nav = el("nav", "admin-nav");
    nav.setAttribute("aria-label", "Admin navigation");
    const visibleNav =
      state.user.role === "AUTHOR"
        ? authorNavItems
        : [
            ...navItems,
            ...(state.user.role === "SUPER_ADMIN"
              ? [
                  ["Staff", "/admin/staff", "staff"],
                  ["Audit Log", "/admin/audit-log", "audit"],
                ]
              : []),
          ];
    for (const [label, href, key] of visibleNav) {
      const a = el("a", active === key ? "is-active" : "", label);
      a.href = href;
      if (active === key) a.setAttribute("aria-current", "page");
      a.addEventListener("click", (event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        navigate(href);
      });
      nav.append(a);
    }
    sidebar.append(
      nav,
      el(
        "div",
        "admin-sidebar-note",
        `Signed in as ${state.user.name} · ${state.user.role}`,
      ),
    );
    const main = el("div", "admin-main");
    const bar = el("header", "admin-topbar");
    bar.append(
      el(
        "div",
        "admin-topbar-title",
        state.user.role === "AUTHOR"
          ? "SetBGet · Author Workspace"
          : "SetBGet · Administration",
      ),
    );
    const account = el("div", "admin-topbar-account");
    account.append(
      el("span", "", `${state.user.name} (${state.user.role})`),
      button("Logout", logout),
    );
    bar.append(account);
    main.append(bar);
    const content = el("main", "admin-content");
    main.append(content);
    layout.append(sidebar, main);
    root.replaceChildren(layout);
    return content;
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    window.location.assign("/");
  }
  function table(headers, rows) {
    const wrap = el("div", "admin-table-wrap"),
      t = el("table", "admin-table"),
      head = el("thead"),
      tr = el("tr");
    const columnType = (header) => {
      const label = String(header).toLowerCase();
      if (/action/.test(label)) return "actions-cell";
      if (
        /date|deadline|created|updated|when|reviewed|submitted|published|discovered|fetched/.test(
          label,
        )
      )
        return "table-date";
      if (/status|active|verified|role/.test(label)) return "table-status";
      if (
        /title|organization|summary|description|content|question|answer|website/.test(
          label,
        )
      )
        return "table-text";
      return "";
    };
    headers.forEach((h) => tr.append(el("th", columnType(h), h)));
    head.append(tr);
    const body = el("tbody");
    rows.forEach((row) => {
      [...row.cells].forEach((cell, index) => {
        const kind = columnType(headers[index] || "");
        if (kind) cell.classList.add(kind);
        if (kind === "actions-cell" && cell.querySelector("button, a")) {
          const group = el("div", "actions-group");
          while (cell.firstChild) group.append(cell.firstChild);
          cell.append(group);
          group
            .querySelectorAll("button, a")
            .forEach((control) =>
              control.classList.add("dashboard-action-btn"),
            );
        }
      });
      body.append(row);
    });
    t.append(head, body);
    wrap.append(t);
    return wrap;
  }
  function empty(message) {
    return el("div", "admin-empty", message);
  }
  function paginationBar(meta, onPage) {
    const bar = el("div", "admin-pagination");
    const info = meta.total
      ? `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`
      : "No results";
    bar.append(
      el("span", "", info),
      button(
        "Previous",
        () => onPage(Math.max(1, meta.page - 1)),
        meta.page <= 1 ? "is-disabled" : "",
      ),
      button(
        "Next",
        () => onPage(meta.page + 1),
        !meta.hasNextPage ? "is-disabled" : "",
      ),
    );
    bar.querySelectorAll("button").forEach((b, i) => {
      if ((i === 1 && meta.page <= 1) || (i === 2 && !meta.hasNextPage))
        b.disabled = true;
    });
    return bar;
  }
  function actionsFor(job) {
    const wrap = el("div", "admin-row-actions");
    wrap.append(button("View", () => viewJob(job._id)));
    if (["ADMIN", "SUPER_ADMIN"].includes(state.user.role)) {
      wrap.append(
        button("Edit", () => location.assign(`/admin/jobs/${job._id}/edit`)),
      );
      if (job.status === "PENDING_REVIEW") {
        wrap.append(
          button("Approve", () => jobAction(job, "approve"), "is-primary"),
          button("Reject", () => rejectJob(job), "is-danger"),
        );
      }
      if (["DRAFT", "REJECTED"].includes(job.status))
        wrap.append(
          button("Submit for review", () => submitJob(job), "is-primary"),
        );
      if (job.status === "APPROVED")
        wrap.append(
          button("Publish", () => jobAction(job, "publish"), "is-primary"),
        );
      if (job.status !== "ARCHIVED")
        wrap.append(
          button(job.status === "PUBLISHED" ? "Unpublish" : "Archive", () =>
            jobAction(job, "unpublish"),
          ),
        );
      if (state.user.role === "SUPER_ADMIN")
        wrap.append(
          button("Delete permanently", () => deleteJob(job, true), "is-danger"),
        );
    } else if (
      state.user.role === "AUTHOR" &&
      String(job.author?._id || job.author) === String(state.user._id)
    ) {
      if (["DRAFT", "REJECTED"].includes(job.status)) {
        wrap.append(
          button("Edit", () => location.assign(`/admin/jobs/${job._id}/edit`)),
        );
        wrap.append(
          button("Submit for review", () => submitJob(job), "is-primary"),
        );
        wrap.append(button("Delete", () => deleteJob(job), "is-danger"));
      }
    }
    return wrap;
  }
  function jobRow(job) {
    const tr = el("tr");
    const title = el("td");
    title.append(
      el("strong", "", job.title || "Untitled Draft"),
      el("small", "admin-cell-sub", job._id),
    );
    const source = job.source?.name || job.sourceUrl || "—";
    [
      title,
      el("td", "", job.organization || "—"),
      el("td", "", job.board?.name || job.boardName || "—"),
      el("td", "", job.category || "—"),
      el("td", "", ""),
    ].forEach((cell) => tr.append(cell));
    tr.children[4].append(statusBadge(job.status));
    tr.append(
      el("td", "", formatDate(job.applicationDeadline)),
      el("td", "", source),
      el("td", "", formatDate(job.createdAt)),
    );
    const actionCell = el("td");
    actionCell.append(actionsFor(job));
    tr.append(actionCell);
    if (tr.cells.length !== 9)
      throw new Error(`Job list row has ${tr.cells.length} cells; expected 9.`);
    return tr;
  }
  function recentJobRow(job) {
    const row = jobRow(job);
    row.insertBefore(
      el("td", "", formatDate(job.updatedAt)),
      row.lastElementChild,
    );
    if (row.cells.length !== 10)
      throw new Error(
        `Recent job row has ${row.cells.length} cells; expected 10.`,
      );
    return row;
  }
  async function jobAction(job, action) {
    const routes = {
      approve: `/admin/jobs/${job._id}/approve`,
      publish: `/admin/jobs/${job._id}/publish`,
      unpublish: `/admin/jobs/${job._id}/unpublish`,
    };
    const confirmation = {
      approve:
        "Approve this recruitment for publication review? This does not publish it.",
      publish: "Publish this approved recruitment?",
      unpublish: "Archive this recruitment and remove it from public listings?",
    }[action];
    if (confirmation && !window.confirm(confirmation)) return;
    try {
      await api(routes[action], { method: "POST" });
      await renderJobs(state.page, state.filters);
    } catch (error) {
      showError(error);
    }
  }
  async function rejectJob(job) {
    const reason = window.prompt("Reason for rejection (required):");
    if (reason === null) return;
    if (reason.trim().length < 2) {
      showError(
        new Error("Enter a rejection reason of at least two characters."),
      );
      return;
    }
    try {
      await api(`/admin/jobs/${job._id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      await renderJobs(state.page, state.filters);
    } catch (error) {
      showError(error);
    }
  }
  async function submitJob(job) {
    try {
      await api(`/jobs/${job._id}/submit-review`, { method: "POST" });
      await renderJobs(state.page, state.filters);
    } catch (error) {
      showError(error);
    }
  }
  async function deleteJob(job, administrative = false) {
    const message = administrative
      ? `Permanently delete “${job.title}”?\n\nThis is allowed only when no saved jobs or applications reference it. Historical relationships must be archived instead.`
      : "Delete draft?\n\nThis will permanently delete this job draft. This action cannot be undone.";
    if (!window.confirm(message)) return;
    try {
      await api(`/jobs/${job._id}`, { method: "DELETE" });
      await renderRoute();
    } catch (error) {
      showError(error);
    }
  }
  function showError(error) {
    const target = root.querySelector(".admin-content");
    if (target)
      target.prepend(
        notice(
          error.status === 401
            ? "Your session expired. Please sign in again."
            : error.status === 403
              ? "You do not have permission for that action."
              : error.message,
          "is-error",
        ),
      );
  }
  async function viewJob(id) {
    try {
      const { data } = await api(`/jobs/${encodeURIComponent(id)}`);
      previewJob(data, true);
    } catch (error) {
      showError(error);
    }
  }
  async function renderDashboard() {
    if (state.user.role === "AUTHOR") {
      const content = shell("dashboard");
      const heading = el("div", "admin-page-heading");
      heading.append(
        el("h1", "", `Good day, ${state.user.name}`),
        button(
          "Create Job",
          () => location.assign("/admin/jobs/new"),
          "is-primary",
        ),
      );
      content.append(
        heading,
        el(
          "p",
          "admin-muted",
          "Recruitment workspace · prepare structured information, verify it, then submit for review.",
        ),
      );
      try {
        const { data } = await api("/jobs/mine/summary");
        const grid = el("section", "admin-stat-grid");
        [
          ["DRAFT", "Drafts"],
          ["PENDING_REVIEW", "Pending Review"],
          ["REJECTED", "Rejected"],
          ["PUBLISHED", "Published"],
        ].forEach(([key, label]) => {
          const card = el("article", "admin-stat-card");
          card.append(
            el("span", "", label),
            el("strong", "", String(data.counts?.[key] ?? 0)),
          );
          grid.append(card);
        });
        content.append(grid, el("h2", "admin-section-title", "Recent Jobs"));
        if (data.recent?.length)
          content.append(
            table(
              [
                "Job Title",
                "Organization",
                "Board",
                "Category",
                "Status",
                "Deadline",
                "Source",
                "Created",
                "Updated",
                "Actions",
              ],
              data.recent.map(recentJobRow),
            ),
          );
        else
          content.append(
            empty(
              "No jobs yet. Start with a blank job or a structure template.",
            ),
          );
      } catch (error) {
        content.append(notice(error.message, "is-error"));
      }
      return;
    }
    const content = shell("dashboard");
    const heading = el("div", "admin-page-heading");
    heading.append(el("h1", "", "Dashboard"));
    content.append(heading);
    try {
      const { data } = await api("/admin/dashboard");
      const cards = [
        ["Jobs", data.totalJobs],
        ["Draft", data.jobs?.DRAFT],
        ["Pending Review", data.jobs?.PENDING_REVIEW],
        ["Approved", data.jobs?.APPROVED],
        ["Published", data.jobs?.PUBLISHED],
        ["Rejected", data.jobs?.REJECTED],
        ["Expired", data.jobs?.EXPIRED],
        ["Users", data.totalUsers],
        ["Active Users", data.activeUsers],
        ["Verified Users", data.verifiedUsers],
        ["Authors", data.totalAuthors],
        ["Active Authors", data.activeAuthors],
        ["Boards", data.totalBoards],
        ["Communities", data.totalCommunities],
        ["Resources", data.totalResources],
        ["Templates", data.totalTemplates],
        ["FAQs", data.totalFaqs],
        ["Active Sources", data.activeSources],
        ["Failed Sources", data.failedSources],
        ["Pending Discoveries", data.discoveries],
      ];
      const grid = el("section", "admin-stat-grid");
      cards.forEach(([label, value]) => {
        const card = el("article", "admin-stat-card");
        card.append(
          el("span", "", label),
          el("strong", "", String(value ?? 0)),
        );
        grid.append(card);
      });
      content.append(grid);
      const shortcuts = el("section", "admin-shortcuts");
      shortcuts.append(el("h2", "", "Job workflow"));
      shortcuts.append(
        button(
          "Review pending jobs",
          () => location.assign("/admin/jobs/review"),
          "is-primary",
        ),
        button("Manage jobs", () => location.assign("/admin/jobs")),
        button("Review discoveries", () =>
          location.assign("/admin/job-discovery"),
        ),
      );
      content.append(shortcuts);
      const activity = el("section", "admin-subsection");
      activity.append(el("h2", "", "Recent administrative activity"));
      const events = data.recentActivity || [];
      if (events.length) {
        const rows = events.map((item) => {
          const row = el("tr");
          row.append(
            el("td", "", formatDate(item.createdAt)),
            el("td", "", item.actor?.name || "—"),
            el("td", "", item.actorRole || "—"),
            el("td", "", item.action),
            el("td", "", item.summary || "—"),
          );
          return row;
        });
        activity.append(
          table(["When", "Actor", "Role", "Action", "Details"], rows),
        );
      } else activity.append(empty("No administrative activity recorded yet."));
      content.append(activity);
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  async function renderJobs(page = 1, filters = {}) {
    const authorFilter = {
      "/admin/jobs/drafts": "DRAFT",
      "/admin/jobs/pending": "PENDING_REVIEW",
      "/admin/jobs/rejected": "REJECTED",
      "/admin/jobs/published": "PUBLISHED",
    }[state.path];
    if (authorFilter && !filters.status)
      filters = { ...filters, status: authorFilter };
    state.page = page;
    state.filters = filters;
    const active = state.path.endsWith("/review") ? "review" : "jobs";
    const content = shell(authorFilter ? state.path.split("/").pop() : "jobs");
    const heading = el("div", "admin-page-heading");
    heading.append(
      el(
        "h1",
        "",
        active === "review"
          ? "Pending review"
          : {
              DRAFT: "Drafts",
              PENDING_REVIEW: "Pending Review",
              REJECTED: "Rejected",
              PUBLISHED: "Published",
            }[authorFilter] || "Jobs",
      ),
    );
    const controls = el("div", "admin-page-actions");
    if (active !== "review")
      controls.append(
        button(
          "Create job",
          () => location.assign("/admin/jobs/new"),
          "is-primary",
        ),
      );
    heading.append(controls);
    content.append(heading);
    const form = el("form", "admin-filter-form");
    const q = el("input");
    q.name = "q";
    q.placeholder = "Search title, organization, category";
    q.value = filters.q || "";
    form.append(q);
    const status = el("select");
    status.name = "status";
    status.append(new Option("All statuses", ""));
    STATUSES.forEach((s) => status.append(new Option(s, s)));
    status.value = filters.status || "";
    form.append(status);
    const category = el("input");
    category.name = "category";
    category.placeholder = "Category";
    category.value = filters.category || "";
    form.append(category);
    if (["ADMIN", "SUPER_ADMIN"].includes(state.user.role)) {
      const source = el("input");
      source.name = "source";
      source.placeholder = "Source";
      source.value = filters.source || "";
      form.append(source);
    }
    const apply = el("button", "admin-button", "Search");
    apply.type = "submit";
    form.append(apply);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      renderJobs(1, Object.fromEntries(new FormData(form)));
    });
    if (active !== "review") content.append(form);
    try {
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(state.user.role);
      const query = params({ ...filters, page, limit: 20 });
      const path =
        active === "review"
          ? `/admin/jobs/pending?${params({ page, limit: 20 })}`
          : isAdmin
            ? `/admin/jobs?${query}`
            : `/jobs/mine?${query}`;
      const { data, pagination } = await api(path);
      content.append(
        data.length
          ? table(
              [
                "Job Title",
                "Organization",
                "Board",
                "Category",
                "Status",
                "Application Deadline",
                "Source",
                "Created",
                "Actions",
              ],
              data.map((job) => jobRow(job)),
            )
          : empty("No jobs match these filters."),
      );
      content.append(
        paginationBar(pagination, (number) => renderJobs(number, filters)),
      );
      if (active === "review") await renderPendingDiscoveries(content);
    } catch (error) {
      content.append(
        notice(
          error.status === 403
            ? "You do not have permission to view these jobs."
            : error.message,
          "is-error",
        ),
      );
    }
  }
  async function renderPendingDiscoveries(content) {
    const section = el("section", "admin-subsection");
    section.append(
      el("h2", "", "Automatically discovered jobs awaiting review"),
    );
    try {
      const { data } = await api(
        `/admin/discoveries?${params({ status: "PENDING_REVIEW", page: 1, limit: 20 })}`,
      );
      if (!data.length)
        section.append(empty("No discovered jobs are awaiting review."));
      else {
        const rows = data.map((item) => {
          const tr = el("tr");
          tr.append(
            el("td", "", item.rawTitle || item.extractedData?.title || "—"),
            el(
              "td",
              "",
              item.extractedData?.organization ||
                item.source?.organization ||
                "—",
            ),
            el("td", "", item.source?.name || "—"),
            el("td", "", item.sourceUrl || "—"),
            el("td", "", formatDate(item.discoveredAt)),
            el("td", "", item.processingStatus),
          );
          const td = el("td");
          td.append(
            button("View", () => openDiscovery(item._id)),
            button("Promote to review", () => promote(item), "is-primary"),
          );
          tr.append(td);
          return tr;
        });
        section.append(
          table(
            [
              "Title",
              "Organization",
              "Source",
              "Source URL",
              "Discovered",
              "Review status",
              "Actions",
            ],
            rows,
          ),
        );
      }
    } catch (error) {
      section.append(notice(error.message, "is-error"));
    }
    content.append(section);
  }
  function viewDiscovery(item) {
    const dialog = el("dialog", "admin-dialog");
    dialog.append(
      button("Close", () => dialog.close()),
      el("h2", "", item.rawTitle || "Discovery details"),
    );
    const fields = [
      ["Source", item.source?.name],
      ["Source URL", item.sourceUrl],
      ["Discovered", formatDate(item.discoveredAt)],
      ["Duplicate / review status", item.processingStatus],
      ["Matched job", item.matchedJob?.title],
      ["Last processing error", item.error],
      ["Raw source content", item.rawContent],
      ["Extracted fields", JSON.stringify(item.extractedData || {}, null, 2)],
      [
        "Processing history",
        (item.processingHistory || [])
          .map(
            (entry) =>
              `${entry.status} · ${formatDate(entry.at)}${entry.note ? ` · ${entry.note}` : ""}`,
          )
          .join("\n"),
      ],
    ];
    const dl = el("dl", "admin-detail-list");
    fields.forEach(([k, v]) => {
      if (v) {
        dl.append(el("dt", "", k), el("dd", "", String(v)));
      }
    });
    dialog.append(dl);
    root.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
  }
  async function openDiscovery(id) {
    try {
      const { data } = await api(`/admin/discoveries/${id}`);
      viewDiscovery(data);
    } catch (error) {
      showError(error);
    }
  }
  async function associateDiscovery(item, resolution = "MATCHED") {
    try {
      const { data: jobs } = await api(`/admin/jobs?page=1&limit=100`);
      if (!jobs.length) {
        showError(
          new Error("Create or find a job before associating this discovery."),
        );
        return;
      }
      const dialog = el("dialog", "admin-dialog"),
        form = el("form", "admin-job-form"),
        label = el("label", "admin-field");
      label.append(
        el(
          "span",
          "",
          resolution === "DUPLICATE" ? "Matching job" : "Associate with job",
        ),
      );
      const select = el("select");
      jobs.forEach((job) =>
        select.append(
          new Option(
            `${job.title} · ${job.organization} · ${job.status}`,
            job._id,
          ),
        ),
      );
      label.append(select);
      form.append(label);
      const feedback = el("div", "admin-form-feedback"),
        save = el(
          "button",
          "admin-button is-primary",
          resolution === "DUPLICATE" ? "Confirm duplicate" : "Associate job",
        );
      save.type = "submit";
      form.append(
        save,
        button("Cancel", () => dialog.close()),
        feedback,
      );
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const path =
            resolution === "DUPLICATE"
              ? `/admin/discoveries/${item._id}/resolve`
              : `/admin/discoveries/${item._id}/associate`;
          const body =
            resolution === "DUPLICATE"
              ? { resolution, matchedJob: select.value }
              : { jobId: select.value };
          await api(path, { method: "POST", body: JSON.stringify(body) });
          dialog.close();
          renderDiscoveries();
        } catch (error) {
          feedback.replaceChildren(notice(error.message, "is-error"));
        }
      });
      dialog.append(form);
      root.append(dialog);
      dialog.showModal();
      dialog.addEventListener("close", () => dialog.remove(), { once: true });
    } catch (error) {
      showError(error);
    }
  }
  async function resolveDiscovery(item, resolution) {
    if (resolution === "DUPLICATE" && !item.matchedJob?._id)
      return associateDiscovery(item, "DUPLICATE");
    const message =
      resolution === "DUPLICATE"
        ? "Confirm this record duplicates the linked job? Its discovery history will be retained."
        : "Clear duplicate status and return this discovery to pending human review? It will not be published.";
    if (!window.confirm(message)) return;
    try {
      await api(`/admin/discoveries/${item._id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          resolution,
          ...(resolution === "DUPLICATE"
            ? { matchedJob: item.matchedJob._id }
            : {}),
        }),
      });
      renderDiscoveries();
    } catch (error) {
      showError(error);
    }
  }
  async function retryDiscovery(item) {
    if (
      !window.confirm(
        "Retry this failed source through its active verified adapter? Discovered jobs remain unpublished.",
      )
    )
      return;
    try {
      await api(`/admin/discoveries/${item._id}/retry`, { method: "POST" });
      const target = root.querySelector(".admin-content");
      target?.prepend(
        notice(
          "Source reprocessing started; human review is still required.",
          "is-success",
        ),
      );
    } catch (error) {
      showError(error);
    }
  }
  async function promote(item) {
    if (
      !window.confirm(
        "Create a pending-review job from this discovery? It will not be published.",
      )
    )
      return;
    try {
      const { data } = await api(`/admin/discoveries/${item._id}/promote`, {
        method: "POST",
      });
      await renderJobs(1, {});
      const target = root.querySelector(".admin-content");
      if (target)
        target.prepend(
          notice(`Added to pending review: ${data.title}`, "is-success"),
        );
    } catch (error) {
      showError(error);
    }
  }
  async function renderDiscoveries() {
    const content = shell("discovery");
    const heading = el("div", "admin-page-heading");
    heading.append(el("h1", "", "Job Discovery"));
    content.append(heading);
    const meta = el(
      "p",
      "admin-muted",
      "Stored discovery records only. Promoting a record creates a PENDING_REVIEW job; publishing always requires a separate action.",
    );
    content.append(meta);
    try {
      const { data, pagination } = await api(
        `/admin/discoveries?${params({ status: "ALL", page: state.page, limit: 20 })}`,
      );
      const rows = data.map((item) => {
        const tr = el("tr");
        tr.append(
          el("td", "", item.rawTitle || item.extractedData?.title || "—"),
          el(
            "td",
            "",
            item.extractedData?.organization ||
              item.source?.organization ||
              "—",
          ),
          el("td", "", item.source?.name || "—"),
          el("td", "", formatDate(item.discoveredAt)),
          el(
            "td",
            "",
            item.processingStatus === "DUPLICATE"
              ? "Duplicate"
              : "Not marked duplicate",
          ),
          el("td", "", item.processingStatus),
        );
        const td = el("td", "");
        td.append(button("View", () => openDiscovery(item._id)));
        if (item.processingStatus !== "MATCHED")
          td.append(button("Associate job", () => associateDiscovery(item)));
        if (item.processingStatus === "DUPLICATE")
          td.append(
            button("Clear duplicate", () =>
              resolveDiscovery(item, "PENDING_REVIEW"),
            ),
          );
        if (
          ["DUPLICATE", "DISCOVERED", "PENDING_REVIEW", "ERROR"].includes(
            item.processingStatus,
          )
        )
          td.append(
            button("Mark duplicate", () => resolveDiscovery(item, "DUPLICATE")),
          );
        if (item.processingStatus === "ERROR")
          td.append(button("Retry", () => retryDiscovery(item)));
        if (item.processingStatus === "PENDING_REVIEW")
          td.append(
            button("Promote to review", () => promote(item), "is-primary"),
          );
        tr.append(td);
        return tr;
      });
      content.append(
        data.length
          ? table(
              [
                "Title",
                "Organization",
                "Source",
                "Discovered At",
                "Duplicate Status",
                "Review Status",
                "Actions",
              ],
              rows,
            )
          : empty("No discovered jobs."),
      );
      content.append(
        paginationBar(pagination, (p) => {
          state.page = p;
          renderDiscoveries();
        }),
      );
    } catch (error) {
      content.append(
        notice(
          error.status === 403
            ? "You do not have permission to view job discoveries."
            : error.message,
          "is-error",
        ),
      );
    }
  }
  async function renderSources() {
    const content = shell("sources");
    const heading = el("div", "admin-page-heading");
    heading.append(
      el("h1", "", "Recruitment Sources"),
      button("Add source", () => openSourceEditor(), "is-primary"),
    );
    content.append(
      heading,
      el(
        "p",
        "admin-muted",
        "Manage approved source configuration. Fetching creates discovery records for human review; it never publishes a job.",
      ),
    );
    try {
      const { data } = await api("/admin/sources");
      const rows = data.map((source) => {
        const tr = el("tr");
        tr.append(
          el("td", "", source.name),
          el("td", "", source.organization || "—"),
          el("td", "", source.sourceType),
          el("td", "", source.websiteUrl || "—"),
          el("td", "", source.active ? "Active" : "Inactive"),
          el("td", "", formatDate(source.lastFetchedAt)),
          el("td", "", formatDate(source.lastSuccessAt)),
          el("td", "", source.lastError || "—"),
        );
        const actions = el("td");
        actions.append(
          button("Edit", () => openSourceEditor(source)),
          button(source.active ? "Deactivate" : "Activate", async () => {
            try {
              await api(`/admin/sources/${source._id}`, {
                method: "PATCH",
                body: JSON.stringify({ active: !source.active }),
              });
              renderSources();
            } catch (error) {
              showError(error);
            }
          }),
          button("Fetch now", async () => {
            if (
              !window.confirm(
                `Fetch source ${source.name}? Discovered jobs remain unpublished.`,
              )
            )
              return;
            try {
              await api(`/admin/sources/${source._id}/fetch`, {
                method: "POST",
              });
              notice("Source fetch started.", "is-success");
            } catch (error) {
              showError(error);
            }
          }),
        );
        tr.append(actions);
        return tr;
      });
      content.append(
        data.length
          ? table(
              [
                "Name",
                "Organization",
                "Source Type",
                "URL",
                "Status",
                "Last Checked",
                "Last Success",
                "Last Error",
                "Actions",
              ],
              rows,
            )
          : empty("No recruitment sources configured."),
      );
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  function openSourceEditor(item = {}) {
    const dialog = el("dialog", "admin-dialog"),
      form = el("form", "admin-job-form");
    field(form, "Name", "name", "text", item.name || "", { required: true });
    field(
      form,
      "Organization",
      "organization",
      "text",
      item.organization || "",
    );
    field(
      form,
      "Official website (HTTPS)",
      "websiteUrl",
      "url",
      item.websiteUrl || "",
    );
    field(
      form,
      "Fetch interval (hours)",
      "fetchInterval",
      "number",
      item.fetchInterval || 24,
      { min: 1, max: 168 },
    );
    const typeLabel = el("label", "admin-field");
    typeLabel.append(el("span", "", "Source type"));
    const type = el("select");
    type.name = "sourceType";
    ["MANUAL", "API", "RSS", "STATIC_HTML", "JAVASCRIPT_SITE", "PDF"].forEach(
      (x) => type.append(new Option(x, x)),
    );
    type.value = item.sourceType || "MANUAL";
    typeLabel.append(type);
    form.append(typeLabel);
    const official = el("input");
    official.type = "checkbox";
    official.checked = Boolean(item.isOfficial);
    const officialLabel = el("label", "admin-field");
    officialLabel.append(el("span", "", "Verified official source"), official);
    form.append(officialLabel);
    if (state.user.role !== "SUPER_ADMIN") officialLabel.hidden = true;
    const feedback = el("div", "admin-form-feedback"),
      save = el("button", "admin-button is-primary", "Save source");
    save.type = "submit";
    form.append(
      save,
      button("Cancel", () => dialog.close()),
      feedback,
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const body = {
        name: values.name,
        organization: values.organization,
        websiteUrl: values.websiteUrl || undefined,
        fetchInterval: Number(values.fetchInterval || 24),
        sourceType: values.sourceType,
        ...(state.user.role === "SUPER_ADMIN"
          ? { isOfficial: official.checked }
          : {}),
      };
      try {
        await api(item._id ? `/admin/sources/${item._id}` : "/admin/sources", {
          method: item._id ? "PATCH" : "POST",
          body: JSON.stringify(body),
        });
        dialog.close();
        renderSources();
      } catch (error) {
        feedback.replaceChildren(notice(error.message, "is-error"));
      }
    });
    dialog.append(form);
    root.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
  }
  function field(form, label, name, type = "text", value = "", attrs = {}) {
    const wrap = el("label", "admin-field");
    wrap.append(el("span", "", label));
    let input;
    if (type === "textarea") {
      input = el("textarea");
      input.rows = attrs.rows || 3;
    } else input = el("input");
    input.name = name;
    input.type = type === "textarea" ? "text" : type;
    if (value !== undefined && value !== null) input.value = value;
    if (attrs.required) input.required = true;
    if (attrs.min !== undefined) input.min = attrs.min;
    if (attrs.max !== undefined) input.max = attrs.max;
    if (attrs.step) input.step = attrs.step;
    if (attrs.placeholder) input.placeholder = attrs.placeholder;
    wrap.append(input);
    form.append(wrap);
    return input;
  }
  function addJobTranslationField(parent, label, locale, path, value = "", type = "textarea", sourcePath = path) {
    const wrap = el("label", "admin-field admin-translation-field");
    wrap.append(el("span", "", `${label} · ${locale === "hi" ? "Hindi (hi)" : "Bengali (bn)"}`));
    const input = type === "textarea" ? el("textarea") : el("input");
    if (type === "textarea") input.rows = 3;
    input.type = type === "textarea" ? "text" : type;
    input.value = value == null ? "" : String(value);
    input.dataset.contentTranslation = path;
    input.dataset.translationLocale = locale;
    input.dataset.translationSource = sourcePath;
    wrap.append(input);
    parent.append(wrap);
    return input;
  }
  function addJobTranslationsSection(form, job = {}) {
    const section = el("section", "admin-repeater admin-job-translations");
    section.dataset.translationEditor = "";
    section.append(
      el("h2", "", "Optional Hindi and Bengali translations"),
      el("p", "admin-muted", "English remains the canonical source. Translate explanatory text only; keep names, official terms, dates, numbers, fees, and other recruitment facts unchanged. Rich article content is not translated in this phase."),
    );
    const fields = [
      ["description", "Job description", "textarea", "description"],
      ["qualification", "Qualification / eligibility prose", "textarea", "qualification"],
      ["ageRelaxation", "Age-relaxation explanation", "textarea", "ageRelaxation"],
      ["ageDescription", "Age-limit explanation", "textarea", "ageDescription"],
      ["salaryInfo.description", "Salary explanation", "textarea", "salaryDescription"],
    ];
    for (const [locale, language] of [["hi", "Hindi (hi)"], ["bn", "Bengali (bn)"]]) {
      const group = el("div", "admin-translation-language");
      group.append(el("h3", "", language));
      for (const [path, label, type] of fields) {
        const value = path === "selectionProcess"
          ? (job.contentTranslations?.[locale]?.selectionProcess || []).join("\n")
          : path === "salaryInfo.description"
            ? job.contentTranslations?.[locale]?.salaryInfo?.description
            : job.contentTranslations?.[locale]?.[path];
        addJobTranslationField(group, label, locale, path, value || "", type, fields.find(item => item[0] === path)?.[3]);
      }
      section.append(group);
    }
    form.append(section);
    return section;
  }
  function withContentTranslationRows(items, job, path, map = value => value || {}) {
    const sourceItems = items || [];
    return sourceItems.map((item, index) => {
      const translationId = item.translationId || (path === "selectionProcess"
        ? job.selectionProcessTranslationIds?.[index]
        : path === "howToApplySteps"
          ? job.howToApplyStepTranslationIds?.[index]
          : undefined) || newTranslationId();
      return {
        ...item,
        translationId,
        _contentTranslations: Object.fromEntries(["hi", "bn"].map(locale => {
          const rows = job.contentTranslations?.[locale]?.[path] || [];
          const match = rows.find?.(row => row && typeof row === "object" && row.translationId === translationId);
          const previous = match || rows[index];
          return [locale, map(previous)];
        })),
      };
    });
  }
  function multi(form, label, name, options, selected = [], requiredType) {
    const wrap = el("label", "admin-field");
    wrap.append(el("span", "", label));
    const select = el("select");
    select.name = name;
    select.multiple = true;
    const filtered = requiredType
      ? options.filter((item) => item.type === requiredType)
      : options;
    select.size = Math.min(5, Math.max(filtered.length, 2));
    const selectedIds = selected.map((item) => String(item?._id || item));
    filtered.forEach((item) => {
      const opt = new Option(`${item.title} · ${item.type}`, item._id);
      opt.selected = selectedIds.includes(String(item._id));
      select.append(opt);
    });
    wrap.append(select);
    form.append(wrap);
    return select;
  }
  const splitList = (value) =>
    String(value || "")
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);
  const jobFieldLabels = {
    title: "Title",
    organization: "Organization",
    board: "Board",
    category: "Category",
    tags: "Tags",
    description: "Description",
    vacancyCount: "Vacancy count",
    applicationStartDate: "Application start",
    applicationDeadline: "Application deadline",
    examDate: "Exam date",
    qualification: "Qualification",
    ageMin: "Minimum age",
    ageMax: "Maximum age",
    ageRelaxation: "Age relaxation",
    location: "Location",
    salary: "Salary",
    selectionProcess: "Selection process",
    applicationFee: "Application fee",
    categoryEligibility: "Category eligibility",
    genderEligibility: "Gender eligibility",
    officialWebsite: "Official website",
    officialNotificationUrl: "Official notification URL",
    officialApplyUrl: "Official apply URL",
    howToApplyYoutubeUrl: "How to Apply YouTube URL",
    syllabusResources: "Syllabus resources",
    pyqResources: "Previous papers",
    mockTestResources: "Mock tests",
    studyResources: "Study materials",
    otherResources: "Other resources",
    importantDates: "Important Dates",
    vacancyBreakdown: "Vacancy Breakdown",
    ageCutoffDate: "Age cutoff date",
    ageDescription: "Age description",
    ageRelaxations: "Age Relaxation",
    applicationFees: "Application Fees",
    qualifications: "Qualifications",
    selectionStages: "Selection Process",
    salaryInfo: "Salary",
    howToApplySteps: "How to Apply",
    importantLinks: "Important Links",
    contentBlocks: "Additional Information",
    documentsRequired: "Documents Required",
    importantInstructions: "Important Instructions",
    posts: "Posts / Positions",
    postGroups: "Post Groups",
  };
  function validationMessage(error) {
    const issues = error.details?.issues;
    if (Array.isArray(issues) && issues.length) {
      return issues.map(({ path, message }) => `${Array.isArray(path) && path.length ? path.join(".") : "Request"}: ${message}`).join(" · ");
    }
    const fields = error.details?.fieldErrors;
    if (!fields || typeof fields !== "object") return error.message;
    const lines = Object.entries(fields).flatMap(([key, messages]) =>
      (Array.isArray(messages) ? messages : []).map(
        (message) => `${jobFieldLabels[key] || "Request"}: ${message}`,
      ),
    );
    return (
      [...(error.details.formErrors || []), ...lines].join(" · ") ||
      error.message
    );
  }
  function toInputDate(value) {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? ""
      : new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 10);
  }
  const documentNodeTags = new Set([
    "P",
    "H1",
    "H2",
    "H3",
    "UL",
    "OL",
    "LI",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TH",
    "TD",
    "BLOCKQUOTE",
    "HR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "S",
    "STRIKE",
    "A",
    "SPAN",
    "DIV",
    "BR",
  ]);
  function addDocumentEditor(form, initial = [], onError = () => {}, initialTranslations = {}) {
    const contentTranslationMaps = Object.fromEntries(["hi", "bn"].map((locale) => [
      locale, Object.fromEntries(Object.entries(initialTranslations?.[locale]?.contentDocument || {})),
    ]));
    const section = el("section", "admin-repeater admin-document-editor");
    section.dataset.jobDocument = "";
    section.append(el("h2", "", "Content"));
    const toolbar = el("div", "document-toolbar");
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Document formatting");
    toolbar.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) event.preventDefault();
    });
    const editor = el("div", "document-canvas");
    editor.contentEditable = "true";
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.setAttribute("aria-label", "Job article content");
    editor.dataset.documentCanvas = "";
    function dom(nodes) {
      return (nodes || [])
        .map((item) => {
          if (
            !item ||
            !documentNodeTags.has(String(item.type || "").toUpperCase())
          )
            return null;
          const tag =
            String(item.type).toUpperCase() === "B"
              ? "STRONG"
              : String(item.type).toUpperCase() === "I"
                ? "EM"
                : String(item.type).toUpperCase() === "STRIKE"
                  ? "S"
                  : String(item.type).toUpperCase();
          const node = document.createElement(tag.toLowerCase());
          if (item.text) node.textContent = item.text;
          if (item.translationKey) node.dataset.translationKey = item.translationKey;
          if (item.attrs?.id) node.id = item.attrs.id;
          if (item.attrs?.href) node.href = item.attrs.href;
          (item.content || []).forEach((child) => {
            const n = dom([child])[0];
            if (n) node.append(n);
          });
          return node;
        })
        .filter(Boolean);
    }
    editor.append(...dom(initial));
    if (!editor.childNodes.length) {
      const p = document.createElement("p");
      p.append(document.createElement("br"));
      editor.append(p);
    }
    const toc = el("nav", "job-document-toc");
    toc.setAttribute("aria-label", "Table of contents");
    const updateToc = () => {
      const used = new Set();
      const entries = [...editor.querySelectorAll("h1,h2,h3")]
        .map((heading) => {
          const title = heading.textContent.trim();
          const slug =
            title
              .toLowerCase()
              .normalize("NFKD")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 60) || "section";
          let id = /^heading-[a-z0-9-]{1,80}$/.test(heading.id)
            ? heading.id
            : `heading-${slug}`;
          const base = id;
          let suffix = 2;
          while (used.has(id)) id = `${base}-${suffix++}`;
          used.add(id);
          heading.id = id;
          return { id, title, level: Number(heading.tagName[1]) };
        })
        .filter((item) => item.title);
      toc.replaceChildren();
      if (!entries.length) {
        toc.hidden = true;
        return;
      }
      toc.hidden = false;
      toc.append(el("h3", "", "Table of Contents"));
      const list = el("ul");
      entries.forEach(({ id, title, level }) => {
        const item = el("li");
        item.style.marginInlineStart = `${Math.max(0, level - 1) * 1.25}rem`;
        const link = el("a", "", title);
        link.href = `#${id}`;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          editor.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
        item.append(link);
        list.append(item);
      });
      toc.append(list);
    };
    section.loadDocument = (nodes, translations = {}) => {
      editor.replaceChildren(...dom(nodes));
      for (const locale of ["hi", "bn"])
        contentTranslationMaps[locale] = Object.fromEntries(Object.entries(translations?.[locale]?.contentDocument || {}));
      if (!editor.childNodes.length) {
        const p = document.createElement("p");
        p.append(document.createElement("br"));
        editor.append(p);
      }
      savedRange = null;
      updateToc();
      refreshTranslationRows();
      editor.dataset.empty = String(
        !editor.textContent.trim() && !editor.querySelector("table,ul,ol,hr"),
      );
    };
    editor.addEventListener("input", updateToc);
    updateToc();
    editor.dataset.empty = String(
      !editor.textContent.trim() && !editor.querySelector("table,ul,ol,hr"),
    );
    editor.addEventListener("input", () => {
      editor.dataset.empty = String(
        !editor.textContent.trim() && !editor.querySelector("table,ul,ol,hr"),
      );
    });
    const toolGlyphs = {
      Paragraph: "¶",
      H1: "H1",
      H2: "H2",
      H3: "H3",
      Bold: "B",
      Italic: "I",
      Underline: "U",
      Strike: "S̶",
      Bullets: "•",
      Numbered: "1.",
      Quote: "❝",
      "Align left": "≡",
      "Align center": "☰",
      "Align right": "≡",
      Undo: "↶",
      Redo: "↷",
      "Clear format": "Tx",
      Link: "🔗",
      "Remove link": "⛓̸",
      Divider: "―",
      "Insert table": "▦",
      "+ Row": "+R",
      "− Row": "−R",
      "+ Column": "+C",
      "− Column": "−C",
    };
    let savedRange = null;
    const rememberSelection = () => {
      const selection = getSelection();
      if (
        selection?.rangeCount &&
        (selection.anchorNode === editor ||
          editor.contains(selection.anchorNode))
      )
        savedRange = selection.getRangeAt(0).cloneRange();
    };
    ["keyup", "mouseup", "input", "focusout"].forEach((eventName) =>
      editor.addEventListener(eventName, rememberSelection),
    );
    const toolButton = (label, action) => {
      const b = button(
        toolGlyphs[label] || label,
        () => {
          editor.focus();
          if (savedRange) {
            const selection = getSelection();
            selection.removeAllRanges();
            selection.addRange(savedRange);
          }
          action();
          rememberSelection();
        },
        "document-tool",
      );
      b.title = label;
      b.setAttribute("aria-label", label);
      return b;
    };
    const translationPanel = el("section", "document-translation-panel");
    translationPanel.append(
      el("h3", "", "Optional translations"),
      el("p", "admin-muted", "English remains the source. Mark explanatory text only; do not translate factual values, codes, dates, amounts, or URLs."),
    );
    const translationRows = el("div", "document-translation-rows");
    translationPanel.append(translationRows);
    const refreshTranslationRows = () => {
      const active = [...editor.querySelectorAll("span[data-translation-key]")];
      const liveKeys = new Set(active.map((node) => node.dataset.translationKey));
      for (const locale of ["hi", "bn"])
        for (const key of Object.keys(contentTranslationMaps[locale]))
          if (!liveKeys.has(key)) delete contentTranslationMaps[locale][key];
      translationRows.replaceChildren();
      if (!active.length) {
        translationRows.append(el("p", "admin-muted", "Select explanatory text in the article and choose Enable translations."));
        return;
      }
      active.forEach((node, index) => {
        const key = node.dataset.translationKey;
        const row = el("fieldset", "document-translation-row");
        row.append(el("legend", "", `Translatable text ${index + 1}`));
        row.append(el("strong", "", "English source (canonical)"), el("p", "document-translation-source", node.textContent || "(empty source text)"));
        for (const [locale, label] of [["hi", "Hindi Translation (optional)"], ["bn", "Bengali Translation (optional)"]]) {
          const field = el("label", "document-translation-field");
          field.append(el("span", "", label));
          const input = el("textarea");
          input.rows = 2;
          input.maxLength = 20000;
          input.value = contentTranslationMaps[locale][key] || "";
          input.addEventListener("input", () => {
            const value = input.value.trim();
            if (value) contentTranslationMaps[locale][key] = value;
            else delete contentTranslationMaps[locale][key];
          });
          field.append(input);
          row.append(field);
        }
        row.append(button("Remove translation mark", () => {
          delete node.dataset.translationKey;
          for (const locale of ["hi", "bn"]) delete contentTranslationMaps[locale][key];
          refreshTranslationRows();
        }, "is-secondary"));
        translationRows.append(row);
      });
    };
    const enableTranslations = toolButton("Enable translations", () => {
      const selection = getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) {
        onError("Select one explanatory text run in the article first.");
        return;
      }
      const range = selection.getRangeAt(0);
      if (range.startContainer !== range.endContainer || range.startContainer.nodeType !== Node.TEXT_NODE) {
        onError("Select text within one run. Split prose and factual values into separate runs first.");
        return;
      }
      const selectedText = range.toString().trim();
      if (/^(?:https?:\/\/|www\.)/i.test(selectedText) || /^(?:[₹$€£]?\s*\d[\d,.]*\s*(?:%|years?|marks?)?|\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})$/i.test(selectedText) || (/\d/.test(selectedText) && /^[A-Z0-9]+(?:[-_/][A-Z0-9]+)*$/.test(selectedText))) {
        onError("This looks like a URL, date, amount, percentage, count, or code. Keep protected factual values in English.");
        return;
      }
      if (range.startContainer.parentElement?.closest("[data-translation-key]")) {
        onError("This text run already has translations enabled.");
        return;
      }
      const marked = document.createElement("span");
      marked.dataset.translationKey = window.crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
        const random = Math.random() * 16 | 0;
        return (character === "x" ? random : (random & 3) | 8).toString(16);
      });
      try { range.surroundContents(marked); }
      catch { onError("Select a single text run to enable translations."); return; }
      selection.removeAllRanges();
      savedRange = null;
      refreshTranslationRows();
    });
    enableTranslations.type = "button";
    toolbar.append(enableTranslations);
    const command = (label, cmd, value) => {
      const b = toolButton(label, () => {
        editor.focus();
        document.execCommand(cmd, false, value || null);
      });
      b.type = "button";
      toolbar.append(b);
    };
    [
      ["Paragraph", "formatBlock", "P"],
      ["H1", "formatBlock", "H1"],
      ["H2", "formatBlock", "H2"],
      ["H3", "formatBlock", "H3"],
    ].forEach(([label, cmd, value]) => command(label, cmd, value));
    [
      ["Bold", "bold"],
      ["Italic", "italic"],
      ["Underline", "underline"],
      ["Strike", "strikeThrough"],
      ["Bullets", "insertUnorderedList"],
      ["Numbered", "insertOrderedList"],
      ["Quote", "formatBlock", "BLOCKQUOTE"],
      ["Align left", "justifyLeft"],
      ["Align center", "justifyCenter"],
      ["Align right", "justifyRight"],
      ["Undo", "undo"],
      ["Redo", "redo"],
      ["Clear format", "removeFormat"],
    ].forEach(([label, cmd, value]) => command(label, cmd, value));
    const link = toolButton("Link", () => {
      const url = prompt("Link URL (https:// or http://)");
      if (!url) return;
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw Error();
        editor.focus();
        if (!window.getSelection()?.toString()) {
          const text = prompt("Link text");
          if (!text) return;
          document.execCommand("insertText", false, text);
        }
        document.execCommand("createLink", false, parsed.href);
      } catch {
        onError("Enter a valid HTTP or HTTPS URL.");
      }
    });
    toolbar.append(link);
    command("Remove link", "unlink");
    const hr = toolButton("Divider", () => {
      editor.focus();
      document.execCommand("insertHorizontalRule");
    });
    toolbar.append(hr);
    const table = toolButton("Insert table", () => {
      const rowValue = prompt("Initial rows", "3");
      if (rowValue === null) return;
      const colValue = prompt("Initial columns", "2");
      if (colValue === null) return;
      const rows = Math.min(30, Math.max(1, Number(rowValue) || 0)),
        cols = Math.min(12, Math.max(1, Number(colValue) || 0));
      if (!rows || !cols) return;
      const t = document.createElement("table"),
        body = document.createElement("tbody");
      for (let r = 0; r < rows; r++) {
        const tr = document.createElement("tr");
        for (let c = 0; c < cols; c++) {
          const cell = document.createElement(r === 0 ? "th" : "td");
          cell.append(document.createElement("br"));
          tr.append(cell);
        }
        body.append(tr);
      }
      t.append(body);
      editor.focus();
      const sel = getSelection();
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(t);
        range.setStartAfter(t);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else editor.append(t);
    });
    toolbar.append(table);
    const tableAction = (label, action) =>
      toolbar.append(
        toolButton(label, () => {
          const cell =
              getSelection()?.anchorNode?.parentElement?.closest("td,th"),
            tr = cell?.closest("tr"),
            table = tr?.closest("table");
          if (!table) {
            onError("Place the cursor in a table cell first.");
            return;
          }
          action(table, tr, cell);
        }),
      );
    tableAction("+ Row", (t, tr) => {
      const row = tr.cloneNode(true);
      row
        .querySelectorAll("th,td")
        .forEach((cell) => cell.replaceChildren(document.createElement("br")));
      tr.after(row);
    });
    tableAction("− Row", (t, tr) => {
      if (t.querySelectorAll("tr").length > 1) tr.remove();
    });
    tableAction("+ Column", (t, tr, cell) => {
      const index = [...tr.children].indexOf(cell);
      t.querySelectorAll("tr").forEach((row) => {
        const td = document.createElement(
          row.children[index]?.tagName === "TH" ? "th" : "td",
        );
        td.append(document.createElement("br"));
        row.insertBefore(td, row.children[index + 1] || null);
      });
    });
    tableAction("− Column", (t, tr, cell) => {
      const index = [...tr.children].indexOf(cell);
      if (tr.children.length > 1)
        t.querySelectorAll("tr").forEach((row) =>
          row.children[index]?.remove(),
        );
    });
    section.append(
      toolbar,
      editor,
      translationPanel,
      toc,
      el(
        "p",
        "admin-muted",
        "Write the recruitment article as one document. Use headings to generate its clickable table of contents.",
      ),
    );
    refreshTranslationRows();
    editor.addEventListener("input", refreshTranslationRows);
    form.append(section);
    section.readTranslations = () => {
      const active = new Set([...editor.querySelectorAll("span[data-translation-key]")].map((node) => node.dataset.translationKey));
      const result = {};
      for (const locale of ["hi", "bn"]) {
        const contentDocument = Object.fromEntries(Object.entries(contentTranslationMaps[locale]).filter(([key, value]) => active.has(key) && value.trim()));
        const hadStoredMap = Object.prototype.hasOwnProperty.call(initialTranslations?.[locale] || {}, "contentDocument");
        if (Object.keys(contentDocument).length || hadStoredMap) result[locale] = { contentDocument };
      }
      return Object.keys(result).length ? result : null;
    };
    return section;
  }
  function legacyDocument(job) {
    const blocks = job.contentSections?.length
      ? job.contentSections.flatMap((section) => [
          { type: "h2", text: section.title || "Additional Information" },
          ...(section.blocks || []),
        ])
      : job.contentBlocks || [];
    return blocks
      .map((block, index) => {
        const data = block.data || {};
        if (block.type === "heading")
          return {
            type: "h2",
            attrs: { id: `heading-legacy-${index}` },
            content: [{ type: "span", text: data.text || "" }],
          };
        if (block.type === "paragraph" || block.type === "callout")
          return {
            type: "p",
            content: [{ type: "span", text: data.text || "" }],
          };
        if (["bulletList", "numberedList", "steps"].includes(block.type))
          return {
            type: block.type === "bulletList" ? "ul" : "ol",
            content: (data.items || []).map((text) => ({
              type: "li",
              content: [{ type: "span", text }],
            })),
          };
        if (block.type === "divider") return { type: "hr" };
        if (["link", "externalLink", "youtube"].includes(block.type))
          return {
            type: "p",
            content: [
              {
                type: "a",
                attrs: { href: data.url },
                content: [
                  {
                    type: "span",
                    text: data.label || data.caption || "Open link",
                  },
                ],
              },
            ],
          };
        if (block.type === "table")
          return {
            type: "table",
            content: [
              {
                type: "tbody",
                content: [
                  ...(data.headers?.length
                    ? [
                        {
                          type: "tr",
                          content: data.headers.map((text) => ({
                            type: "th",
                            content: [{ type: "span", text }],
                          })),
                        },
                      ]
                    : []),
                  ...(data.rows || []).map((row) => ({
                    type: "tr",
                    content: row.map((text) => ({
                      type: "td",
                      content: [{ type: "span", text }],
                    })),
                  })),
                ],
              },
            ],
          };
        return null;
      })
      .filter(Boolean);
  }
  function readDocument(section) {
    const root = section.querySelector("[data-document-canvas]"),
      allowed = new Set([
        "P",
        "H1",
        "H2",
        "H3",
        "UL",
        "OL",
        "LI",
        "TABLE",
        "THEAD",
        "TBODY",
        "TR",
        "TH",
        "TD",
        "BLOCKQUOTE",
        "HR",
        "STRONG",
        "B",
        "EM",
        "I",
        "U",
        "S",
        "STRIKE",
        "A",
        "SPAN",
        "DIV",
        "BR",
      ]);
    let count = 0;
    const convert = (node) => {
      if (++count > 2000)
        throw Error("Document is too large (maximum 2,000 content nodes).");
      if (node.nodeType === 3)
        return node.nodeValue ? { type: "span", text: node.nodeValue } : null;
      if (node.nodeType !== 1) return null;
      let tag = node.tagName;
      if (!allowed.has(tag))
        return [...node.childNodes].map(convert).filter(Boolean);
      tag = { B: "STRONG", I: "EM", STRIKE: "S", DIV: "P" }[tag] || tag;
      const attrs = {};
      if (/^H[1-3]$/.test(tag)) {
        if (!/^heading-[a-z0-9-]{1,80}$/.test(node.id || ""))
          node.id = `heading-${Math.random().toString(36).slice(2, 10)}`;
        attrs.id = node.id;
      }
      if (tag === "A") {
        let href;
        try {
          const url = new URL(node.getAttribute("href"));
          if (
            !["https:", "http:"].includes(url.protocol) ||
            url.username ||
            url.password
          )
            throw Error();
          href = url.href;
        } catch {
          throw Error("Links must use a valid HTTP or HTTPS URL.");
        }
        attrs.href = href;
      }
      if (
        ["P", "H1", "H2", "H3", "DIV", "TD", "TH"].includes(tag) &&
        ["left", "center", "right"].includes(node.style.textAlign)
      )
        attrs.align = node.style.textAlign;
      const out = { type: tag.toLowerCase() };
      if (tag === "SPAN" && node.dataset.translationKey) {
        out.translationKey = node.dataset.translationKey;
        out.text = node.textContent;
        if (Object.keys(attrs).length) out.attrs = attrs;
        return out;
      }
      const content = [...node.childNodes].flatMap((child) => {
        const val = convert(child);
        return Array.isArray(val) ? val : val ? [val] : [];
      });
      if (Object.keys(attrs).length) out.attrs = attrs;
      if (content.length) out.content = content;
      return out;
    };
    return [...root.childNodes]
      .filter(
        (node) =>
          !(
            node.nodeType === 1 &&
            node.tagName === "P" &&
            !node.textContent.trim() &&
            !node.querySelector("table,ul,ol,hr")
          ),
      )
      .flatMap((node) => {
      const value = convert(node);
      return Array.isArray(value) ? value : value ? [value] : [];
      });
  }
  function addRepeater(form, title, key, fields, items = [], translationFields = []) {
    const section = el("section", "admin-repeater");
    section.dataset.repeater = key;
    section.append(el("h2", "", title));
    const rows = el("div", "admin-repeater-rows");
    section.append(rows);
    const makeRow = (item = {}, originalIndex = null) => {
      const row = el("div", "admin-repeat-row");
      row.dataset.repeatRow = "";
      if (Number.isInteger(originalIndex)) row.dataset.originalIndex = String(originalIndex);
      if (translationFields.length || key === "posts") {
        const translationIdInput = el("input");
        translationIdInput.type = "hidden";
        translationIdInput.dataset.repeatField = "translationId";
        translationIdInput.value = item.translationId || newTranslationId();
        row.append(translationIdInput);
      }
      if (key === "posts" && item._id) {
        const idInput = el("input");
        idInput.type = "hidden";
        idInput.dataset.repeatField = "_id";
        idInput.value = item._id;
        row.append(idInput);
      }
      fields.forEach(([name, label, type = "text"]) => {
        const wrap = el("label", "admin-field");
        wrap.append(el("span", "", label));
        let input;
        if (type === "textarea" || type === "lines") {
          input = el("textarea");
          input.rows = 2;
        } else input = el("input");
        input.type = type === "textarea" || type === "lines" ? "text" : type;
        input.dataset.repeatField = name;
        if (type === "lines") input.dataset.lines = "true";
        const value = item[name];
        input.value = Array.isArray(value)
          ? value.join("\n")
          : value == null
            ? ""
            : type === "date"
              ? String(value).slice(0, 10)
              : String(value);
        wrap.append(input);
        row.append(wrap);
      });
      if (translationFields.length) {
        const translations = el("details", "admin-repeat-translations");
        const translatedValue = item._contentTranslations || {};
        translations.append(el("summary", "", "Optional explanatory translations · Hindi / Bengali"));
        const translationGrid = el("div", "admin-repeat-translation-grid");
        for (const [locale, language] of [["hi", "Hindi (hi)"], ["bn", "Bengali (bn)"]]) {
          const languageGroup = el("div", "admin-repeat-translation-language");
          languageGroup.append(el("h4", "", language));
          for (const translation of translationFields) {
            const wrap = el("label", "admin-field");
            wrap.append(el("span", "", translation.label));
            const input = translation.type === "lines" || translation.type === "textarea" ? el("textarea") : el("input");
            if (input.tagName === "TEXTAREA") input.rows = translation.type === "lines" ? 2 : 3;
            input.type = input.tagName === "TEXTAREA" ? "text" : translation.type || "text";
            input.dataset.repeatTranslation = translation.key;
            input.dataset.translationLocale = locale;
            input.value = translatedValue[locale]?.[translation.key] || "";
            wrap.append(input);
            languageGroup.append(wrap);
          }
          translationGrid.append(languageGroup);
        }
        translations.append(translationGrid);
        row.append(translations);
        if (Object.values(translatedValue).some(values => Object.values(values || {}).some(value => String(value || "").trim())))
          translations.open = true;
      }
      if (key === "posts") {
        const fieldsWrap = el("div", "admin-post-fields");
        while (row.firstChild) fieldsWrap.append(row.firstChild);
        const details = el("details", "admin-post-card");
        details.open = !item.name;
        const summary = el("summary", "admin-post-summary");
        const summaryText = el("span", "", "New position");
        summary.append(summaryText);
        details.append(summary, fieldsWrap);
        row.append(details);
        const updateSummary = () => {
          const name =
            fieldsWrap
              .querySelector('[data-repeat-field="name"]')
              ?.value.trim() || "Position";
          const count = fieldsWrap.querySelector(
            '[data-repeat-field="vacancyCount"]',
          )?.value;
          const min = fieldsWrap.querySelector(
            '[data-repeat-field="ageMin"]',
          )?.value;
          const max = fieldsWrap.querySelector(
            '[data-repeat-field="ageMax"]',
          )?.value;
          summaryText.textContent = [
            name,
            count ? `${count} vacancies` : "",
            min || max ? `Age ${min || "Any"}–${max || "Any"}` : "",
          ]
            .filter(Boolean)
            .join(" · ");
        };
        fieldsWrap.addEventListener("input", updateSummary);
        updateSummary();
      }
      row.append(
        button("↑", () => {
          const previous = row.previousElementSibling;
          if (previous) rows.insertBefore(row, previous);
        }),
        button("↓", () => {
          const next = row.nextElementSibling;
          if (next) rows.insertBefore(next, row);
        }),
        ...(key === "posts"
          ? [
              button("Duplicate structure", () => {
                const copy = {};
                row.querySelectorAll("[data-repeat-field]").forEach((input) => {
                  copy[input.dataset.repeatField] = input.value;
                });
                delete copy._id;
                for (const factual of [
                  "name",
                  "code",
                  "vacancyCount",
                  "ageMin",
                  "ageMax",
                  "ageCutoffDate",
                  "ageDescription",
                  "qualifications",
                  "experienceRequirements",
                  "mandatoryCertifications",
                  "preferredCertifications",
                  "minimumMarks",
                  "salaryPayLevel",
                  "salaryPayScale",
                  "salaryDescription",
                  "selectionRequirements",
                  "additionalRequirements",
                  "postSpecificNotes",
                  "categoryVacancyBreakdown",
                ])
                  copy[factual] = "";
                makeRow(copy);
              }),
            ]
          : []),
        button("Remove", () => row.remove(), "is-danger"),
      );
      rows.append(row);
    };
    (items.length ? items : [{}]).forEach((item, index) => makeRow(item, index));
    section.append(button(`+ Add ${title.replace(/s$/, "")}`, () => makeRow()));
    form.append(section);
    section.addRow = makeRow;
    return section;
  }
  function organizeJobForm(form) {
    const definitions = [
      [
        "basic",
        "Basic Information",
        "Title, organization and where this recruitment belongs.",
      ],
      [
        "dates",
        "Important Dates",
        "Add only dates stated in the official notice.",
      ],
      ["vacancies", "Vacancies", "Overall vacancy count and breakdown."],
      [
        "eligibility",
        "Eligibility",
        "Recruitment wide age and qualification details.",
      ],
      [
        "posts",
        "Posts / Positions",
        "Add position specific details when the notice has multiple roles.",
      ],
      ["selection", "Selection Process", "Stages and selection information."],
      [
        "application",
        "Application",
        "Official links, fees and application steps.",
      ],
      [
        "additional",
        "Additional Information",
        "Optional structured details shown on the public notice.",
      ],
      ["translations", "Optional Translations", "Hindi and Bengali explanatory text. English remains canonical."],
      [
        "resources",
        "Resources",
        "Choose reusable syllabus, papers, mock tests or study material.",
      ],
    ];
    const sections = new Map();
    definitions.forEach(([key, title, description], index) => {
      const details = el("details", "form-section");
      details.dataset.editorSection = key;
      details.open = index === 0;
      const summary = el("summary", "section-header");
      summary.append(
        el("strong", "", title),
        el(
          "span",
          "section-description",
          key === "basic"
            ? `${description} Title and organization are required.`
            : description,
        ),
      );
      const state = el(
        "span",
        "section-state",
        index === 0 ? "Open" : "Optional",
      );
      summary.append(state);
      details.addEventListener("toggle", () => {
        if (details.open) state.textContent = "Open";
        else
          state.textContent =
            [...body.querySelectorAll("input,select,textarea")].some((input) =>
              input.type === "checkbox"
                ? input.checked
                : input.multiple
                  ? [...input.selectedOptions].length > 0
                  : Boolean(input.value.trim()),
            ) || body.querySelector(".admin-content-block")
              ? "Added"
              : "Optional";
      });
      const body = el("div", "section-content form-grid");
      body.addEventListener("input", () => {
        if (!details.open) state.textContent = "Added";
      });
      body.addEventListener("change", () => {
        if (!details.open) state.textContent = "Added";
      });
      details.append(summary, body);
      sections.set(key, { details, body });
    });
    const keyFor = (node) => {
      if (node.hasAttribute?.("data-translation-editor")) return "translations";
      const name = node.matches?.(".admin-field")
        ? node.querySelector("input,select,textarea")?.name
        : node.querySelector?.("[data-repeat-field]")?.dataset.repeatField;
      const rep = node.dataset?.repeater;
      if (node.hasAttribute?.("data-conditional-editor")) return "eligibility";
      if (
        [
          "title",
          "organization",
          "board",
          "category",
          "tags",
          "description",
          "location",
        ].includes(name)
      )
        return "basic";
      if (
        [
          "applicationStartDate",
          "applicationDeadline",
          "examDate",
          "importantDates",
        ].includes(name) ||
        rep === "importantDates"
      )
        return "dates";
      if (
        ["vacancyCount", "vacancyBreakdown"].includes(name) ||
        rep === "vacancyBreakdown"
      )
        return "vacancies";
      if (
        [
          "qualification",
          "ageMin",
          "ageMax",
          "ageRelaxation",
          "ageCutoffDate",
          "ageDescription",
          "qualifications",
          "ageRelaxations",
          "genderEligibility",
          "categoryEligibility",
        ].includes(name) ||
        ["qualifications", "ageRelaxations"].includes(rep)
      )
        return "eligibility";
      if (
        name === "postGroups" ||
        name === "posts" ||
        rep === "postGroups" ||
        rep === "posts"
      )
        return "posts";
      if (
        ["selectionProcess", "selectionStages"].includes(name) ||
        rep === "selectionStages"
      )
        return "selection";
      if (
        [
          "salary",
          "payLevel",
          "payScale",
          "gradePay",
          "salaryMinimum",
          "salaryMaximum",
          "salaryDescription",
          "applicationFee",
          "applicationFees",
          "officialWebsite",
          "officialNotificationUrl",
          "officialApplyUrl",
          "howToApplyYoutubeUrl",
          "howToApplySteps",
          "importantLinks",
          "documentsRequired",
        ].includes(name) ||
        [
          "applicationFees",
          "howToApplySteps",
          "importantLinks",
          "documentsRequired",
        ].includes(rep)
      )
        return "application";
      if (
        ["importantInstructions", "contentBlocks"].includes(name) ||
        ["importantInstructions"].includes(rep) ||
        node.hasAttribute?.("data-block-editor") ||
        node.classList?.contains("admin-preset-picker") ||
        node.textContent?.includes("Saved Section")
      )
        return "additional";
      if (
        [
          "syllabusResources",
          "pyqResources",
          "mockTestResources",
          "studyResources",
          "otherResources",
        ].includes(name)
      )
        return "resources";
      return null;
    };
    [...form.children].forEach((node) => {
      const key = keyFor(node);
      if (key) sections.get(key).body.append(node);
    });
    if (state.user.role === "AUTHOR") {
      const metadata = el("details", "admin-job-metadata");
      const summary = el("summary", "section-header", "Job metadata");
      summary.append(el("span", "section-description", "Structured fields used for search, eligibility, and job listings."));
      const body = el("div", "job-metadata-fields form-grid");
      for (const { details, body: group } of sections.values()) {
        while (group.firstChild) body.append(group.firstChild);
        details.remove();
      }
      const documentEditor = form.querySelector("[data-job-document]");
      [...form.children].forEach((node) => {
        if (node !== documentEditor) body.append(node);
      });
      metadata.append(summary, body);
      metadata.open = false;
      form.prepend(metadata);
      return { sections, nav: null, metadata };
    }
    for (const { details, body } of sections.values()) {
      const state = details.querySelector(".section-state");
      const added =
        [...body.querySelectorAll("input,select,textarea")].some((input) =>
          input.type === "checkbox"
            ? input.checked
            : input.multiple
              ? [...input.selectedOptions].length > 0
              : Boolean(input.value.trim()),
        ) || Boolean(body.querySelector(".admin-content-block"));
      if (!details.open) state.textContent = added ? "Added" : "Optional";
    }
    const nav = el("nav", "editor-section-nav");
    nav.setAttribute("aria-label", "Job editor sections");
    definitions.forEach(([key, title]) => {
      const a = el("a", "", title.replace("Important ", ""));
      a.href = `#editor-${key}`;
      a.addEventListener("click", (event) => {
        event.preventDefault();
        const target = sections.get(key).details;
        target.open = true;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      nav.append(a);
      sections.get(key).details.id = `editor-${key}`;
    });
    return { sections, nav };
  }
  function readRepeaterEntries(form, key) {
    const root = form.querySelector(`[data-repeater="${key}"]`);
    if (!root) return [];
    return [...root.querySelectorAll("[data-repeat-row]")]
      .map((row) => {
        const out = {}, translations = { hi: {}, bn: {} };
        row.querySelectorAll("[data-repeat-field]").forEach((input) => {
          const key = input.dataset.repeatField,
            value = input.value.trim();
          if (!value) return;
          if (input.type === "number") out[key] = Number(value);
          else if (input.type === "date") out[key] = value;
          else if (input.dataset.lines) out[key] = splitList(value);
          else out[key] = value;
        });
        row.querySelectorAll("[data-repeat-translation]").forEach(input => {
          const locale = input.dataset.translationLocale;
          const value = input.value.trim();
          if (value && translations[locale]) translations[locale][input.dataset.repeatTranslation] = value;
        });
        return {
          source: out,
          translations,
          originalIndex: row.dataset.originalIndex === undefined ? null : Number(row.dataset.originalIndex),
        };
      });
  }
  function readRepeater(form, key) {
    return readRepeaterEntries(form, key)
      .map(entry => entry.source)
      .filter(row => Object.keys(row).some(name => name !== "translationId"));
  }
  function cloneTranslationData(value) {
    return value && typeof value === "object"
      ? JSON.parse(JSON.stringify(value))
      : {};
  }
  function hasTranslationText(value) {
    if (typeof value === "string") return Boolean(value.trim());
    if (Array.isArray(value)) return value.some(hasTranslationText);
    if (value && typeof value === "object") return Object.values(value).some(hasTranslationText);
    return false;
  }
  function translatedLines(value) {
    return String(value || "").split(/\r?\n/).map(line => line.trim());
  }
  function collectJobContentTranslations(form, payload, existing = {}) {
    const result = cloneTranslationData(existing);
    const directFields = [...form.querySelectorAll("[data-content-translation]")];
    for (const locale of ["hi", "bn"]) {
      const translated = cloneTranslationData(result[locale]);
      for (const input of directFields.filter(field => field.dataset.translationLocale === locale)) {
        const path = input.dataset.contentTranslation;
        const sourcePath = input.dataset.translationSource;
        const sourceValue = sourcePath === "salaryDescription"
          ? payload.salaryInfo?.description
          : payload[sourcePath];
        const value = input.value.trim();
        if (value && !hasTranslationText(sourceValue))
          throw Error(`${input.closest("label")?.querySelector("span")?.textContent || "Translation"} needs corresponding English source text first.`);
        if (path === "salaryInfo.description") {
          translated.salaryInfo = { ...(translated.salaryInfo || {}) };
          if (value) translated.salaryInfo.description = value;
          else delete translated.salaryInfo.description;
          if (!Object.keys(translated.salaryInfo).length) delete translated.salaryInfo;
        } else if (value) translated[path] = value;
        else delete translated[path];
      }

      const repeaterTranslations = {
        selectionProcess: ["step"],
        importantDates: ["description"],
        vacancyBreakdown: ["notes"],
        ageRelaxations: ["notes"],
        applicationFees: ["notes"],
        qualifications: ["additionalRequirement", "notes"],
        selectionStages: ["description"],
        howToApplySteps: ["step"],
        importantLinks: ["description"],
        documentsRequired: ["description"],
        importantInstructions: ["text"],
        postGroups: ["description"],
      };
      for (const [key, translatedFields] of Object.entries(repeaterTranslations)) {
        const entries = readRepeaterEntries(form, key).filter(entry => Object.keys(entry.source).length);
        if (!entries.length) continue;
        const baseRows = translated[key] || [];
        const rows = entries.map(entry => {
          const previous = baseRows.find?.(item => item && typeof item === "object" && item.translationId === entry.source.translationId)
            || (entry.originalIndex == null ? undefined : baseRows[entry.originalIndex]);
          const row = key === "howToApplySteps" || key === "selectionProcess"
            ? { translationId: entry.source.translationId, text: typeof previous === "string" ? previous : previous?.text || "" }
            : { ...(previous || {}), translationId: entry.source.translationId };
          for (const field of translatedFields) {
            const value = entry.translations[locale][field] || "";
            const sourceField = field === "step" ? entry.source.step : entry.source[field];
            if (value && !hasTranslationText(sourceField))
              throw Error(`${key}: translated text needs matching English source text in the same row.`);
            if (value) row[field === "step" ? "text" : field] = value;
            else delete row[field === "step" ? "text" : field];
          }
          return row;
        });
        translated[key] = rows;
      }

      const postEntries = readRepeaterEntries(form, "posts").filter(entry => Object.keys(entry.source).some(name => name !== "translationId"));
      if (postEntries.length) {
        const baseRows = translated.posts || [];
        translated.posts = postEntries.map((entry, postIndex) => {
          const row = entry.originalIndex == null ? {} : { ...(baseRows[entry.originalIndex] || {}) };
          const sourcePost = payload.posts?.[postIndex] || {};
          const setText = (key, sourceValue) => {
            const value = entry.translations[locale][key] || "";
            if (value && !hasTranslationText(sourceValue))
              throw Error("Post translation needs matching English source text in the same post.");
            if (value) row[key] = value;
            else delete row[key];
          };
          setText("ageDescription", sourcePost.ageDescription);
          setText("additionalRequirements", sourcePost.additionalRequirements);
          setText("postSpecificNotes", sourcePost.postSpecificNotes);
          for (const [editorKey, arrayKey, sourceKey] of [
            ["qualificationAdditionalRequirements", "qualifications", "additionalRequirement"],
            ["experienceDescriptions", "experienceRequirements", "description"],
          ]) {
            const values = translatedLines(entry.translations[locale][editorKey]);
            const sourceRows = sourcePost[arrayKey] || [];
            const oldRows = row[arrayKey] || [];
            row[arrayKey] = sourceRows.map((sourceRow, index) => {
              const item = { ...(oldRows[index] || {}) };
              const value = values[index] || "";
              if (value && !hasTranslationText(sourceRow[sourceKey]))
                throw Error(`Post ${arrayKey} translation line ${index + 1} needs matching English source text.`);
              if (value) item[sourceKey] = value;
              else if (entry.translations[locale][editorKey]) item[sourceKey] = "";
              return item;
            });
          }
          return row;
        });
      }
      if (hasTranslationText(translated)) result[locale] = translated;
      else delete result[locale];
    }
    return hasTranslationText(result) ? result : undefined;
  }
  function addPresetPicker(section, label, values, makeItem) {
    const wrap = el("div", "admin-preset-picker");
    wrap.append(
      el("span", "", `${label} suggestions · verify and edit before use`),
    );
    const select = el("select");
    select.append(new Option("Choose a suggestion", ""));
    values.forEach((value) => select.append(new Option(value, value)));
    wrap.append(
      select,
      button("Insert", () => {
        if (!select.value) return;
        section.addRow(makeItem(select.value));
        select.value = "";
      }),
    );
    section.append(wrap);
  }
  function addContentBlocks(form, initial = []) {
    const section = el("section", "admin-repeater");
    section.dataset.blockEditor = "";
    section.append(
      el("h2", "", "Additional Information"),
      el(
        "p",
        "admin-muted",
        "Add ordered blocks. Empty blocks are rejected; tables can have any column count up to the API limit.",
      ),
    );
    const title = el("input");
    title.value = "Additional Information";
    title.dataset.contentSectionTitle = "";
    const titleLabel = el("label", "admin-field");
    titleLabel.append(el("span", "", "Section title"), title);
    section.append(titleLabel);
    const list = el("div", "admin-content-block-list");
    section.append(list);
    const inputField = (host, label, value = "", type = "text") => {
      const wrap = el("label", "admin-field");
      wrap.append(el("span", "", label));
      const input = type === "textarea" ? el("textarea") : el("input");
      if (type !== "textarea") input.type = type;
      input.value = value || "";
      wrap.append(input);
      host.append(wrap);
      return input;
    };
    const renderBlock = (item = { type: "paragraph", data: { text: "" } }) => {
      const card = el("details", "admin-content-block");
      card.dataset.blockType = item.type;
      card.open = false;
      const summary = el(
        "summary",
        "admin-content-block-summary",
        item.type.replaceAll(/([A-Z])/g, " $1"),
      );
      card.append(summary);
      const top = el("div", "admin-content-block-head");
      top.append(
        button("↑", () => {
          if (card.previousElementSibling)
            list.insertBefore(card, card.previousElementSibling);
        }),
        button("↓", () => {
          if (card.nextElementSibling)
            list.insertBefore(card.nextElementSibling, card);
        }),
        button("Remove", () => card.remove(), "is-danger"),
      );
      card.append(top);
      const d = item.data || {};
      card.dataset.contentType = item.type;
      if (item.type === "table") {
        inputField(card, "Table title (optional)", d.title);
        inputField(card, "Description / note (optional)", d.note);
        const heads = el("div", "admin-table-editor-header"),
          body = el("div", "admin-table-editor-body");
        card.append(heads, body);
        const addHead = (v = "") => {
          const wrap = el("div", "admin-field");
          const inp = el("input");
          inp.value = v;
          inp.dataset.tableHeader = "";
          wrap.append(
            el("span", "", "Column heading"),
            inp,
            button("Remove", () => {
              const idx = [...heads.children].indexOf(wrap);
              wrap.remove();
              body
                .querySelectorAll("[data-table-data-row]")
                .forEach((r) => r.children[idx]?.remove());
            }),
          );
          heads.append(wrap);
        };
        const addRow = (values = []) => {
          const row = el("div", "admin-table-editor-row");
          row.dataset.tableDataRow = "";
          [...heads.children].forEach((_, i) => {
            const cell = el("label", "admin-field");
            cell.append(el("span", "", `Cell ${i + 1}`));
            const inp = el("input");
            inp.dataset.tableCell = "";
            inp.value = values[i] || "";
            cell.append(inp);
            row.append(cell);
          });
          row.append(button("Remove row", () => row.remove(), "is-danger"));
          body.append(row);
        };
        (d.headers?.length ? d.headers : [""]).forEach(addHead);
        (d.rows?.length ? d.rows : [[]]).forEach(addRow);
        card.append(
          button("+ Add column", () => {
            addHead();
            body.querySelectorAll("[data-table-data-row]").forEach((row) => {
              const cell = el("label", "admin-field");
              cell.append(el("span", "", `Cell ${row.children.length}`));
              const inp = el("input");
              inp.dataset.tableCell = "";
              cell.append(inp);
              row.insertBefore(cell, row.lastElementChild);
            });
          }),
          button("+ Add row", () => addRow()),
        );
      } else if (item.type === "keyValueList") {
        inputField(card, "Block title (optional)", d.title);
        const rows = el("div", "admin-content-block-list");
        card.append(rows);
        const add = (pair = {}) => {
          const row = el("div", "admin-repeat-row");
          row.dataset.kvRow = "";
          inputField(row, "Key", pair.key);
          inputField(row, "Value", pair.value);
          row.append(
            button("↑", () => {
              if (row.previousElementSibling)
                rows.insertBefore(row, row.previousElementSibling);
            }),
            button("↓", () => {
              if (row.nextElementSibling)
                rows.insertBefore(row.nextElementSibling, row);
            }),
            button("Remove", () => row.remove(), "is-danger"),
          );
          rows.append(row);
        };
        (d.items?.length ? d.items : [{}]).forEach(add);
        card.append(button("+ Add key/value", () => add()));
      } else if (["bulletList", "numberedList", "steps"].includes(item.type))
        inputField(card, "One item per line", "items", "textarea").value = (
          d.items || []
        ).join("\n");
      else if (
        ["link", "externalLink", "youtube", "image"].includes(item.type)
      ) {
        inputField(card, "Label / caption", d.label || d.caption);
        inputField(card, "HTTP/HTTPS URL", d.url, "url");
        if (item.type === "image") inputField(card, "Alternative text", d.alt);
        if (item.type === "link" || item.type === "externalLink")
          inputField(card, "Description (optional)", d.description);
      } else if (item.type !== "divider")
        inputField(
          card,
          item.type === "heading"
            ? "Heading"
            : item.type === "callout"
              ? "Note / callout"
              : "Paragraph",
          d.text,
          "textarea",
        );
      list.append(card);
      return card;
    };
    initial.forEach(renderBlock);
    section.append(
      button("+ Add Content", () => {
        const chooser = el("select");
        [
          "heading",
          "paragraph",
          "bulletList",
          "numberedList",
          "steps",
          "table",
          "keyValueList",
          "image",
          "youtube",
          "externalLink",
          "callout",
          "divider",
        ].forEach((type) =>
          chooser.append(new Option(type.replaceAll(/([A-Z])/g, " $1"), type)),
        );
        const addButton = button("Add block", () => {
          const added = renderBlock({ type: chooser.value, data: {} });
          added.open = true;
          chooser.remove();
          addButton.remove();
        });
        section.append(chooser, addButton);
      }),
    );
    form.append(section);
    section.addBlock = renderBlock;
    return section;
  }
  function readContentBlocks(
    form,
    root = form.querySelector("[data-block-editor]"),
  ) {
    if (!root) return [];
    const blocks = [
      ...root.querySelectorAll(
        ":scope > .admin-content-block-list > .admin-content-block",
      ),
    ].map((card) => {
      const type = card.dataset.blockType;
      const inputs = [
        ...card.querySelectorAll(
          ":scope > label input, :scope > label textarea",
        ),
      ];
      const vals = inputs.map((x) => x.value.trim());
      let data = {};
      if (type === "table") {
        const headers = [...card.querySelectorAll("[data-table-header]")].map(
          (x) => x.value.trim(),
        );
        const rows = [...card.querySelectorAll("[data-table-data-row]")].map(
          (row) =>
            [...row.querySelectorAll("[data-table-cell]")].map((x) =>
              x.value.trim(),
            ),
        );
        if (!headers.length || headers.some((x) => !x))
          throw Error("Tables need at least one named column.");
        if (!rows.length || rows.some((row) => !row.some(Boolean)))
          throw Error("Tables need at least one non-empty row.");
        if (rows.some((row) => row.length !== headers.length))
          throw Error("Every table row must match the column count.");
        data = {
          title: vals[0] || undefined,
          note: vals[1] || undefined,
          headers,
          rows,
        };
      } else if (type === "keyValueList") {
        const items = [...card.querySelectorAll("[data-kv-row]")]
          .map((row) => {
            const pair = [...row.querySelectorAll("input")].map((x) =>
              x.value.trim(),
            );
            return { key: pair[0], value: pair[1] };
          })
          .filter((x) => x.key && x.value);
        if (!items.length)
          throw Error("Key/value lists need at least one complete pair.");
        data = { title: vals[0] || undefined, items };
      } else if (["bulletList", "numberedList", "steps"].includes(type)) {
        const items = splitList(vals[0]);
        if (!items.length) throw Error(`${type} needs at least one item.`);
        data = { items };
      } else if (["link", "externalLink"].includes(type)) {
        if (!vals[0] || !/^https?:\/\//i.test(vals[1] || ""))
          throw Error("External links need a label and HTTP/HTTPS URL.");
        data = {
          label: vals[0],
          url: vals[1],
          description: vals[2] || undefined,
        };
      } else if (type === "youtube") {
        if (
          !/^https?:\/\//i.test(vals[1] || "") ||
          !/(youtube\.com|youtu\.be)/i.test(vals[1])
        )
          throw Error("YouTube blocks need a valid YouTube URL.");
        data = { caption: vals[0] || undefined, url: vals[1] };
      } else if (type === "image") {
        if (!/^https?:\/\//i.test(vals[1] || ""))
          throw Error("Images need an HTTP/HTTPS URL.");
        data = {
          caption: vals[0] || undefined,
          url: vals[1],
          alt: vals[2] || undefined,
        };
      } else if (type === "divider") data = {};
      else {
        if (!vals[0]) throw Error(`${type} blocks need text.`);
        data = { text: vals[0] };
      }
      return { type, data };
    });
    return blocks;
  }
  function collectJobPayload(form, existingContentTranslations = {}) {
    const values = Object.fromEntries(new FormData(form)),
      payload = {
        title: values.title.trim(),
        organization: values.organization.trim(),
      };
    for (const key of [
      "category",
      "description",
      "qualification",
      "ageRelaxation",
      "location",
      "salary",
      "genderEligibility",
      "officialWebsite",
      "officialNotificationUrl",
      "officialApplyUrl",
      "howToApplyYoutubeUrl",
    ])
      if (values[key]?.trim()) payload[key] = values[key].trim();
    payload.board = values.board || "";
    payload.tags = splitList(values.tags);
    payload.categoryEligibility = splitList(values.categoryEligibility);
    for (const key of ["vacancyCount", "ageMin", "ageMax"])
      if (values[key] !== "") payload[key] = Number(values[key]);
    for (const key of [
      "selectionProcess",
      "applicationStartDate",
      "applicationDeadline",
      "examDate",
      "ageCutoffDate",
    ])
      if (values[key]) payload[key] = values[key];
    if (values.applicationFee?.trim()) {
      try {
        payload.applicationFee = JSON.parse(values.applicationFee);
      } catch {
        payload.applicationFee = values.applicationFee.trim();
      }
    }
    const resourceKeys = [
      "syllabusResources",
      "pyqResources",
      "mockTestResources",
      "studyResources",
      "otherResources",
    ];
    resourceKeys.forEach((key) => {
      payload[key] = [...form.elements[key].selectedOptions].map(
        (option) => option.value,
      );
    });
    for (const key of [
      "importantDates",
      "vacancyBreakdown",
      "ageRelaxations",
      "applicationFees",
      "qualifications",
      "selectionStages",
      "howToApplySteps",
      "importantLinks",
      "documentsRequired",
      "importantInstructions",
      "postGroups",
    ])
      payload[key] = readRepeater(form, key);
    payload.ageDescription = values.ageDescription || "";
    payload.salaryInfo = Object.fromEntries(
      [
        ["payLevel", values.payLevel],
        ["payScale", values.payScale],
        ["gradePay", values.gradePay],
        ["minimum", values.salaryMinimum],
        ["maximum", values.salaryMaximum],
        ["description", values.salaryDescription],
      ]
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => [k, v.trim()]),
    );
    payload.selectionStages = payload.selectionStages.map((stage) => ({
      ...stage,
      components: splitList(stage.components || "").map((name) => ({ name })),
    }));
    payload.selectionProcess = payload.selectionProcess.filter(row => row.step?.trim());
    payload.selectionProcessTranslationIds = payload.selectionProcess.map(row => row.translationId);
    payload.selectionProcess = payload.selectionProcess.map(row => row.step);
    payload.howToApplySteps = payload.howToApplySteps.filter(row => row.step?.trim());
    payload.howToApplyStepTranslationIds = payload.howToApplySteps.map(row => row.translationId);
    payload.howToApplySteps = payload.howToApplySteps.map(row => row.step);
    payload.documentsRequired = payload.documentsRequired.map((row) => ({
      ...row,
      required: row.required !== "false",
    }));
    payload.posts = readRepeater(form, "posts").map((post) => {
      const {
        qualifications,
        qualificationCondition,
        experienceRequirements,
        mandatoryCertifications,
        preferredCertifications,
        selectionRequirements,
        salaryPayLevel,
        salaryPayScale,
        salaryGradePay,
        salaryMinimum,
        salaryMaximum,
        salaryDescription,
        categoryVacancyBreakdown,
        ...rest
      } = post;
      return {
        ...rest,
        categoryVacancyBreakdown: (categoryVacancyBreakdown || [])
          .map((line) => {
            const [category, count] = line.split(":");
            return {
              category: category.trim(),
              ...(count?.trim() ? { vacancyCount: Number(count.trim()) } : {}),
            };
          })
          .filter((x) => x.category),
        qualifications: (qualifications || []).map((line) => {
          const [name, field, additionalRequirement, minimumMarks] = line
            .split("|")
            .map((x) => x.trim());
          return {
            name,
            condition: qualificationCondition || "ALL",
            ...(field ? { field } : {}),
            ...(additionalRequirement ? { additionalRequirement } : {}),
            ...(minimumMarks ? { minimumMarks } : {}),
          };
        }),
        experienceRequirements: (experienceRequirements || []).map((line) => {
          const [minimumExperience, domain, description] = line
            .split("|")
            .map((x) => x.trim());
          return {
            minimumExperience,
            ...(domain ? { domain } : {}),
            ...(description ? { description } : {}),
          };
        }),
        mandatoryCertifications: mandatoryCertifications || [],
        preferredCertifications: preferredCertifications || [],
        selectionRequirements: selectionRequirements || [],
        salary: {
          ...(salaryPayLevel ? { payLevel: salaryPayLevel } : {}),
          ...(salaryPayScale ? { payScale: salaryPayScale } : {}),
          ...(salaryGradePay ? { gradePay: salaryGradePay } : {}),
          ...(salaryMinimum ? { minimum: salaryMinimum } : {}),
          ...(salaryMaximum ? { maximum: salaryMaximum } : {}),
          ...(salaryDescription ? { description: salaryDescription } : {}),
        },
      };
    });
    const conditionalRoot = form.querySelector("[data-conditional-editor]");
    payload.conditionalFields = [
      ...conditionalRoot.querySelectorAll("[data-conditional-row]"),
    ].map((row) => {
      const field = row.querySelector("[data-conditional-field]").value,
        mode = row.querySelector("[data-conditional-mode]").value;
      const entries = [...row.querySelectorAll("[data-conditional-value]")]
        .map((input) => {
          const map = input.closest(".admin-conditional-map");
          return {
            postId:
              map.querySelector("[data-conditional-post]").value || undefined,
            category:
              map.querySelector("[data-conditional-category]").value.trim() ||
              undefined,
            value: input.value.trim(),
          };
        })
        .filter((entry) => entry.value);
      if (mode === "VARIES" && !entries.length)
        throw Error(`${field}: add at least one value for a varying field.`);
      return { field, mode, ...(entries.length ? { entries } : {}) };
    });
    payload.contentDocument = readDocument(
      form.querySelector("[data-job-document]"),
    );
    payload.contentTranslations = collectJobContentTranslations(
      form,
      payload,
      existingContentTranslations,
    );
    return payload;
  }
  function previewJob(job, readOnly = false) {
    const dialog = el("dialog", "admin-dialog admin-job-preview"),
      article = el("article", "admin-preview-content");
    article.append(
      el(
        "p",
        "admin-preview-label",
        readOnly
          ? `VIEW ONLY · ${String(job.status || "").replaceAll("_", " ")}`
          : "PREVIEW — NOT PUBLISHED",
      ),
    );
    if (job.title) article.append(el("h1", "", job.title));
    if (job.organization || job.board?.name || job.board)
      article.append(el("p", "", `${job.organization || ""}${job.board?.name ? `${job.organization ? " · " : ""}${job.board.name}` : job.board ? `${job.organization ? " · " : ""}Board selected` : ""}`));
    const addRows = (title, headers, items) => {
      if (!items?.length) return;
      article.append(
        el("h2", "", title),
        table(
          headers,
          items.map((item) => {
            const row = el("tr");
            headers.forEach((header, index) =>
              row.append(
                el("td", "", String(Object.values(item)[index] ?? "")),
              ),
            );
            return row;
          }),
        ),
      );
    };
    addRows(
      "Important Dates",
      ["Event", "Date", "Description"],
      job.importantDates,
    );
    addRows(
      "Vacancy Breakdown",
      ["Post", "Vacancies", "Notes"],
      job.vacancyBreakdown,
    );
    addRows(
      "Age Relaxation",
      ["Category", "Relaxation", "Notes"],
      job.ageRelaxations,
    );
    addRows(
      "Application Fees",
      ["Category", "Fee", "Notes"],
      job.applicationFees,
    );
    if (
      job.ageMin != null ||
      job.ageMax != null ||
      job.ageCutoffDate ||
      job.ageDescription
    )
      article.append(
        el(
          "p",
          "",
          `Age: ${job.ageMin ?? "Any"}–${job.ageMax ?? "Any"}${job.ageCutoffDate ? ` · Cutoff ${formatDate(job.ageCutoffDate)}` : ""}${job.ageDescription ? ` · ${job.ageDescription}` : ""}`,
        ),
      );
    if (job.qualifications?.length) {
      article.append(el("h2", "", "Qualifications"));
      job.qualifications.forEach((item) =>
        article.append(
          el(
            "p",
            "",
            [
              item.name,
              item.field,
              item.condition,
              item.minimumMarks,
              item.additionalRequirement,
            ]
              .filter(Boolean)
              .join(" · "),
          ),
        ),
      );
    }
    if (job.selectionStages?.length) {
      article.append(el("h2", "", "Selection Process"));
      const list = el("ol");
      job.selectionStages.forEach((stage) =>
        list.append(
          el(
            "li",
            "",
            `${stage.name}${stage.description ? ` — ${stage.description}` : ""}${stage.maximumMarks != null ? ` · ${stage.maximumMarks} marks` : ""}`,
          ),
        ),
      );
      article.append(list);
    }
    if (job.importantLinks?.length) {
      article.append(el("h2", "", "Important Links"));
      job.importantLinks.forEach((item) =>
        article.append(el("p", "", `${item.label}: ${item.url}`)),
      );
    }
    if (window.JInfoJobContent) {
      const previewPosts = window.JInfoJobContent.renderPosts(
        job,
        "admin-preview",
      );
      if (previewPosts) article.append(previewPosts);
    }
    if (job.howToApplySteps?.length) {
      article.append(el("h2", "", "How to Apply"));
      const list = el("ol");
      job.howToApplySteps.forEach((step) => list.append(el("li", "", step)));
      article.append(list);
    }
    if (job.importantInstructions?.length) {
      article.append(el("h2", "", "Important Instructions"));
      const list = el("ul");
      job.importantInstructions.forEach((item) =>
        list.append(el("li", "", item.text)),
      );
      article.append(list);
    }
    for (const [title, key] of [
      ["Syllabus", "syllabusResources"],
      ["Previous Papers", "pyqResources"],
      ["Mock Tests", "mockTestResources"],
      ["Study Materials", "studyResources"],
      ["Other Resources", "otherResources"],
    ])
      if (job[key]?.length)
        article.append(el("p", "", `${title}: ${job[key].length} selected`));
    if (window.JInfoJobContent) {
      article.append(window.JInfoJobContent.renderConditionalFields(job));
      if (job.contentDocument?.length)
        article.append(
          window.JInfoJobContent.renderDocument(job.contentDocument, {
            className: "job-document",
          }),
        );
      else
        article.append(
          window.JInfoJobContent.renderSections(
            job.contentSections,
            job.contentBlocks,
          ),
        );
    }
    dialog.append(
      button("Close Preview", () => dialog.close()),
      article,
    );
    root.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
  }
  async function renderAuthorDocumentEditor(content, id, isNew, job, templateData) {
    const form = el("form", "admin-job-form admin-document-form");
    form.noValidate = true;
    const feedback = el("div", "admin-form-feedback");
    const initialDocument = isNew
      ? Array.isArray(templateData?.contentDocument) ? templateData.contentDocument : []
      : job.contentDocument?.length ? job.contentDocument : legacyDocument(job);
    const initialTranslations = isNew ? templateData?.contentTranslations || {} : job.contentTranslations || {};
    const blocksEditor = addDocumentEditor(
      form,
      initialDocument,
      (message) => feedback.replaceChildren(notice(message, "is-error")),
      initialTranslations,
    );
    const footer = el("div", "admin-form-actions");
    const save = button("Save Draft", null, "is-primary");
    save.type = "submit";
    footer.append(button("Insert Saved Template", async () => {
      try {
        const { data: templates } = await api("/author/templates");
        if (!templates.length) {
          feedback.replaceChildren(notice("You have no saved document templates yet."));
          return;
        }
        const dialog = el("dialog", "admin-dialog");
        dialog.append(el("h2", "", "Insert a saved document template"));
        templates.forEach((template) => dialog.append(button(template.name, () => {
          blocksEditor.loadDocument(template.data?.contentDocument || [], template.data?.contentTranslations || {});
          dialog.close();
          feedback.replaceChildren(notice(`${template.name} inserted.`));
        }, "is-secondary")));
        dialog.append(button("Cancel", () => dialog.close()));
        content.append(dialog);
        dialog.showModal();
        dialog.addEventListener("close", () => dialog.remove(), { once: true });
      } catch (error) { feedback.replaceChildren(notice(error.message, "is-error")); }
    }, "is-secondary"));
    footer.append(button("Save Document as Template", async () => {
      const name = prompt("Template name");
      if (!name?.trim()) return;
      try {
        await api("/author/templates", { method: "POST", body: JSON.stringify({ name: name.trim(), data: { contentDocument: readDocument(blocksEditor), contentTranslations: blocksEditor.readTranslations() } }) });
        feedback.replaceChildren(notice("Document template saved."));
      } catch (error) { feedback.replaceChildren(notice(error.message, "is-error")); }
    }, "is-secondary"));
    if (!isNew) footer.append(button("Preview", () => {
      try {
        const previewTranslations = blocksEditor.readTranslations();
        const contentTranslations = { ...(job.contentTranslations || {}) };
        for (const [locale, values] of Object.entries(previewTranslations || {}))
          contentTranslations[locale] = { ...(contentTranslations[locale] || {}), ...values };
        previewJob({ ...job, contentDocument: readDocument(blocksEditor), contentTranslations });
      }
      catch (error) { feedback.replaceChildren(notice(error.message, "is-error")); }
    }, "is-secondary"));
    footer.append(save);
    if (!isNew) {
      footer.append(
        button("Submit for Review", async () => {
          save.disabled = true;
          feedback.replaceChildren();
          try {
            await api(`/jobs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ contentDocument: readDocument(blocksEditor), ...(blocksEditor.readTranslations() ? { contentTranslations: blocksEditor.readTranslations() } : {}) }) });
            await api(`/jobs/${encodeURIComponent(id)}/submit-review`, { method: "POST" });
            feedback.replaceChildren(notice("Submitted for review."));
            setTimeout(() => location.assign("/admin/jobs"), 700);
          } catch (error) { feedback.replaceChildren(notice(validationMessage(error), "is-error")); }
          finally { save.disabled = false; }
        }, "is-secondary"),
      );
    }
    form.append(feedback, footer);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      save.disabled = true;
      save.textContent = "Saving…";
      feedback.replaceChildren();
      try {
        const richTranslations = blocksEditor.readTranslations();
        const payload = { contentDocument: readDocument(blocksEditor), ...(richTranslations ? { contentTranslations: richTranslations } : {}) };
        const response = isNew
          ? await api("/jobs", { method: "POST", body: JSON.stringify(payload) })
          : await api(`/jobs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
        if (isNew) {
          const savedId = response.data?._id;
          if (!savedId) throw new Error("The server did not return the saved draft ID.");
          feedback.replaceChildren(notice("Draft saved."));
          setTimeout(() => location.assign(`/admin/jobs/${savedId}/edit`), 700);
        } else feedback.replaceChildren(notice("Draft saved."));
      } catch (error) { feedback.replaceChildren(notice(validationMessage(error), "is-error")); }
      finally { save.disabled = false; save.textContent = "Save Draft"; }
    });
    content.append(form);
  }
  async function renderEditor(id, templateData) {
    const isNew = id === "new";
    const content = shell(
      isNew && state.user.role === "AUTHOR" ? "create" : "jobs",
    );
    if (isNew && !templateData && state.user.role !== "AUTHOR") {
      const heading = el("div", "admin-page-heading");
      heading.append(el("h1", "", "Create Job"));
      content.append(
        heading,
        el(
          "p",
          "admin-muted",
          "Start with a blank job document or reuse one of your document templates.",
        ),
      );
      const choices = el("div", "admin-template-choices");
      const builtIns = [
        ["Blank Job", [], "Start with an empty article."],
        [
          "Recruitment Article",
          [
            {
              type: "h2",
              content: [{ type: "span", text: "Important Dates" }],
            },
            {
              type: "table",
              content: [
                {
                  type: "tbody",
                  content: [
                    {
                      type: "tr",
                      content: [
                        {
                          type: "th",
                          content: [{ type: "span", text: "Event" }],
                        },
                        {
                          type: "th",
                          content: [{ type: "span", text: "Date" }],
                        },
                      ],
                    },
                    {
                      type: "tr",
                      content: [
                        { type: "td", content: [{ type: "br" }] },
                        { type: "td", content: [{ type: "br" }] },
                      ],
                    },
                  ],
                },
              ],
            },
            { type: "h2", content: [{ type: "span", text: "Eligibility" }] },
            { type: "p", content: [{ type: "br" }] },
            { type: "h2", content: [{ type: "span", text: "How to Apply" }] },
            {
              type: "ol",
              content: [{ type: "li", content: [{ type: "br" }] }],
            },
          ],
          "An editable document with a dates table and sample headings.",
        ],
      ];
      builtIns.forEach(([name, contentDocument, description]) => {
        const card = el("article", "admin-template-choice");
        card.append(el("h2", "", name), el("p", "", description));
        card.append(
          button(
            "Use Template",
            () => renderEditor("new", { name, contentDocument }),
            "is-secondary",
          ),
        );
        choices.append(card);
      });
      if (state.user.role === "AUTHOR")
        try {
          const { data } = await api("/author/templates");
          const { data: boards } = await api("/boards?limit=100");
          data.forEach((template) => {
            const card = el("article", "admin-template-choice");
            card.append(
              el("h2", "", template.name),
              el(
                "p",
                "",
                template.description ||
                  "Reusable document with optional board default.",
              ),
            );
            const board = boards.find(
              (item) =>
                String(item._id) === String(template.data?.defaultBoardId),
            );
            card.append(
              el("p", "admin-muted", `Board default: ${board?.name || "None"}`),
              button(
                "Use Template",
                () =>
                  renderEditor("new", {
                    ...template.data,
                    name: template.name,
                    defaultBoard: board?.name,
                    defaultBoardId: template.data?.defaultBoardId,
                  }),
                "is-secondary",
              ),
            );
            choices.append(card);
          });
        } catch (error) {
          choices.append(notice(error.message, "is-error"));
        }
      content.append(
        choices,
        button("← Back to Jobs", () => location.assign("/admin/jobs")),
      );
      return;
    }
    const heading = el("div", "admin-page-heading");
    heading.append(el("h1", "", isNew ? "Create Job" : "Edit Job"));
    heading.append(
      button("← Back to Jobs", () => location.assign("/admin/jobs")),
    );
    content.append(heading);
    const note = el(
      "div",
      "admin-editor-note",
      `${templateData?.name ? `Template: ${templateData.name}. ` : ""}All saved jobs begin as DRAFT. Verify every fact before submitting. Publishing is a separate ADMIN/SUPER_ADMIN action.`,
    );
    if (state.user.role !== "AUTHOR") content.append(note);
    let job = {};
    try {
      if (!isNew) {
        ({ data: job } = await api(`/jobs/${encodeURIComponent(id)}`));
        if (
          state.user.role === "AUTHOR" &&
          !["DRAFT", "REJECTED"].includes(job.status)
        ) {
          content.append(
            notice(
              `This ${job.status.replaceAll("_", " ").toLowerCase()} job is read-only while its workflow is locked.`,
              "",
            ),
            button("View Job", () => viewJob(job._id)),
          );
          return;
        }
      }
      if (state.user.role === "AUTHOR") {
        await renderAuthorDocumentEditor(content, id, isNew, job, templateData);
        return;
      }
      const [{ data: boards }, { data: resources }] = await Promise.all([
        api("/boards?limit=100"),
        api("/resources?limit=100"),
      ]);
      const resourceOptions = [...resources];
      for (const key of [
        "syllabusResources",
        "pyqResources",
        "mockTestResources",
        "studyResources",
        "otherResources",
      ]) {
        for (const item of job[key] || []) {
          if (
            item &&
            typeof item === "object" &&
            !resourceOptions.some(
              (option) => String(option._id) === String(item._id),
            )
          )
            resourceOptions.push(item);
        }
      }
      const form = el("form", "admin-job-form");
      form.noValidate = true;
      field(form, "Job title", "title", "text", job.title || "", {
        required: true,
      });
      field(
        form,
        "Organization",
        "organization",
        "text",
        job.organization || "",
        { required: true },
      );
      const boardWrap = el("label", "admin-field");
      boardWrap.append(el("span", "", "Board"));
      const board = el("select");
      board.name = "board";
      board.append(new Option("No board selected", ""));
      boards.forEach((b) => {
        const id = String(b._id || "");
        const option = new Option(b.name, id);
        if (!/^[a-f\d]{24}$/i.test(id)) option.disabled = true;
        board.append(option);
      });
      const currentBoardId =
        job.board && typeof job.board === "object" ? job.board._id : job.board;
      if (
        currentBoardId &&
        !boards.some((item) => String(item._id) === String(currentBoardId))
      ) {
        const inactiveName =
          job.board?.name || job.boardName || "Inactive board";
        board.append(
          new Option(`${inactiveName} · inactive`, String(currentBoardId)),
        );
      }
      board.value = currentBoardId ? String(currentBoardId) : "";
      if (isNew && !currentBoardId && templateData?.defaultBoard) {
        const suggested = boards.find(
          (item) =>
            String(item._id) === String(templateData.defaultBoardId) ||
            item.name.toLowerCase() ===
              String(templateData.defaultBoard).toLowerCase() ||
            item.slug === templateData.defaultBoard,
        );
        if (suggested) board.value = String(suggested._id);
      }
      boardWrap.append(board);
      form.append(boardWrap);
      field(form, "Category", "category", "text", job.category || "");
      field(
        form,
        "Tags (comma separated)",
        "tags",
        "text",
        (job.tags || []).join(", "),
      );
      field(
        form,
        "Description",
        "description",
        "textarea",
        job.description || "",
        { rows: 5 },
      );
      field(
        form,
        "Vacancy count",
        "vacancyCount",
        "number",
        job.vacancyCount ?? "",
        { min: 0 },
      );
      field(
        form,
        "Application start",
        "applicationStartDate",
        "date",
        toInputDate(job.applicationStartDate),
      );
      field(
        form,
        "Application deadline",
        "applicationDeadline",
        "date",
        toInputDate(job.applicationDeadline),
      );
      field(form, "Exam date", "examDate", "date", toInputDate(job.examDate));
      field(
        form,
        "Qualification",
        "qualification",
        "text",
        job.qualification || "",
      );
      field(form, "Minimum age", "ageMin", "number", job.ageMin ?? "", {
        min: 0,
        max: 120,
      });
      field(form, "Maximum age", "ageMax", "number", job.ageMax ?? "", {
        min: 0,
        max: 120,
      });
      field(
        form,
        "Age relaxation",
        "ageRelaxation",
        "text",
        job.ageRelaxation || "",
      );
      field(form, "Location", "location", "text", job.location || "");
      field(form, "Salary", "salary", "text", job.salary || "");
      field(
        form,
        "Application fee (text or JSON)",
        "applicationFee",
        "text",
        job.applicationFee === undefined
          ? ""
          : typeof job.applicationFee === "string"
            ? job.applicationFee
            : JSON.stringify(job.applicationFee),
      );
      field(
        form,
        "Category eligibility (one per line)",
        "categoryEligibility",
        "textarea",
        (job.categoryEligibility || []).join("\n"),
        { rows: 3 },
      );
      field(
        form,
        "Gender eligibility",
        "genderEligibility",
        "text",
        job.genderEligibility || "",
      );
      field(
        form,
        "Official website",
        "officialWebsite",
        "url",
        job.officialWebsite || "",
      );
      field(
        form,
        "Official notification URL",
        "officialNotificationUrl",
        "url",
        job.officialNotificationUrl || "",
      );
      field(
        form,
        "Official apply URL",
        "officialApplyUrl",
        "url",
        job.officialApplyUrl || "",
      );
      field(
        form,
        "How to Apply YouTube URL",
        "howToApplyYoutubeUrl",
        "url",
        job.howToApplyYoutubeUrl || "",
      );
      field(
        form,
        "Age cutoff date",
        "ageCutoffDate",
        "date",
        toInputDate(job.ageCutoffDate),
      );
      field(
        form,
        "Age limit description",
        "ageDescription",
        "textarea",
        job.ageDescription || "",
      );
      field(
        form,
        "Pay level",
        "payLevel",
        "text",
        job.salaryInfo?.payLevel || "",
      );
      field(
        form,
        "Pay scale",
        "payScale",
        "text",
        job.salaryInfo?.payScale || "",
      );
      field(
        form,
        "Grade pay",
        "gradePay",
        "text",
        job.salaryInfo?.gradePay || "",
      );
      field(
        form,
        "Salary minimum",
        "salaryMinimum",
        "text",
        job.salaryInfo?.minimum || "",
      );
      field(
        form,
        "Salary maximum",
        "salaryMaximum",
        "text",
        job.salaryInfo?.maximum || "",
      );
      field(
        form,
        "Salary description",
        "salaryDescription",
        "text",
        job.salaryInfo?.description || "",
      );
      addJobTranslationsSection(form, job);
      addRepeater(
        form,
        "Important Dates",
        "importantDates",
        [
          ["event", "Event"],
          ["date", "Date", "date"],
          ["description", "Description", "textarea"],
        ],
        withContentTranslationRows(job.importantDates, job, "importantDates"),
        [{ key: "description", label: "Description" }],
      );
      addRepeater(
        form,
        "Vacancy Breakdown",
        "vacancyBreakdown",
        [
          ["post", "Post"],
          ["vacancyCount", "Vacancies", "number"],
          ["notes", "Notes", "textarea"],
        ],
        withContentTranslationRows(job.vacancyBreakdown, job, "vacancyBreakdown"),
        [{ key: "notes", label: "Explanatory notes" }],
      );
      addRepeater(
        form,
        "Age Relaxations",
        "ageRelaxations",
        [
          ["category", "Category"],
          ["relaxation", "Relaxation"],
          ["notes", "Notes", "textarea"],
        ],
        withContentTranslationRows(job.ageRelaxations, job, "ageRelaxations"),
        [{ key: "notes", label: "Explanatory notes" }],
      );
      addRepeater(
        form,
        "Application Fees",
        "applicationFees",
        [
          ["category", "Category"],
          ["fee", "Fee"],
          ["notes", "Notes", "textarea"],
        ],
        withContentTranslationRows(job.applicationFees, job, "applicationFees"),
        [{ key: "notes", label: "Explanatory notes" }],
      );
      const qualificationEditor = addRepeater(
        form,
        "Qualifications",
        "qualifications",
        [
          ["name", "Qualification"],
          ["field", "Field / Stream"],
          ["condition", "Condition: ALL / ANY_ONE / OPTIONAL"],
          ["additionalRequirement", "Additional requirement", "textarea"],
          ["minimumMarks", "Minimum marks"],
          ["notes", "Notes", "textarea"],
        ],
        withContentTranslationRows(job.qualifications, job, "qualifications", value => value || {}).map(x => ({ ...x, name: x.name || "" })),
        [
          { key: "additionalRequirement", label: "Additional requirement" },
          { key: "notes", label: "Explanatory notes" },
        ],
      );
      addPresetPicker(
        qualificationEditor,
        "Qualification",
        [
          "10th Pass",
          "12th Pass",
          "Diploma",
          "ITI",
          "Graduate",
          "Post Graduate",
          "Engineering",
          "Medical",
          "Other",
        ],
        (name) => ({ name, condition: "ALL" }),
      );
      const selectionEditor = addRepeater(
        form,
        "Selection Stages",
        "selectionStages",
        [
          ["name", "Stage"],
          ["description", "Description", "textarea"],
          ["maximumMarks", "Maximum marks", "number"],
          ["qualifyingMarks", "Qualifying marks", "number"],
          ["qualifyingPercentage", "Qualifying %", "number"],
          ["duration", "Duration"],
          ["weightage", "Weightage"],
          ["components", "Components (one per line)", "lines"],
        ],
        withContentTranslationRows(job.selectionStages, job, "selectionStages").map((x) => ({
          ...x,
          components: (x.components || []).map((c) => c.name),
        })) || [],
        [{ key: "description", label: "Stage explanation" }],
      );
      addPresetPicker(
        selectionEditor,
        "Selection stage",
        [
          "Computer Based Examination",
          "Written Examination",
          "Preliminary Examination",
          "Main Examination",
          "Physical Measurement Test",
          "Physical Efficiency Test",
          "Skill Test",
          "Typing Test",
          "Interview",
          "Document Verification",
          "Medical Examination",
          "Other",
        ],
        (name) => ({ name }),
      );
      addRepeater(
        form,
        "Selection Process",
        "selectionProcess",
        [["step", "Stage or explanatory line", "textarea"]],
        withContentTranslationRows((job.selectionProcess || []).map((step, index) => ({
          step,
          translationId: job.selectionProcessTranslationIds?.[index],
        })), job, "selectionProcess", value => typeof value === "string" ? value : value?.text || ""),
        [{ key: "step", label: "Selection-process explanation" }],
      );
      addRepeater(
        form,
        "How to Apply Steps",
        "howToApplySteps",
        [["step", "Step", "textarea"]],
        withContentTranslationRows((job.howToApplySteps || []).map((step, index) => ({ step, translationId: job.howToApplyStepTranslationIds?.[index] })), job, "howToApplySteps", value => ({ step: typeof value === "string" ? value : value?.text || "" })),
        [{ key: "step", label: "Application step" }],
      );
      addRepeater(
        form,
        "Important Links",
        "importantLinks",
        [
          ["label", "Label"],
          ["url", "HTTP/HTTPS URL", "url"],
          ["description", "Description", "textarea"],
        ],
        withContentTranslationRows(job.importantLinks, job, "importantLinks"),
        [{ key: "description", label: "Explanatory description" }],
      );
      addRepeater(
        form,
        "Documents Required",
        "documentsRequired",
        [
          ["name", "Document"],
          ["description", "Description", "textarea"],
          ["required", "Required? (true/false)"],
        ],
        withContentTranslationRows(job.documentsRequired, job, "documentsRequired"),
        [{ key: "description", label: "Document description" }],
      );
      addRepeater(
        form,
        "Important Instructions",
        "importantInstructions",
        [
          ["text", "Instruction", "textarea"],
          ["category", "Category"],
        ],
        withContentTranslationRows(job.importantInstructions, job, "importantInstructions"),
        [{ key: "text", label: "Instruction text" }],
      );
      addRepeater(
        form,
        "Post Groups / Scales",
        "postGroups",
        [
          ["name", "Group / Scale"],
          ["description", "Description"],
          ["totalVacancies", "Total vacancies", "number"],
        ],
        withContentTranslationRows(job.postGroups, job, "postGroups"),
        [{ key: "description", label: "Group explanation" }],
      );
      const postRows = (job.posts || []).map((post, index) => {
        const fields = Object.fromEntries(["hi", "bn"].map(locale => {
          const translated = job.contentTranslations?.[locale]?.posts?.[index] || {};
          return [locale, {
            ageDescription: translated.ageDescription || "",
            qualificationAdditionalRequirements: (translated.qualifications || []).map(item => item.additionalRequirement || "").join("\n"),
            experienceDescriptions: (translated.experienceRequirements || []).map(item => item.description || "").join("\n"),
            additionalRequirements: translated.additionalRequirements || "",
            postSpecificNotes: translated.postSpecificNotes || "",
          }];
        }));
        return {
        ...post,
        _contentTranslations: fields,
        qualifications: (post.qualifications || []).map((item) =>
          [item.name, item.field, item.additionalRequirement, item.minimumMarks]
            .filter(Boolean)
            .join(" | "),
        ),
        qualificationCondition: post.qualifications?.[0]?.condition || "ALL",
        experienceRequirements: (post.experienceRequirements || []).map(
          (item) =>
            [item.minimumExperience, item.domain, item.description]
              .filter(Boolean)
              .join(" | "),
        ),
        mandatoryCertifications: post.mandatoryCertifications || [],
        preferredCertifications: post.preferredCertifications || [],
        selectionRequirements: post.selectionRequirements || [],
        categoryVacancyBreakdown: (post.categoryVacancyBreakdown || []).map(
          (item) => `${item.category}: ${item.vacancyCount ?? ""}`,
        ),
        salaryPayLevel: post.salary?.payLevel,
        salaryPayScale: post.salary?.payScale,
        salaryGradePay: post.salary?.gradePay,
        salaryMinimum: post.salary?.minimum,
        salaryMaximum: post.salary?.maximum,
        salaryDescription: post.salary?.description,
      }; });
      addRepeater(
        form,
        "Posts / Positions",
        "posts",
        [
          ["name", "Post name"],
          ["code", "Code / Reference"],
          ["groupName", "Group / Scale"],
          ["vacancyCount", "Vacancies", "number"],
          [
            "categoryVacancyBreakdown",
            "Category vacancies (Category: number per line)",
            "lines",
          ],
          ["ageMin", "Minimum age", "number"],
          ["ageMax", "Maximum age", "number"],
          ["ageCutoffDate", "Age cutoff", "date"],
          ["ageDescription", "Age description"],
          [
            "qualifications",
            "Qualifications (one per line: Name | Field | Additional | Minimum marks)",
            "lines",
          ],
          [
            "qualificationCondition",
            "Qualification condition: ALL / ANY_ONE / OPTIONAL",
          ],
          [
            "experienceRequirements",
            "Experience (one per line: Minimum | Domain | Details)",
            "lines",
          ],
          [
            "mandatoryCertifications",
            "Mandatory certifications (one per line)",
            "lines",
          ],
          [
            "preferredCertifications",
            "Preferred certifications (one per line)",
            "lines",
          ],
          ["minimumMarks", "Minimum marks"],
          ["salaryPayLevel", "Pay level"],
          ["salaryPayScale", "Pay scale"],
          ["salaryGradePay", "Grade pay"],
          ["salaryMinimum", "Salary minimum"],
          ["salaryMaximum", "Salary maximum"],
          ["salaryDescription", "Salary description"],
          [
            "selectionRequirements",
            "Selection requirements (one per line)",
            "lines",
          ],
          ["additionalRequirements", "Additional requirements", "textarea"],
          ["postSpecificNotes", "Post notes", "textarea"],
        ],
        postRows,
        [
          { key: "ageDescription", label: "Age explanation (preserve all limits and numbers)" },
          { key: "qualificationAdditionalRequirements", label: "Qualification explanations (one line per qualification item, source order)", type: "lines" },
          { key: "experienceDescriptions", label: "Experience explanations (one line per experience item, source order)", type: "lines" },
          { key: "additionalRequirements", label: "Additional explanatory requirements", type: "textarea" },
          { key: "postSpecificNotes", label: "Post-specific notes", type: "textarea" },
        ],
      );
      const initialDocument = isNew
        ? Array.isArray(templateData?.contentDocument)
          ? templateData.contentDocument
          : []
        : job.contentDocument?.length
          ? job.contentDocument
          : legacyDocument(job);
      const blocksEditor = addDocumentEditor(form, initialDocument);
      const conditionalEditor = el("section", "admin-repeater");
      conditionalEditor.dataset.conditionalEditor = "";
      conditionalEditor.append(
        el("h2", "", "Common or Varying Values"),
        el(
          "p",
          "admin-muted",
          "Choose only fields whose official notice gives different values. Post references point to the existing Post record; category may be used alone or with a post.",
        ),
      );
      const conditionalRows = el("div", "admin-repeater-rows");
      conditionalEditor.append(conditionalRows);
      const conditionalFields = [
        "vacancyCount",
        "qualification",
        "ageLimit",
        "salary",
        "applicationFee",
        "location",
        "experience",
        "selectionProcess",
      ];
      const makeConditional = (item = {}) => {
        const row = el("div", "admin-conditional-row");
        row.dataset.conditionalRow = "";
        const fieldSelect = el("select");
        fieldSelect.dataset.conditionalField = "";
        conditionalFields.forEach((value) => {
          const option = new Option(value.replaceAll(/([A-Z])/g, " $1"), value);
          option.selected = value === item.field;
          fieldSelect.append(option);
        });
        const mode = el("select");
        mode.dataset.conditionalMode = "";
        [
          ["COMMON", "Same for whole recruitment"],
          ["VARIES", "Varies by post/category"],
        ].forEach(([v, l]) => {
          const option = new Option(l, v);
          option.selected = (item.mode || "COMMON") === v;
          mode.append(option);
        });
        const mappings = el("div", "admin-conditional-mappings");
        const addMapping = (entry = {}) => {
          const map = el("div", "admin-conditional-map");
          const post = el("select");
          post.dataset.conditionalPost = "";
          post.append(new Option("All posts / category only", ""));
          (job.posts || []).forEach((p) => {
            if (p._id) post.append(new Option(p.name || "Post", String(p._id)));
          });
          post.value = entry.postId || "";
          const category = el("input");
          category.placeholder = "Category (optional)";
          category.value = entry.category || "";
          category.dataset.conditionalCategory = "";
          const value = el("input");
          value.placeholder = "Official value";
          value.value = entry.value || "";
          value.dataset.conditionalValue = "";
          map.append(
            post,
            category,
            value,
            button("Remove", () => map.remove(), "is-danger"),
          );
          mappings.append(map);
        };
        (item.entries || []).forEach(addMapping);
        const controls = el("div", "admin-conditional-controls");
        controls.append(el("label", "admin-field"), el("label", "admin-field"));
        controls.children[0].append(el("span", "", "Field"), fieldSelect);
        controls.children[1].append(el("span", "", "Applies"), mode);
        const update = () => {
          mappings.hidden = mode.value !== "VARIES";
        };
        mode.addEventListener("change", update);
        update();
        row.append(
          controls,
          mappings,
          button("+ Add value", () => addMapping()),
          button("Remove field", () => row.remove(), "is-danger"),
        );
        conditionalRows.append(row);
      };
      (job.conditionalFields || []).forEach(makeConditional);
      conditionalEditor.append(
        button("+ Add variable field", () => makeConditional()),
      );
      blocksEditor.before(conditionalEditor);
      multi(
        form,
        "Syllabus resources",
        "syllabusResources",
        resourceOptions,
        job.syllabusResources || [],
        "SYLLABUS",
      );
      multi(
        form,
        "Previous papers",
        "pyqResources",
        resourceOptions,
        job.pyqResources || [],
        "PYQ",
      );
      multi(
        form,
        "Mock tests",
        "mockTestResources",
        resourceOptions,
        job.mockTestResources || [],
        "MOCK_TEST",
      );
      multi(
        form,
        "Study materials",
        "studyResources",
        resourceOptions,
        job.studyResources || [],
        "STUDY_MATERIAL",
      );
      multi(
        form,
        "Other resources",
        "otherResources",
        resourceOptions,
        job.otherResources || [],
        "OTHER",
      );
      const editor = organizeJobForm(form);
      if (editor.nav) {
        form.append(editor.nav);
        for (const [key] of editor.sections)
          form.append(editor.sections.get(key).details);
      }
      const footer = el("div", "admin-form-actions"),
        save = el(
          "button",
          "admin-button is-primary",
          isNew && state.user.role === "AUTHOR" ? "Save Draft" : "Save Job",
        );
      save.type = "submit";
      footer.append(
        save,
        button("Cancel", () => location.assign("/admin/jobs")),
      );
      footer.append(
        button("Preview Job", () => {
          try {
            previewJob(collectJobPayload(form, job.contentTranslations));
          } catch (error) {
            feedback.replaceChildren(notice(error.message, "is-error"));
          }
        }),
      );
      if (state.user.role === "AUTHOR")
        footer.append(
          button(
            "Save Document as Template",
            async () => {
              const name = prompt("Template name");
              if (!name || name.trim().length < 2) return;
              try {
                await api("/author/templates", {
                  method: "POST",
                  body: JSON.stringify({
                    name: name.trim(),
                    description: "Reusable job article document",
                    data: {
                      contentDocument: readDocument(
                        form.querySelector("[data-job-document]"),
                      ),
                    },
                  }),
                });
                feedback.replaceChildren(
                  notice("Document template saved.", "is-success"),
                );
              } catch (error) {
                feedback.replaceChildren(notice(error.message, "is-error"));
              }
            },
            "",
          ),
        );
      form.append(footer);
      const feedback = el("div", "admin-form-feedback");
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      form.append(feedback);
      form.insertBefore(feedback, form.firstChild);
      if (
        !isNew &&
        ["AUTHOR", "ADMIN", "SUPER_ADMIN"].includes(state.user.role) &&
        ["DRAFT", "REJECTED"].includes(job.status)
      )
        form.insertBefore(
          button("Submit for Review", async () => {
            try {
              await api(`/jobs/${id}/submit-review`, { method: "POST" });
              location.reload();
            } catch (e) {
              feedback.replaceChildren(notice(e.message, "is-error"));
            }
          }),
          footer,
        );
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        save.disabled = true;
        save.textContent = "Saving...";
        feedback.replaceChildren();
        try {
          const titleInput = form.elements.namedItem("title");
          const organizationInput = form.elements.namedItem("organization");
          if (titleInput.value.trim().length < 2) {
            feedback.replaceChildren(
              notice("Enter a job title with at least 2 characters.", "is-error"),
            );
            form.querySelector(".admin-job-metadata")?.setAttribute("open", "");
            titleInput.focus();
            feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
            return;
          }
          if (!organizationInput.value.trim()) {
            feedback.replaceChildren(
              notice("Enter the recruiting organization.", "is-error"),
            );
            form.querySelector(".admin-job-metadata")?.setAttribute("open", "");
            organizationInput.focus();
            feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
            return;
          }
          const payload = collectJobPayload(form, job.contentTranslations);
          if (payload.board && !/^[a-f\d]{24}$/i.test(payload.board)) {
            throw new Error("Please select a valid board.");
          }
          if (["localhost", "127.0.0.1"].includes(location.hostname))
            console.debug("Submitting job draft", {
              hasBoard: Boolean(payload.board),
              documentNodeCount: payload.contentDocument.length,
            });
          const response = isNew
            ? await api("/jobs", {
                method: "POST",
                body: JSON.stringify(payload),
              })
            : await api(`/jobs/${id}`, {
                method: "PATCH",
                body: JSON.stringify(payload),
              });
          if (isNew) {
            const savedId = response.data?._id;
            if (!savedId)
              throw new Error(
                "The server did not return the saved job ID. Check My Jobs before trying again.",
              );
            feedback.replaceChildren(
              notice("Draft saved. Opening your draft…", "is-success"),
            );
            setTimeout(
              () => location.assign(`/admin/jobs/${savedId}/edit`),
              400,
            );
            return;
          }
          feedback.replaceChildren(notice("Saved successfully."));
          feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
          job = response.data;
        } catch (error) {
          if (["localhost", "127.0.0.1"].includes(location.hostname))
            console.warn("Job save failed", {
              status: error.status || 0,
              code: error.code || "UNKNOWN_ERROR",
            });
          const message =
            error.status === 400
              ? `Validation error: ${validationMessage(error)}`
              : error.status >= 500
                ? "The server could not save this job. Try again, and check the server logs if the problem continues."
                : error instanceof TypeError
                  ? "Could not reach the server. Check your connection and try again."
                  : error.message;
          feedback.replaceChildren(
            notice(message, "is-error"),
          );
          feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } finally {
          save.disabled = false;
          save.textContent =
            isNew && state.user.role === "AUTHOR" ? "Save Draft" : "Save Job";
        }
      });
      content.append(form);
    } catch (error) {
      content.append(
        notice(
          error.status === 404
            ? "Job not found."
            : error.status === 403
              ? "You cannot edit this job."
              : error.message,
          "is-error",
        ),
      );
    }
  }
  async function renderBoards(page = 1, filters = {}) {
    const content = shell("boards");
    const heading = el("div", "admin-page-heading");
    heading.append(el("h1", "", "Boards"));
    heading.append(
      button(
        "Create Board",
        () => location.assign("/admin/boards/new"),
        "is-primary",
      ),
    );
    content.append(heading);
    const form = el("form", "admin-filter-form");
    const search = el("input");
    search.name = "q";
    search.type = "search";
    search.placeholder = "Search name, organization, or category";
    search.value = filters.q || "";
    const active = el("select");
    active.name = "active";
    active.append(
      new Option("All boards", ""),
      new Option("Active", "true"),
      new Option("Inactive", "false"),
    );
    active.value = filters.active || "";
    const submit = el("button", "admin-button", "Search");
    submit.type = "submit";
    form.append(search, active, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      renderBoards(1, values);
    });
    content.append(form);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "20" });
      for (const [key, value] of Object.entries(filters))
        if (value) query.set(key, value);
      const { data, pagination } = await api(`/admin/boards?${query}`);
      const rows = data.map((board) => {
        const row = el("tr");
        row.append(
          el("td", "", board.name),
          el("td", "", board.organization || "—"),
          el("td", "", board.category || "—"),
          el("td", "", board.active ? "Active" : "Inactive"),
          el("td", "", String(board.publishedJobs || 0)),
        );
        const website = el("td");
        const safeWebsite = safeHttpUrl(board.officialWebsite);
        if (safeWebsite) {
          const anchor = el("a", "", "Visit ↗");
          anchor.href = safeWebsite;
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
          website.append(anchor);
        } else website.textContent = "—";
        row.append(website);
        const actions = el("td");
        const controls = el("div", "admin-row-actions");
        controls.append(
          button("View", () =>
            location.assign(`/boards/${encodeURIComponent(board.slug)}`),
          ),
          button("Edit", () =>
            location.assign(`/admin/boards/${board._id}/edit`),
          ),
          button(board.active ? "Deactivate" : "Activate", async () => {
            try {
              await api(`/admin/boards/${board._id}`, {
                method: "PATCH",
                body: JSON.stringify({ active: !board.active }),
              });
              await renderBoards(page, filters);
            } catch (error) {
              showError(error);
            }
          }),
        );
        if (state.user.role === "SUPER_ADMIN")
          controls.append(
            button(
              "Delete permanently",
              async () => {
                if (
                  !window.confirm(
                    `Permanently delete board “${board.name}”? This is allowed only when no jobs, communities, resources or sources reference it. Otherwise deactivate it.`,
                  )
                )
                  return;
                try {
                  await api(`/admin/boards/${board._id}`, { method: "DELETE" });
                  await renderBoards(page, filters);
                } catch (error) {
                  showError(error);
                }
              },
              "is-danger",
            ),
          );
        actions.append(controls);
        row.append(actions);
        return row;
      });
      content.append(
        data.length
          ? table(
              [
                "Board Name",
                "Organization",
                "Category",
                "Active",
                "Published Jobs",
                "Official Website",
                "Actions",
              ],
              rows,
            )
          : empty("No boards found."),
        paginationBar(pagination, (nextPage) =>
          renderBoards(nextPage, filters),
        ),
      );
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  function safeHttpUrl(value) {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim()))
      return null;
    try {
      const parsed = new URL(value.trim());
      return ["http:", "https:"].includes(parsed.protocol) &&
        !parsed.username &&
        !parsed.password
        ? parsed.href
        : null;
    } catch {
      return null;
    }
  }
  async function renderBoardEditor(id) {
    const isNew = id === "new";
    const content = shell("boards");
    const heading = el("div", "admin-page-heading");
    heading.append(el("h1", "", isNew ? "Create Board" : "Edit Board"));
    content.append(heading);
    const feedback = el("div", "admin-form-feedback");
    let board = {};
    try {
      if (!isNew)
        ({ data: board } = await api(
          `/admin/boards/${encodeURIComponent(id)}`,
        ));
      const form = el("form", "admin-job-form");
      const name = field(form, "Name", "name", "text", board.name || "", {
        required: true,
      });
      const slug = field(form, "Slug", "slug", "text", board.slug || "");
      if (isNew && !slug.value)
        name.addEventListener("input", () => {
          slug.value = name.value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        });
      field(
        form,
        "Short description",
        "shortDescription",
        "text",
        board.shortDescription || "",
      );
      field(
        form,
        "Description",
        "description",
        "textarea",
        board.description || "",
        { rows: 5 },
      );
      field(
        form,
        "Organization",
        "organization",
        "text",
        board.organization || "",
      );
      field(form, "Category", "category", "text", board.category || "");
      field(
        form,
        "Official website",
        "officialWebsite",
        "url",
        board.officialWebsite || "",
      );
      field(
        form,
        "Official notification website",
        "officialNotificationWebsite",
        "url",
        board.officialNotificationWebsite || "",
      );
      field(form, "Location", "location", "text", board.location || "");
      field(form, "Logo/Icon reference", "icon", "text", board.icon || "", {
        placeholder: "Icon key or verified image URL",
      });
      const activeLabel = el("label", "admin-field");
      activeLabel.append(el("span", "", "Active"));
      const active = el("input");
      active.type = "checkbox";
      active.name = "active";
      active.checked = board.active !== false;
      activeLabel.append(active);
      form.append(activeLabel);
      const footer = el("div", "admin-form-actions");
      const save = el("button", "admin-button is-primary", "Save Board");
      save.type = "submit";
      footer.append(
        save,
        button("Cancel", () => location.assign("/admin/boards")),
      );
      form.append(footer, feedback);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        save.disabled = true;
        save.textContent = "Saving...";
        feedback.replaceChildren();
        const values = Object.fromEntries(new FormData(form));
        const payload = { name: values.name.trim(), active: active.checked };
        for (const key of [
          "slug",
          "shortDescription",
          "description",
          "organization",
          "category",
          "officialWebsite",
          "officialNotificationWebsite",
          "location",
          "icon",
        ]) {
          if (key === "slug") {
            if (values[key]?.trim()) payload[key] = values[key].trim();
          } else if (!isNew || values[key]?.trim())
            payload[key] = values[key]?.trim() || "";
        }
        try {
          const response = await api(
            isNew ? "/admin/boards" : `/admin/boards/${encodeURIComponent(id)}`,
            { method: isNew ? "POST" : "PATCH", body: JSON.stringify(payload) },
          );
          feedback.replaceChildren(notice("Saved successfully.", "is-success"));
          if (isNew) location.assign(`/admin/boards/${response.data._id}/edit`);
          else board = response.data;
        } catch (error) {
          feedback.replaceChildren(
            notice(
              error.status === 400 || error.status === 409
                ? `Validation error: ${error.message}`
                : error.message,
              "is-error",
            ),
          );
        } finally {
          save.disabled = false;
          save.textContent = "Save Board";
        }
      });
      content.append(form);
    } catch (error) {
      content.append(
        notice(
          error.status === 404 ? "Board not found." : error.message,
          "is-error",
        ),
      );
    }
  }
  async function renderAuthorAssets(type) {
    const savedSections = type === "SAVED_SECTION";
    const endpoint = savedSections
      ? "/author/saved-sections"
      : "/author/templates";
    const active = savedSections ? "sections" : "templates";
    const title = savedSections ? "Saved Sections" : "My Templates";
    const content = shell(active),
      heading = el("div", "admin-page-heading");
    heading.append(el("h1", "", title));
    heading.append(
      button(
        savedSections ? "Save Section" : "Save Template",
        () => openAssetDialog(),
        "is-primary",
      ),
    );
    content.append(
      heading,
      el(
        "p",
        "admin-muted",
        savedSections
          ? "Reusable content is private to your Author account."
          : "Templates store structure, not recruitment facts.",
      ),
    );
    try {
      const { data } = await api(endpoint);
      let templateBoards = [];
      if (!savedSections)
        try {
          templateBoards = (await api("/boards?limit=100")).data.filter(
            (x) => x.active !== false,
          );
        } catch {}
      if (!data.length)
        content.append(
          empty(
            savedSections
              ? "No saved sections yet."
              : "No personal templates yet.",
          ),
        );
      data.forEach((item) => {
        const card = el("article", "admin-asset-card");
        card.append(el("h2", "", item.name));
        if (item.description) card.append(el("p", "", item.description));
        const createdBy =
          item.author?.name ||
          (String(item.author?._id || item.author) === String(state.user._id)
            ? "You"
            : "Author");
        card.append(
          el(
            "p",
            "admin-muted",
            `Created by ${createdBy} · Updated ${formatDate(item.updatedAt)}`,
          ),
        );
        if (!savedSections) {
          const boardSelect = el("select", "admin-template-board");
          boardSelect.append(new Option("No board default", ""));
          templateBoards.forEach((x) =>
            boardSelect.append(new Option(x.name, String(x._id))),
          );
          boardSelect.value = item.data?.defaultBoardId || "";
          const boardLabel = el("label", "admin-field");
          boardLabel.append(el("span", "", "Default board"), boardSelect);
          card.append(boardLabel);
        }
        const canManage =
          savedSections ||
          state.user.role !== "AUTHOR" ||
          String(item.author?._id || item.author) === String(state.user._id);
        if (canManage)
          card.append(
            button("Edit", async () => {
              const name = prompt("Name", item.name);
              if (name === null) return;
              const description = prompt("Description", item.description || "");
              if (description === null) return;
              let nextData = item.data || {};
              if (savedSections) {
                const text = prompt(
                  "Section text",
                  nextData.blocks?.[0]?.data?.text || "",
                );
                if (text === null) return;
                nextData = { blocks: [{ type: "paragraph", data: { text } }] };
              }
              if (!savedSections) {
                const defaultBoardId =
                  card.querySelector(".admin-template-board")?.value || "";
                nextData = {
                  ...nextData,
                  ...(defaultBoardId
                    ? { defaultBoardId }
                    : { defaultBoardId: "" }),
                };
              }
              try {
                await api(`${endpoint}/${item._id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ name, description, data: nextData }),
                });
                await renderAuthorAssets(type);
              } catch (error) {
                content.prepend(notice(error.message, "is-error"));
              }
            }),
          );
        if (
          savedSections ||
          state.user.role !== "AUTHOR" ||
          String(item.author?._id || item.author) === String(state.user._id)
        )
          card.append(
            button(
              "Delete",
              async () => {
                if (
                  !confirm(
                    "Delete this template?\n\nThis will remove the reusable template. Existing jobs created from it will not be affected.",
                  )
                )
                  return;
                try {
                  await api(`${endpoint}/${item._id}`, { method: "DELETE" });
                  await renderAuthorAssets(type);
                } catch (error) {
                  content.prepend(notice(error.message, "is-error"));
                }
              },
              "is-danger",
            ),
          );
        content.append(card);
      });
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
    async function openAssetDialog() {
      const dialog = el("dialog", "admin-dialog"),
        form = el("form", "admin-job-form");
      form.append(
        el("h2", "", savedSections ? "Save Section" : "Save Template"),
      );
      field(form, "Name", "name", "text", "", { required: true });
      field(form, "Description", "description", "text", "");
      let defaultBoard;
      if (savedSections)
        field(form, "Section text", "sectionText", "textarea", "");
      else {
        defaultBoard = el("select");
        defaultBoard.name = "defaultBoardId";
        defaultBoard.append(new Option("No board default", ""));
        try {
          const { data: boards } = await api("/boards?limit=100");
          boards
            .filter((x) => x.active !== false)
            .forEach((x) =>
              defaultBoard.append(new Option(x.name, String(x._id))),
            );
        } catch {}
        const wrap = el("label", "admin-field");
        wrap.append(el("span", "", "Optional default board"), defaultBoard);
        form.append(wrap);
      }
      const feedback = el("div", "admin-form-feedback"),
        save = button("Save", null, "is-primary");
      save.type = "submit";
      form.append(
        save,
        button("Cancel", () => dialog.close()),
        feedback,
      );
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        const data = savedSections
          ? {
              blocks: [
                { type: "paragraph", data: { text: values.sectionText } },
              ],
            }
          : {
              contentDocument: [],
              defaultBoardId: values.defaultBoardId || "",
            };
        try {
          await api(endpoint, {
            method: "POST",
            body: JSON.stringify({
              name: values.name,
              description: values.description,
              data,
            }),
          });
          dialog.close();
          await renderAuthorAssets(type);
        } catch (error) {
          feedback.replaceChildren(notice(error.message, "is-error"));
        }
      });
      root.append(dialog);
      dialog.showModal();
      dialog.addEventListener("close", () => dialog.remove(), { once: true });
    }
  }
  async function renderAuthorResources() {
    const content = shell("resources"),
      heading = el("div", "admin-page-heading");
    heading.append(
      el("h1", "", "Preparation Resources"),
      button("Add Resource", () => openResourceDialog(), "is-primary"),
    );
    content.append(
      heading,
      el(
        "p",
        "admin-muted",
        "Resources are optional and reusable across jobs.",
      ),
    );
    if (state.resourceMessage) {
      content.append(notice(state.resourceMessage, "is-success"));
      state.resourceMessage = "";
    }
    try {
      const { data } = await api("/resources/mine?limit=100");
      if (!data.length) {
        content.append(empty("No resources created by you."));
        return;
      }
      const cards = el("div", "admin-resource-list");
      data.forEach((item) => {
        const card = el("article", "admin-resource-card");
        card.append(
          el("h2", "", item.title),
          el(
            "p",
            "admin-muted",
            `Type · ${(item.type || "").replaceAll("_", " ")}`,
          ),
        );
        const upload =
          item.sourceType === "UPLOAD" || Boolean(item.cloudinaryUrl);
        card.append(
          el(
            "p",
            "",
            "Source · " + (upload ? "Uploaded file" : "External link"),
          ),
        );
        if (upload && item.fileName)
          card.append(el("p", "", "File · " + item.fileName));
        card.append(
          el(
            "p",
            "",
            "Access · " +
              (upload
                ? item.accessMode === "DOWNLOAD"
                  ? "Download file"
                  : "Open in browser"
                : "External website"),
          ),
        );
        const actions = el("div", "admin-row-actions");
        actions.append(
          button("Edit", () => openResourceDialog(item)),
          button(
            "Remove",
            async () => {
              if (
                !confirm(
                  "Remove this resource?\n\nRemoving it from this recruitment will not delete a shared resource unless existing resource ownership rules explicitly require deletion.",
                )
              )
                return;
              try {
                await api(`/resources/${item._id}`, { method: "DELETE" });
                await renderAuthorResources();
              } catch (error) {
                content.prepend(notice(error.message, "is-error"));
              }
            },
            "is-danger",
          ),
        );
        card.append(actions);
        cards.append(card);
      });
      content.append(cards);
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  function openResourceDialog(item = {}) {
    const dialog = el("dialog", "admin-dialog"),
      form = el("form", "admin-job-form");
    form.append(el("h2", "", item._id ? "Edit Resource" : "Add Resource"));
    field(form, "Resource title", "title", "text", item.title || "", {
      required: true,
    });
    const typeWrap = el("label", "admin-field");
    typeWrap.append(el("span", "", "Resource type"));
    const type = el("select");
    type.name = "type";
    [
      ["Syllabus", "SYLLABUS"],
      ["Previous Paper / PYQ", "PYQ"],
      ["Mock Test", "MOCK_TEST"],
      ["Study Material", "STUDY_MATERIAL"],
      ["Other", "OTHER"],
      ["How to Apply (legacy)", "HOW_TO_APPLY"],
    ].forEach(([label, value]) => type.append(new Option(label, value)));
    type.value = item.type || "SYLLABUS";
    typeWrap.append(type);
    form.append(typeWrap);
    field(
      form,
      "Description (optional)",
      "description",
      "textarea",
      item.description || "",
    );
    const sourceWrap = el("fieldset", "admin-resource-source");
    sourceWrap.append(el("legend", "", "Source"));
    const sourceValue =
      item.sourceType || (item.cloudinaryUrl ? "UPLOAD" : "EXTERNAL_URL");
    const externalLabel = el("label", "admin-radio"),
      external = el("input");
    external.type = "radio";
    external.name = "sourceType";
    external.value = "EXTERNAL_URL";
    external.checked = sourceValue === "EXTERNAL_URL";
    externalLabel.append(external, el("span", "", "External Link"));
    const uploadLabel = el("label", "admin-radio"),
      upload = el("input");
    upload.type = "radio";
    upload.name = "sourceType";
    upload.value = "UPLOAD";
    upload.checked = sourceValue === "UPLOAD";
    uploadLabel.append(upload, el("span", "", "Upload File"));
    sourceWrap.append(externalLabel, uploadLabel);
    form.append(sourceWrap);
    const sourceFields = el("div", "admin-resource-source-fields");
    const urlInput = field(
      sourceFields,
      "Resource URL",
      "externalUrl",
      "url",
      item.externalUrl || item.url || "",
      { placeholder: "https://" },
    );
    urlInput.required = external.checked;
    sourceFields.append(
      el(
        "small",
        "field-help",
        "This opens the external website in a new tab. SetBGet cannot control whether the external website displays or downloads the content.",
      ),
    );
    const fileWrap = el("label", "admin-field");
    fileWrap.append(el("span", "", "Upload file"));
    const file = el("input");
    file.type = "file";
    file.accept = ".pdf,.png,.jpg,.jpeg,.webp";
    file.name = "file";
    if (item.fileName)
      fileWrap.append(el("small", "field-help", `Selected: ${item.fileName}`));
    fileWrap.append(file);
    sourceFields.append(fileWrap);
    const accessWrap = el("label", "admin-field");
    accessWrap.append(el("span", "", "When users click this resource"));
    const access = el("select");
    access.name = "accessMode";
    access.append(
      new Option("Open in browser", "INLINE"),
      new Option("Download file", "DOWNLOAD"),
    );
    access.value = item.accessMode || "INLINE";
    accessWrap.append(
      access,
      el(
        "small",
        "field-help",
        "Open in browser attempts to display the file when its format supports it.",
      ),
    );
    sourceFields.append(accessWrap);
    form.append(sourceFields);
    const updateSource = () => {
      const isUpload = upload.checked;
      urlInput.closest(".admin-field").hidden = isUpload;
      sourceFields.querySelector(".field-help").hidden = isUpload;
      fileWrap.hidden = !isUpload;
      accessWrap.hidden = !isUpload;
      urlInput.required = !isUpload;
    };
    form.addEventListener("change", updateSource);
    updateSource();
    const feedback = el("div", "admin-form-feedback"),
      actions = el("div", "admin-form-actions"),
      save = button("Save Resource", null, "is-primary");
    save.type = "submit";
    actions.append(
      button("Cancel", () => dialog.close()),
      save,
    );
    form.append(actions, feedback);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const isUpload = values.sourceType === "UPLOAD";
      const selectedFile = file.files[0];
      if (isUpload && !selectedFile && !item.cloudinaryUrl) {
        feedback.replaceChildren(
          notice("Choose a file to upload.", "is-error"),
        );
        return;
      }
      save.disabled = true;
      save.textContent = isUpload ? "Uploading…" : "Saving…";
      let cloudReceipt;
      try {
        if (isUpload && selectedFile) {
          const metadata = {
            title: values.title,
            type: values.type,
            description: values.description || "",
            fileName: selectedFile.name,
            accessMode: values.accessMode,
            ...(item._id ? { resourceId: item._id } : {}),
          };
          const intent = await api("/resources/upload-signature", {
            method: "POST",
            body: JSON.stringify(metadata),
          });
          const uploadBody = new FormData();
          uploadBody.set("file", selectedFile);
          uploadBody.set("api_key", intent.apiKey);
          uploadBody.set("signature", intent.signature);
          for (const [name, value] of Object.entries(intent.params))
            uploadBody.set(name, String(value));
          const cloudResponse = await fetch(intent.uploadUrl, {
            method: "POST",
            body: uploadBody,
          });
          const cloudResult = await cloudResponse.json().catch(() => ({}));
          if (!cloudResponse.ok || cloudResult.error)
            throw new Error(
              cloudResult.error?.message ||
                "Cloudinary could not store this file.",
            );
          cloudReceipt = {
            public_id: cloudResult.public_id,
            resource_type: cloudResult.resource_type,
            version: cloudResult.version,
            signature: cloudResult.signature,
          };
          await api("/resources/upload", {
            method: "POST",
            body: JSON.stringify({
              ...metadata,
              cloudinaryUpload: cloudReceipt,
            }),
          });
        } else if (isUpload && item._id) {
          await api(`/resources/${item._id}`, {
            method: "PATCH",
            body: JSON.stringify({
              title: values.title,
              type: values.type,
              description: values.description,
              sourceType: "UPLOAD",
              accessMode: values.accessMode,
            }),
          });
        } else {
          const payload = {
            title: values.title,
            type: values.type,
            description: values.description,
            sourceType: "EXTERNAL_URL",
            externalUrl: values.externalUrl,
            url: values.externalUrl,
          };
          await api(item._id ? `/resources/${item._id}` : "/resources", {
            method: item._id ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          });
        }
        state.resourceMessage =
          isUpload && selectedFile
            ? "Resource uploaded successfully."
            : "Resource saved successfully.";
        dialog.close();
        if (state.user.role === "AUTHOR") await renderAuthorResources();
        else await renderResources();
      } catch (error) {
        if (cloudReceipt) {
          await api("/resources/upload-abort", {
            method: "POST",
            body: JSON.stringify({ cloudinaryUpload: cloudReceipt }),
          }).catch(() => {});
        }
        feedback.replaceChildren(notice(error.message, "is-error"));
      } finally {
        save.disabled = false;
        save.textContent = "Save Resource";
      }
    });
    root.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
  }
  async function renderAuthorProfile() {
    const content = shell("profile"),
      heading = el("div", "admin-page-heading");
    heading.append(el("h1", "", "Author Profile"));
    content.append(heading);
    try {
      const { data } = await api("/users/me"),
        form = el("form", "admin-job-form");
      field(form, "Name", "name", "text", data.user.name || "");
      field(
        form,
        "Profile image URL",
        "profilePicture",
        "url",
        data.user.profilePicture || "",
      );
      field(form, "Education", "education", "text", data.user.education || "");
      field(form, "Location", "location", "text", data.user.location || "");
      const feedback = el("div", "admin-form-feedback"),
        save = el("button", "admin-button is-primary", "Save Profile");
      save.type = "submit";
      form.append(save, feedback);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await api("/users/me", {
            method: "PATCH",
            body: JSON.stringify(Object.fromEntries(new FormData(form))),
          });
          feedback.replaceChildren(notice("Profile saved.", "is-success"));
        } catch (error) {
          feedback.replaceChildren(notice(error.message, "is-error"));
        }
      });
      content.append(form);
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  async function renderPeople(kind, page = 1, filters = {}) {
    const title =
      kind === "authors"
        ? "Authors"
        : kind === "staff"
          ? "Administration Staff"
          : "Users";
    const content = shell(kind === "staff" ? "users" : kind);
    const heading = el("div", "admin-page-heading");
    heading.append(el("h1", "", title));
    if (kind === "staff")
      heading.append(
        button("Create Admin or Author", () => openStaffEditor(), "is-primary"),
      );
    if (kind === "users" && state.user.role === "SUPER_ADMIN")
      heading.append(button("Create user", createManagedUser, "is-primary"));
    content.append(heading);
    const form = el("form", "admin-filter-form"),
      search = el("input");
    search.type = "search";
    search.name = "q";
    search.placeholder = "Search name, email, phone";
    search.value = filters.q || "";
    const role = el("select");
    role.name = "role";
    [
      ["All roles", ""],
      ["User", "USER"],
      ["Author", "AUTHOR"],
      ["Admin", "ADMIN"],
      ["Super Admin", "SUPER_ADMIN"],
    ].forEach(([label, value]) => role.append(new Option(label, value)));
    role.value = filters.role || "";
    const active = el("select");
    active.name = "active";
    [
      ["All status", ""],
      ["Active", "true"],
      ["Inactive", "false"],
    ].forEach(([label, value]) => active.append(new Option(label, value)));
    active.value = filters.active || "";
    const submit = el("button", "admin-button", "Search");
    submit.type = "submit";
    form.append(search, role, active, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      renderPeople(kind, 1, Object.fromEntries(new FormData(form)));
    });
    content.append(form);
    try {
      const { data, pagination } = await api(
        `/admin/${kind}?${params({ ...filters, page, limit: 20 })}`,
      );
      const rows = data.map((person) => {
        const row = el("tr");
        row.append(
          el("td", "", person.name || "—"),
          el("td", "", person.email || "—"),
          el("td", "", person.phoneNumber || "—"),
          el("td", "", person.role),
          el("td", "", person.isEmailVerified ? "Verified" : "Unverified"),
          el("td", "", person.isPhoneVerified ? "Verified" : "Unverified"),
          el("td", "", person.isActive ? "Active" : "Inactive"),
          el("td", "", formatDate(person.createdAt)),
        );
        if (kind === "authors") {
          const counts = person.jobCounts || {};
          row.append(
            el(
              "td",
              "",
              String(Object.values(counts).reduce((a, b) => a + b, 0)),
            ),
            el("td", "", String(counts.DRAFT || 0)),
            el("td", "", String(counts.PENDING_REVIEW || 0)),
            el("td", "", String(counts.PUBLISHED || 0)),
          );
        }
        const td = el("td");
        const controls = el("div", "admin-row-actions");
        if (kind === "staff" && state.user.role === "SUPER_ADMIN") {
          controls.append(
            button("Edit", async () => {
              const name = window.prompt("Account name", person.name || "");
              if (name === null) return;
              const phoneNumber = window.prompt(
                "Mobile number (blank to clear)",
                person.phoneNumber || "",
              );
              if (phoneNumber === null) return;
              try {
                await api(`/admin/users/${person._id}`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    name: name.trim(),
                    phoneNumber: phoneNumber.trim(),
                  }),
                });
                renderPeople(kind, page, filters);
              } catch (error) {
                showError(error);
              }
            }),
            button("Reset password", async () => {
              if (
                !window.confirm(
                  `Send secure password reset instructions to ${person.email}?`,
                )
              )
                return;
              try {
                await api(`/admin/staff/${person._id}/password-reset`, {
                  method: "POST",
                });
                const target = root.querySelector(".admin-content");
                target?.prepend(
                  notice(
                    "Password reset instructions were sent.",
                    "is-success",
                  ),
                );
              } catch (error) {
                showError(error);
              }
            }),
          );
        }
        if (kind !== "staff" || state.user.role === "SUPER_ADMIN")
          controls.append(
            button(person.isActive ? "Deactivate" : "Activate", async () => {
              if (
                !window.confirm(
                  `${person.isActive ? "Deactivate" : "Activate"} ${person.name}? Existing content and history will be retained.`,
                )
              )
                return;
              try {
                await api(`/admin/users/${person._id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ isActive: !person.isActive }),
                });
                renderPeople(kind, page, filters);
              } catch (error) {
                showError(error);
              }
            }),
          );
        if (state.user.role === "SUPER_ADMIN" && kind === "authors")
          controls.prepend(
            button("Edit profile", async () => {
              const name = window.prompt("Author name", person.name || "");
              if (name === null) return;
              const phoneNumber = window.prompt(
                "Mobile number (blank to leave unchanged)",
                person.phoneNumber || "",
              );
              if (phoneNumber === null) return;
              try {
                await api(`/admin/users/${person._id}`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    name: name.trim(),
                    ...(phoneNumber.trim()
                      ? { phoneNumber: phoneNumber.trim() }
                      : {}),
                  }),
                });
                renderPeople(kind, page, filters);
              } catch (error) {
                showError(error);
              }
            }),
          );
        if (
          state.user.role === "SUPER_ADMIN" &&
          person.role !== "SUPER_ADMIN"
        ) {
          const select = el("select");
          ["USER", "AUTHOR", "ADMIN"].forEach((value) =>
            select.append(new Option(value, value)),
          );
          select.value = person.role;
          controls.append(
            select,
            button("Change role", async () => {
              if (
                !window.confirm(
                  `Change ${person.name}'s role to ${select.value}?`,
                )
              )
                return;
              try {
                await api(`/admin/users/${person._id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ role: select.value }),
                });
                renderPeople(kind, page, filters);
              } catch (error) {
                showError(error);
              }
            }),
          );
        }
        td.append(controls);
        row.append(td);
        return row;
      });
      const headers = [
        "Name",
        "Email",
        "Phone",
        "Role",
        "Email",
        "Phone",
        "Status",
        "Created",
        ...(kind === "authors"
          ? ["Jobs", "Drafts", "Review", "Published"]
          : []),
        "Actions",
      ];
      content.append(
        data.length
          ? table(headers, rows)
          : empty(`No ${title.toLowerCase()} found.`),
        paginationBar(pagination, (next) => renderPeople(kind, next, filters)),
      );
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  async function createManagedUser() {
    const name = window.prompt("New user name");
    if (name === null || !name.trim()) return;
    const email = window.prompt("New user email");
    if (email === null || !email.trim()) return;
    const phoneNumber = window.prompt(
      "Mobile number (optional, E.164 format)",
      "",
    );
    if (phoneNumber === null) return;
    if (
      !window.confirm(
        `Create user ${email.trim()} and send secure password setup instructions?`,
      )
    )
      return;
    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
        }),
      });
      renderPeople("users");
    } catch (error) {
      showError(error);
    }
  }
  function openStaffEditor() {
    const dialog = el("dialog", "admin-dialog"),
      form = el("form", "admin-job-form");
    field(form, "Name", "name", "text", "", { required: true });
    field(form, "Email", "email", "email", "", { required: true });
    const label = el("label", "admin-field");
    label.append(el("span", "", "Role"));
    const role = el("select");
    role.name = "role";
    role.append(new Option("Admin", "ADMIN"), new Option("Author", "AUTHOR"));
    label.append(role);
    form.append(
      label,
      el(
        "p",
        "admin-muted",
        "A password reset link will be sent to this email. No password is shown or stored in the browser.",
      ),
    );
    const feedback = el("div", "admin-form-feedback"),
      save = el("button", "admin-button is-primary", "Create account");
    save.type = "submit";
    form.append(
      save,
      button("Cancel", () => dialog.close()),
      feedback,
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (
        !window.confirm(
          `Create ${role.value} account and send password setup instructions?`,
        )
      )
        return;
      const values = Object.fromEntries(new FormData(form));
      try {
        await api("/admin/staff", {
          method: "POST",
          body: JSON.stringify(values),
        });
        dialog.close();
        renderPeople("staff");
      } catch (error) {
        feedback.replaceChildren(notice(error.message, "is-error"));
      }
    });
    dialog.append(form);
    root.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
  }
  async function renderCommunities(page = 1, filters = {}) {
    const content = shell("communities"),
      heading = el("div", "admin-page-heading");
    heading.append(
      el("h1", "", "Communities"),
      button("Create community", () => openCommunityEditor(), "is-primary"),
    );
    content.append(heading);
    const form = el("form", "admin-filter-form"),
      q = el("input");
    q.name = "q";
    q.placeholder = "Search community or exam";
    q.value = filters.q || "";
    const active = el("select");
    active.name = "active";
    active.append(
      new Option("All status", ""),
      new Option("Active", "true"),
      new Option("Inactive", "false"),
    );
    active.value = filters.active || "";
    const submit = el("button", "admin-button", "Search");
    submit.type = "submit";
    form.append(q, active, submit);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      renderCommunities(1, Object.fromEntries(new FormData(form)));
    });
    content.append(form);
    try {
      const { data, pagination } = await api(
        `/admin/communities?${params({ ...filters, page, limit: 20 })}`,
      );
      const rows = data.map((item) => {
        const row = el("tr");
        row.append(
          el("td", "", item.name),
          el("td", "", item.slug),
          el("td", "", item.board?.name || "—"),
          el("td", "", item.exam || "—"),
          el("td", "", item.active ? "Active" : "Inactive"),
          el("td", "", String(item.memberCount || 0)),
          el("td", "", String(item.postCount || 0)),
        );
        const td = el("td");
        td.append(
          button("Edit", () => openCommunityEditor(item)),
          button(item.active ? "Deactivate" : "Activate", async () => {
            try {
              await api(`/admin/communities/${item._id}`, {
                method: "PATCH",
                body: JSON.stringify({ active: !item.active }),
              });
              renderCommunities(page, filters);
            } catch (error) {
              showError(error);
            }
          }),
          button("Moderate reports", () => renderModeration(item._id)),
        );
        row.append(td);
        return row;
      });
      content.append(
        data.length
          ? table(
              [
                "Name",
                "Slug",
                "Board",
                "Exam",
                "Status",
                "Members",
                "Posts",
                "Actions",
              ],
              rows,
            )
          : empty("No communities found."),
        paginationBar(pagination, (next) => renderCommunities(next, filters)),
      );
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  function openCommunityEditor(item = {}) {
    const dialog = el("dialog", "admin-dialog"),
      form = el("form", "admin-job-form");
    field(form, "Name", "name", "text", item.name || "", { required: true });
    field(form, "Slug", "slug", "text", item.slug || "");
    field(form, "Exam", "exam", "text", item.exam || "");
    field(
      form,
      "Description",
      "description",
      "textarea",
      item.description || "",
      { rows: 4 },
    );
    const active = el("input");
    active.type = "checkbox";
    active.checked = item.active !== false;
    const label = el("label", "admin-field");
    label.append(el("span", "", "Active"), active);
    form.append(label);
    const feedback = el("div", "admin-form-feedback"),
      save = el("button", "admin-button is-primary", "Save community");
    save.type = "submit";
    form.append(
      save,
      button("Cancel", () => dialog.close()),
      feedback,
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const body = {
        name: values.name,
        slug: values.slug || undefined,
        exam: values.exam,
        description: values.description,
        active: active.checked,
      };
      try {
        await api(
          item._id ? `/admin/communities/${item._id}` : "/admin/communities",
          { method: item._id ? "PATCH" : "POST", body: JSON.stringify(body) },
        );
        dialog.close();
        renderCommunities();
      } catch (error) {
        feedback.replaceChildren(notice(error.message, "is-error"));
      }
    });
    dialog.append(form);
    root.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
  }
  async function renderModeration(communityId) {
    const content = shell("communities"),
      heading = el("div", "admin-page-heading");
    heading.append(el("h1", "", "Community Reports"));
    content.append(heading);
    try {
      const { data } = await api("/admin/reports?status=ALL&page=1&limit=50");
      const filtered = communityId
        ? data.filter(
            (x) =>
              String(
                x.targetContent?.community?._id ||
                  x.targetContent?.post?.community ||
                  "",
              ) === String(communityId),
          )
        : data;
      const rows = filtered.map((report) => {
        const row = el("tr");
        const target = report.targetContent;
        row.append(
          el("td", "", report.reporter?.name || "—"),
          el("td", "", report.targetType),
          el("td", "", report.reason),
          el("td", "", report.description || "—"),
          el(
            "td",
            "",
            target?.title ||
              target?.body ||
              "Target unavailable or already removed",
          ),
          el("td", "", report.status),
          el("td", "", formatDate(report.createdAt)),
          el("td", "", report.reviewedBy?.name || "—"),
          el("td", "", formatDate(report.reviewedAt)),
        );
        const td = el("td");
        if (report.status === "OPEN")
          [
            ["Dismiss", "DISMISSED"],
            ["Review", "REVIEWED"],
            ["Remove content", "ACTIONED"],
          ].forEach(([label, status]) =>
            td.append(
              button(label, async () => {
                if (
                  status === "ACTIONED" &&
                  !window.confirm(
                    "Remove this reported content from the community? The record will be retained.",
                  )
                )
                  return;
                try {
                  await api(`/admin/reports/${report._id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ status }),
                  });
                  renderModeration(communityId);
                } catch (error) {
                  showError(error);
                }
              }),
            ),
          );
        row.append(td);
        return row;
      });
      content.append(
        filtered.length
          ? table(
              [
                "Reporter",
                "Type",
                "Reason",
                "Description",
                "Reported content",
                "Status",
                "Created",
                "Reviewed by",
                "Reviewed",
                "Actions",
              ],
              rows,
            )
          : empty("No reports to review."),
      );
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  async function renderResources(page = 1, filters = {}) {
    const content = shell("resources"),
      heading = el("div", "admin-page-heading");
    heading.append(
      el("h1", "", "Resources"),
      button("Add resource", () => openResourceDialog(), "is-primary"),
    );
    content.append(heading);
    const form = el("form", "admin-filter-form"),
      q = el("input");
    q.name = "q";
    q.placeholder = "Search resources";
    q.value = filters.q || "";
    const type = el("select");
    type.name = "type";
    type.append(new Option("All types", ""));
    [
      "SYLLABUS",
      "PYQ",
      "MOCK_TEST",
      "STUDY_MATERIAL",
      "HOW_TO_APPLY",
      "OTHER",
    ].forEach((x) => type.append(new Option(x, x)));
    type.value = filters.type || "";
    const submit = el("button", "admin-button", "Search");
    submit.type = "submit";
    form.append(q, type, submit);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      renderResources(1, Object.fromEntries(new FormData(form)));
    });
    content.append(form);
    try {
      const { data, pagination } = await api(
        `/admin/resources?${params({ ...filters, page, limit: 20 })}`,
      );
      const rows = data.map((item) => {
        const row = el("tr");
        row.append(
          el("td", "", item.title),
          el("td", "", item.type),
          el("td", "", item.sourceType || "—"),
          el("td", "", item.board?.name || "—"),
          el("td", "", item.author?.name || "—"),
          el("td", "", item.job?.title || "—"),
          el("td", "", item.active ? "Active" : "Inactive"),
        );
        const td = el("td");
        td.append(
          button("Edit", () => openResourceDialog(item)),
          button(item.active ? "Deactivate" : "Activate", async () => {
            try {
              await api(`/admin/resources/${item._id}/active`, {
                method: "PATCH",
                body: JSON.stringify({ active: !item.active }),
              });
              renderResources(page, filters);
            } catch (error) {
              showError(error);
            }
          }),
        );
        if (state.user.role === "SUPER_ADMIN")
          td.append(
            button(
              "Delete permanently",
              async () => {
                if (
                  !window.confirm(
                    `Permanently delete resource “${item.title}”? Deletion is allowed only when no job or community references it and it has no externally stored file. Otherwise deactivate it to preserve references and files.`,
                  )
                )
                  return;
                try {
                  await api(`/admin/resources/${item._id}`, {
                    method: "DELETE",
                  });
                  renderResources(page, filters);
                } catch (error) {
                  showError(error);
                }
              },
              "is-danger",
            ),
          );
        row.append(td);
        return row;
      });
      content.append(
        data.length
          ? table(
              [
                "Title",
                "Type",
                "Source",
                "Board",
                "Author",
                "Job",
                "Status",
                "Actions",
              ],
              rows,
            )
          : empty("No resources found."),
        paginationBar(pagination, (next) => renderResources(next, filters)),
      );
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  async function renderTemplates(page = 1) {
    const content = shell("templates"),
      heading = el("div", "admin-page-heading");
    heading.append(
      el("h1", "", "Templates"),
      button("Create template", () => openAdminTemplateEditor(), "is-primary"),
    );
    content.append(heading);
    try {
      const { data, pagination } = await api(
        `/admin/templates?page=${page}&limit=20`,
      );
      const rows = data.map((item) => {
        const row = el("tr");
        row.append(
          el("td", "", item.name),
          el("td", "", item.description || "—"),
          el("td", "", item.author?.name || "—"),
          el("td", "", item.data?.defaultBoardId || "—"),
          el("td", "", formatDate(item.createdAt)),
          el("td", "", formatDate(item.updatedAt)),
        );
        const td = el("td");
        td.append(button("Edit", () => openAdminTemplateEditor(item)));
        const canDelete =
          state.user.role === "SUPER_ADMIN" ||
          String(item.author?._id || item.author) === String(state.user._id);
        if (canDelete)
          td.append(
            button(
              "Delete permanently",
              async () => {
                if (
                  !window.confirm(
                    `Delete template “${item.name}”?\n\nThis permanently removes the reusable template. Existing jobs created from it will not be affected.`,
                  )
                )
                  return;
                try {
                  await api(`/admin/templates/${item._id}`, {
                    method: "DELETE",
                  });
                  renderTemplates(page);
                } catch (error) {
                  showError(error);
                }
              },
              "is-danger",
            ),
          );
        row.append(td);
        return row;
      });
      content.append(
        data.length
          ? table(
              [
                "Name",
                "Description",
                "Created by",
                "Default board",
                "Created",
                "Updated",
                "Actions",
              ],
              rows,
            )
          : empty("No templates found."),
        paginationBar(pagination, renderTemplates),
      );
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  async function openAdminTemplateEditor(item = {}) {
    const dialog = el("dialog", "admin-dialog"),
      form = el("form", "admin-job-form"),
      isEdit = Boolean(item._id);
    form.append(el("h2", "", isEdit ? "Edit template" : "Create template"));
    field(form, "Name", "name", "text", item.name || "", { required: true });
    field(
      form,
      "Description",
      "description",
      "textarea",
      item.description || "",
      { rows: 3 },
    );
    const sections = field(
      form,
      "Sections (one per line)",
      "sections",
      "textarea",
      (item.data?.sections || []).join("\n"),
      { rows: 7 },
    );
    const boardWrap = el("label", "admin-field");
    boardWrap.append(el("span", "", "Optional default board"));
    const board = el("select");
    board.name = "defaultBoardId";
    board.append(new Option("No board default", ""));
    try {
      const { data: boards } = await api("/boards?limit=100");
      boards
        .filter((value) => value.active !== false)
        .forEach((value) =>
          board.append(new Option(value.name, String(value._id))),
        );
    } catch {}
    board.value = item.data?.defaultBoardId || "";
    boardWrap.append(board);
    form.append(boardWrap);
    const feedback = el("div", "admin-form-feedback"),
      save = button(
        isEdit ? "Save changes" : "Create template",
        null,
        "is-primary",
      );
    save.type = "submit";
    form.append(
      save,
      button("Cancel", () => dialog.close()),
      feedback,
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form)),
        data = {
          ...(item.data || {}),
          sections: splitList(values.sections),
          defaultBoardId: values.defaultBoardId || "",
        };
      try {
        await api(
          isEdit ? `/author/templates/${item._id}` : "/author/templates",
          {
            method: isEdit ? "PATCH" : "POST",
            body: JSON.stringify({
              name: values.name,
              description: values.description,
              data,
            }),
          },
        );
        dialog.close();
        renderTemplates(isEdit ? state.page : 1);
      } catch (error) {
        feedback.replaceChildren(notice(error.message, "is-error"));
      } finally {
        save.disabled = false;
        save.textContent = "Save Resource";
      }
    });
    root.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
  }
  async function renderFAQs() {
    const content = shell("faqs"),
      heading = el("div", "admin-page-heading");
    heading.append(
      el("h1", "", "FAQs"),
      button("Add FAQ", () => openFaqEditor(), "is-primary"),
    );
    content.append(heading);
    try {
      const { data } = await api("/faqs?active=false&page=1&limit=100");
      const rows = data.map((item) => {
        const row = el("tr");
        row.append(
          el("td", "", String(item.order)),
          el("td", "", item.question),
          el("td", "", item.answer),
          el("td", "", item.active ? "Active" : "Inactive"),
        );
        const td = el("td");
        td.append(
          button("Edit", () => openFaqEditor(item)),
          button(item.active ? "Deactivate" : "Activate", async () => {
            try {
              await api(`/faqs/${item._id}`, {
                method: "PATCH",
                body: JSON.stringify({ active: !item.active }),
              });
              renderFAQs();
            } catch (error) {
              showError(error);
            }
          }),
        );
        if (state.user.role === "SUPER_ADMIN")
          td.append(
            button(
              "Delete permanently",
              async () => {
                if (
                  !window.confirm(`Permanently delete FAQ “${item.question}”?`)
                )
                  return;
                try {
                  await api(`/admin/faqs/${item._id}`, { method: "DELETE" });
                  renderFAQs();
                } catch (error) {
                  showError(error);
                }
              },
              "is-danger",
            ),
          );
        row.append(td);
        return row;
      });
      content.append(
        data.length
          ? table(["Order", "Question", "Answer", "Status", "Actions"], rows)
          : empty("No FAQs yet."),
      );
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  function openFaqEditor(item = {}) {
    const dialog = el("dialog", "admin-dialog"),
      form = el("form", "admin-job-form");
    field(form, "Question", "question", "text", item.question || "", {
      required: true,
    });
    field(form, "Answer", "answer", "textarea", item.answer || "", {
      required: true,
      rows: 5,
    });
    field(form, "Order", "order", "number", item.order ?? 0);
    const active = el("input");
    active.type = "checkbox";
    active.checked = item.active !== false;
    const label = el("label", "admin-field");
    label.append(el("span", "", "Active"), active);
    form.append(label);
    const feedback = el("div", "admin-form-feedback"),
      save = el("button", "admin-button is-primary", "Save FAQ");
    save.type = "submit";
    form.append(
      save,
      button("Cancel", () => dialog.close()),
      feedback,
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = Object.fromEntries(new FormData(form));
      const body = {
        question: value.question,
        answer: value.answer,
        order: Number(value.order || 0),
        active: active.checked,
      };
      try {
        await api(item._id ? `/faqs/${item._id}` : "/faqs", {
          method: item._id ? "PATCH" : "POST",
          body: JSON.stringify(body),
        });
        dialog.close();
        renderFAQs();
      } catch (error) {
        feedback.replaceChildren(notice(error.message, "is-error"));
      }
    });
    dialog.append(form);
    root.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
  }
  async function renderNotifications() {
    const content = shell("notifications"),
      heading = el("div", "admin-page-heading");
    heading.append(
      el("h1", "", "Notifications"),
      button(
        "Create notification",
        () => openNotificationEditor(),
        "is-primary",
      ),
    );
    content.append(heading);
    try {
      const { data } = await api("/admin/notifications");
      const rows = data.map((item) => {
        const row = el("tr");
        row.append(
          el("td", "", item.title),
          el("td", "", item.type),
          el("td", "", item.message || "—"),
          el("td", "", item.published ? "Published" : "Draft"),
          el("td", "", formatDate(item.createdAt)),
        );
        const td = el("td");
        td.append(
          button("Edit", () => openNotificationEditor(item)),
          button(item.published ? "Unpublish" : "Publish", async () => {
            try {
              await api(`/admin/notifications/${item._id}`, {
                method: "PATCH",
                body: JSON.stringify({ published: !item.published }),
              });
              renderNotifications();
            } catch (error) {
              showError(error);
            }
          }),
        );
        if (state.user.role === "SUPER_ADMIN" && !item.published)
          td.append(
            button(
              "Delete permanently",
              async () => {
                if (
                  !window.confirm(
                    `Permanently delete notification draft “${item.title}”?`,
                  )
                )
                  return;
                try {
                  await api(`/admin/notifications/${item._id}`, {
                    method: "DELETE",
                  });
                  renderNotifications();
                } catch (error) {
                  showError(error);
                }
              },
              "is-danger",
            ),
          );
        row.append(td);
        return row;
      });
      content.append(
        data.length
          ? table(
              ["Title", "Type", "Message", "State", "Created", "Actions"],
              rows,
            )
          : empty("No global notifications."),
      );
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  function openNotificationEditor(item = {}) {
    const dialog = el("dialog", "admin-dialog"),
      form = el("form", "admin-job-form");
    field(form, "Title", "title", "text", item.title || "", { required: true });
    field(form, "Type", "type", "text", item.type || "GENERAL", {
      required: true,
    });
    field(form, "Message", "message", "textarea", item.message || "", {
      rows: 4,
    });
    const feedback = el("div", "admin-form-feedback"),
      save = el("button", "admin-button is-primary", "Save draft");
    save.type = "submit";
    form.append(
      save,
      button("Cancel", () => dialog.close()),
      feedback,
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      try {
        if (item._id)
          await api(`/admin/notifications/${item._id}`, {
            method: "PATCH",
            body: JSON.stringify(values),
          });
        else
          await api("/admin/notifications", {
            method: "POST",
            body: JSON.stringify(values),
          });
        dialog.close();
        renderNotifications();
      } catch (error) {
        feedback.replaceChildren(notice(error.message, "is-error"));
      }
    });
    dialog.append(form);
    root.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
  }
  async function renderAudit() {
    const content = shell("audit"),
      heading = el("div", "admin-page-heading");
    heading.append(el("h1", "", "Audit Log"));
    content.append(heading);
    try {
      const { data, pagination } = await api(
        `/admin/audit-log?page=${state.page}&limit=30`,
      );
      const rows = data.map((item) => {
        const row = el("tr");
        row.append(
          el("td", "", formatDate(item.createdAt)),
          el("td", "", item.actor?.name || "—"),
          el("td", "", item.actorRole || "—"),
          el("td", "", item.action),
          el("td", "", item.targetType || "—"),
          el("td", "", item.targetId || "—"),
          el("td", "", item.summary || "—"),
        );
        return row;
      });
      content.append(
        data.length
          ? table(
              ["When", "Actor", "Role", "Action", "Target", "ID", "Summary"],
              rows,
            )
          : empty("No admin activity recorded."),
        paginationBar(pagination, (next) => {
          state.page = next;
          renderAudit();
        }),
      );
    } catch (error) {
      content.append(notice(error.message, "is-error"));
    }
  }
  async function renderRoute() {
    const p = state.path;
    const admin = ["ADMIN", "SUPER_ADMIN"].includes(state.user.role);
    const author = state.user.role === "AUTHOR";
    const authorHome = p === "/admin";
    const authorJobs =
      p === "/admin/jobs" ||
      p === "/admin/jobs/new" ||
      [
        "/admin/jobs/drafts",
        "/admin/jobs/pending",
        "/admin/jobs/rejected",
        "/admin/jobs/published",
      ].includes(p) ||
      /^\/admin\/jobs\/[^/]+\/edit$/.test(p);
    const authorWorkspace = [
      "/admin/resources",
      "/admin/templates",
      "/admin/saved-sections",
      "/admin/profile",
    ].includes(p);
    if (!admin && !(author && (authorHome || authorJobs || authorWorkspace))) {
      gate(
        403,
        "403 · Access denied",
        "This page is available only to authorized administrators or authors for their own jobs.",
      );
      return;
    }
    if (p === "/admin") {
      await renderDashboard();
    } else if (
      [
        "/admin/jobs",
        "/admin/jobs/review",
        "/admin/jobs/drafts",
        "/admin/jobs/pending",
        "/admin/jobs/rejected",
        "/admin/jobs/published",
      ].includes(p)
    )
      await renderJobs(1, {});
    else if (p === "/admin/jobs/new") await renderEditor("new");
    else if (/^\/admin\/jobs\/[^/]+\/edit$/.test(p))
      await renderEditor(decodeURIComponent(p.split("/")[3]));
    else if (p === "/admin/resources" && author) await renderAuthorResources();
    else if (p === "/admin/resources" && admin) await renderResources();
    else if (p === "/admin/templates" && author)
      await renderAuthorAssets("TEMPLATE");
    else if (p === "/admin/templates" && admin) await renderTemplates();
    else if (p === "/admin/saved-sections" && author)
      await renderAuthorAssets("SAVED_SECTION");
    else if (p === "/admin/profile" && author) await renderAuthorProfile();
    else if (p === "/admin/job-discovery") await renderDiscoveries();
    else if (p === "/admin/recruitment-sources") await renderSources();
    else if (p === "/admin/boards") await renderBoards();
    else if (p === "/admin/users") await renderPeople("users");
    else if (p === "/admin/authors") await renderPeople("authors");
    else if (p === "/admin/communities") await renderCommunities();
    else if (p === "/admin/notifications") await renderNotifications();
    else if (p === "/admin/faqs") await renderFAQs();
    else if (p === "/admin/audit-log" && state.user.role === "SUPER_ADMIN")
      await renderAudit();
    else if (p === "/admin/staff" && state.user.role === "SUPER_ADMIN")
      await renderPeople("staff");
    else if (p === "/admin/boards/new") await renderBoardEditor("new");
    else if (/^\/admin\/boards\/[^/]+\/edit$/.test(p))
      await renderBoardEditor(decodeURIComponent(p.split("/")[3]));
    else {
      if (p === "/admin/audit-log" || p === "/admin/staff")
        gate(
          403,
          "403 · Access denied",
          "This area is available only to Super Admins.",
        );
      else
        gate(
          404,
          "404 · Page not found",
          "This admin page is not part of the current dashboard foundation.",
        );
    }
  }
  function navigate(path) {
    if (!path.startsWith("/admin")) return;
    const normalized = path.replace(/\/+$/, "") || "/admin";
    if (normalized === state.path) return;
    history.pushState({}, "", normalized);
    state.path = normalized;
    state.page = 1;
    state.filters = {};
    renderRoute();
  }
  window.addEventListener("popstate", () => {
    state.path = window.location.pathname.replace(/\/+$/, "") || "/admin";
    state.page = 1;
    state.filters = {};
    if (state.user) renderRoute();
  });
  async function start() {
    state.path = window.location.pathname.replace(/\/+$/, "") || "/admin";
    root.replaceChildren(el("main", "admin-gate", "Loading..."));
    try {
      const { data } = await api("/users/me");
      state.user = data.user;
      await renderRoute();
    } catch (error) {
      if (error.status === 401) {
        gate(401, "Sign in required", "Please sign in to create a job.");
      } else if (error.status) {
        gate(403, "403 · Access denied", "Your account cannot open this page.");
      } else {
        gate(500, "Unable to load your account", "Please try again.");
      }
    }
  }
  start();
})();
