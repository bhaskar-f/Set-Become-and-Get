(() => {
  const i18n = window.SetBGetI18n;
  const t = (key, values) => window.SetBGetI18n?.t(key, values) ?? key;
  const formatDate = (value, options) =>
    i18n?.formatDate(value, options) || new Date(value).toLocaleDateString();
  const apiError = (error, fallbackKey) => {
    if (error?.code || error?.status) {
      const key = i18n?.errorKey(error);
      const translated = key ? t(key) : key;
      if (translated && translated !== key) return translated;
    }
    return error?.message || t(fallbackKey);
  };
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const root = document.querySelector("#publicPageRoot");
  const routePaths = ["/jobs", "/communities", "/notifications", "/faqs", "/dashboard", "/dashboard/saved", "/dashboard/applications", "/dashboard/notifications", "/profile", "/settings", "/services", "/services/preparation", "/services/eligibility", "/services/tracker", "/boards", "/privacy", "/terms", "/about", "/contact"];
  const isCommunityDetail = path.startsWith("/communities/");
  const userWorkspaceRoute = path === "/dashboard" || path.startsWith("/dashboard/") || path === "/profile" || path === "/settings";
  if (!root || (!routePaths.includes(path) && !path.startsWith("/dashboard/") && !isCommunityDetail)) return;
  if (["/jobs", "/boards", "/services/preparation"].includes(path))
    document.addEventListener("setbget:localechange", () => location.reload());
  root.hidden = false;
  document.body.classList.add("public-route");
  if(userWorkspaceRoute)document.body.classList.add("user-workspace-route");
  const mobilePublicRoute = !userWorkspaceRoute && (
    path === "/jobs" || path === "/communities" || path.startsWith("/communities/") ||
    path === "/services" || path.startsWith("/services/") || ["/privacy", "/terms", "/about", "/contact"].includes(path)
  );
  if (mobilePublicRoute) {
    document.body.classList.add("public-mobile-shell");
    const mobileNav = document.querySelector("#mobileBottomNav");
    const active = path === "/jobs" ? "navigation.jobs"
      : path === "/communities" || path.startsWith("/communities/") ? "navigation.communities"
        : path.startsWith("/services") ? "navigation.services" : "navigation.home";
    const items = [["navigation.home", "/", "home"], ["navigation.jobs", "/jobs", "work"], ["navigation.communities", "/communities", "people"], ["navigation.services", "/services", "list"]];
    if (mobileNav) mobileNav.replaceChildren(...items.map(([label, href, symbol]) => {
      const link = document.createElement("a");
      const translated = t(label);
      link.className = `mobile-bottom-nav-link${label === active ? " is-active" : ""}`;
      link.href = href;
      if (label === active) link.setAttribute("aria-current", "page");
      const text = document.createElement("span"); text.textContent = translated; text.dataset.i18n = label;
      link.append(icon(symbol), text);
      return link;
    }));
    const account = document.querySelector("#loginBtn");
    if (account) {
      const label = document.createElement("span"); label.textContent = t("navigation.signIn"); label.dataset.i18n = "navigation.signIn";
      account.replaceChildren(icon("account", "home-account-icon"), label);
      account.dataset.i18nAriaLabel = "navigation.signIn";
      account.setAttribute("aria-label", t("navigation.signIn"));
    }
  }
  document.addEventListener("click", event => { const menu = document.querySelector(".services-menu"); if (menu?.open && !menu.contains(event.target)) menu.open = false; });
  document.addEventListener("keydown", event => { if (event.key === "Escape") { const menu = document.querySelector(".services-menu"); if (menu) menu.open = false; } });
  const statuses = ["NOT_APPLIED", "APPLIED", "ADMIT_CARD", "EXAM_SCHEDULED", "EXAM_COMPLETED", "RESULT", "INTERVIEW", "SELECTED", "REJECTED"];
  const add = (parent, tag, cls, text) => { const item = document.createElement(tag); if (cls) item.className = cls; if (text !== undefined) item.textContent = text; parent.append(item); return item; };
  const initialLoading = add(root, "p", "public-page-loading", t("loading.publicPage")); initialLoading.dataset.i18n = "loading.publicPage"; initialLoading.setAttribute("role", "status");
  const link = (parent, href, text, cls = "") => { const a = add(parent, "a", cls, text); a.href = href; return a; };
  const button = (parent, text, onClick, cls = "") => { const b = add(parent, "button", cls, text); b.type = "button"; b.addEventListener("click", onClick); return b; };
  const queryString = values => { const params = new URLSearchParams(); Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); }); return params.toString(); };
  const apiPage = path => apiResponse(path);
  function collection(value, endpoint) { if (!Array.isArray(value)) { console.error(`Unexpected collection payload from ${endpoint}.`); throw new Error("This content could not be loaded right now. Please try again later."); } return value; }
  function pageCollection(response, endpoint) { if (!response || !Array.isArray(response.data)) { console.error(`Unexpected paginated collection payload from ${endpoint}.`); throw new Error("This content could not be loaded right now. Please try again later."); } return { items: response.data, pagination: response.pagination }; }
  const apiCollection = async endpoint => collection(await api(endpoint), endpoint);
  function page(title, description) {
    root.replaceChildren();
    const wrap = add(root, "div", "public-page"); add(wrap, "p", "public-eyebrow", "SETBGET"); add(wrap, "h1", "", title); if (description) add(wrap, "p", "public-intro", description);
    const canonical = `https://www.setbget.in${path}`;
    document.title = `${title} | SetBGet`;
    const setMeta = (selector, attribute, value, create) => {
      let meta = document.head.querySelector(selector);
      if (!meta && create) { meta = document.createElement(create.tag); meta.setAttribute(create.key, create.keyValue); document.head.append(meta); }
      if (meta) meta.setAttribute(attribute, value);
    };
    setMeta('meta[name="description"]', "content", description || title);
    setMeta('link[rel="canonical"]', "href", canonical, { tag: "link", key: "rel", keyValue: "canonical" });
    setMeta('meta[name="robots"]', "content", (location.search || userWorkspaceRoute || path === "/services/tracker" || path === "/notifications") ? "noindex, follow" : "index, follow", { tag: "meta", key: "name", keyValue: "robots" });
    setMeta('meta[property="og:title"]', "content", document.title, { tag: "meta", key: "property", keyValue: "og:title" });
    setMeta('meta[property="og:description"]', "content", description || title, { tag: "meta", key: "property", keyValue: "og:description" });
    setMeta('meta[property="og:url"]', "content", canonical, { tag: "meta", key: "property", keyValue: "og:url" });
    setMeta('meta[name="twitter:title"]', "content", document.title, { tag: "meta", key: "name", keyValue: "twitter:title" });
    setMeta('meta[name="twitter:description"]', "content", description || title, { tag: "meta", key: "name", keyValue: "twitter:description" });
    setMeta('meta[name="twitter:url"]', "content", canonical, { tag: "meta", key: "name", keyValue: "twitter:url" });
    return wrap;
  }
  function section(parent, title, href, linkText = "Explore all") { const block = add(parent, "section", "public-section"); const head = add(block, "div", "public-section-heading"); add(head, "h2", "", title); link(head, href, `${linkText} →`, "public-text-link"); return block; }
  function notice(parent, text, kind = "") { return add(parent, "p", `public-notice ${kind}`, text); }
  const legalContent = {
    "/privacy": {
      title: "Privacy Policy", description: "What information SetBGet handles and how it is used in the current application.",
      sections: [
        ["1. About this policy", ["SetBGet provides job discovery, recruitment information, preparation resources, and related account features. This policy describes data handling visible in the current application code. It does not establish business practices that cannot be verified from that code."]],
        ["2. Information associated with an account", ["The account model can store your name, email address, phone number, profile picture, date of birth, education details, location, preferred job categories, preferred boards or exams, account role, email and phone verification status, active status, Google account identifier, and account timestamps. Some older profile fields remain supported for compatibility.", "Password accounts store a bcrypt password hash, not the original password. Authentication records also include hashed refresh-token and one-time verification/reset-token values and their expiry times; raw one-time tokens are sent in links rather than stored as long-lived plaintext values."]],
        ["3. Google Sign-In and Google user data", ["When you choose Google Sign-In, SetBGet requests the Google profile and email scopes. The OAuth callback receives a Google subject identifier, email and its verification status, display name, and profile photo when supplied. SetBGet requires a verified email. It uses the Google identifier and verified email to find or link an account, and can use the name and photo when creating a new account. The identifier, email, name, and profile picture may be stored in the SetBGet user record. Existing account roles, passwords, and profile fields are not replaced by Google sign-in.", "The application uses this Google data for sign-in, account creation/linking, and account identity. The OAuth code does not request Gmail, Drive, or other Google API access, and does not persist Google access or refresh tokens. No advertising or ad-targeting integration using Google account data was found in the application code. Google identity information is not sent to unrelated APIs by the application code; Google processes sign-in itself, and SetBGet stores account data in its configured database. Business practices outside this codebase cannot be determined from source inspection."]],
        ["4. Profile, preferences, and personalization", ["Profile fields and preferences are used to display account details and personalize job recommendations. Job matching uses available profile education, location, job-category, and board preferences together with published job information. You can edit profile and notification preferences in the account workspace."]],
        ["5. Saved jobs, applications, and notifications", ["For signed-in users, SetBGet stores saved-job references and application-tracker records. Tracker records may include status, dates, result, notes, and reminder date. The application stores website notification records and preferences for website, email, job matches, deadline reminders, and announcements. Email delivery is configured server-side; a notification may include information needed to deliver that message."]],
        ["6. Communities and submitted content", ["Community records can include membership and role, posts, comments, reactions, and reports. Posts and comments are associated with their author account and may be visible to other community users. Reports include the reporting account, the reported content, reason, review status, and staff review details. Administrators can review reports, and authorized users can manage their own posts and comments subject to the route permissions."]],
        ["7. Jobs and recruitment information", ["SetBGet stores recruitment notices, source references, job details, application links, and review/publishing records. The application includes automated discovery records, but discovered notices are held for review and are not automatically published. Job and eligibility information is informational; users should confirm current requirements and dates with the recruiting organization."]],
        ["8. Resources and uploads", ["Resource records can contain a title, type, description, external URL or uploaded-file URL, access mode, original file name, MIME type, size, related board/job/community, author, and timestamps. The upload endpoint accepts PDF, PNG, JPEG, and WebP files up to the configured upload limit and sends accepted files to Cloudinary. Active resource links are returned by public resource endpoints; do not assume an uploaded resource is private. Authors can manage their own resources and authorized staff can manage resources. External URLs are stored separately and are not uploaded by SetBGet."]],
        ["9. Cookies and authentication", ["SetBGet uses HTTP-only access and refresh cookies for authentication. In production the cookies are Secure and use SameSite=None for credentialed requests between the separate frontend and backend; each cookie is scoped to the API host and its required path. The cookies authenticate requests and refresh sessions; authentication JWTs are not stored in browser local storage."]],
        ["10. Service providers", ["The application uses Google for Google sign-in, MongoDB through the server's configured MongoDB connection for application records, Cloudinary for uploaded resource files, and a server-configured Nodemailer/SMTP transport for authentication and notification email. Twilio is integrated for phone OTP and optional SMS notifications when configured; phone sign-in endpoints are unavailable in production. Twilio credentials are not required for email or Google sign-in. The project identifies Render as its current deployment host, while database hosting depends on the operator's MongoDB URI."]],
        ["11. Staff access", ["The application has USER, AUTHOR, ADMIN, and SUPER_ADMIN roles. Route authorization permits staff access to the records needed for their assigned management tasks; authors are restricted to their own managed content where the routes enforce ownership, and administration routes are role-restricted. The code cannot describe individual staff practices outside the application."]],
        ["12. Storage and retention", ["Application records are stored in the configured MongoDB database. Uploaded resource files are stored with Cloudinary when that provider is configured. The application records creation/update timestamps, but no general retention schedule is defined in the code. Deactivated user accounts are marked inactive and their email is replaced with an invalid-local address; this is not permanent erasure of the account record. Staff audit records store actor and role, action, target identifier, summary, and optional metadata. Other record retention is feature-specific and no overall retention period is configured."]],
        ["13. Account controls and deletion", ["Users can edit their profile, change a verified email address, change a password, adjust notification preferences, and deactivate an account. Deactivation signs the user out, removes saved jobs, application-tracker entries, community memberships, and personal notifications, and retains an inactive account record. Other profile fields, Google account identifier, notification preferences, and authored community content are not deleted by this operation, so it does not permanently erase every record associated with the account. The application does not provide a data-export feature."]],
        ["14. Children", ["The codebase does not specify an intended minimum age or a process for handling children's data. The operator must decide and publish an age policy before production use."]],
        ["15. Changes and contact", ["This page may be updated when SetBGet's actual data handling changes. A public privacy contact address has not been configured in the project. The operator must provide a monitored contact method before production publication."]]
      ]
    },
    "/terms": {
      title: "Terms of Service", description: "Terms for using SetBGet's job discovery, preparation, resource, and community features.",
      sections: [
        ["1. Using SetBGet", ["SetBGet is an informational job-discovery and job-preparation platform. Use of the site means using the public job, board, preparation-resource, account, and community features described here. These terms should be reviewed and approved by the service operator before production publication."]],
        ["2. Accounts and security", ["Some features require an account. Registration assigns the USER role; elevated AUTHOR, ADMIN, and SUPER_ADMIN access is controlled by the application. Keep sign-in credentials private, use accurate account information, and contact the operator through a published contact channel if you believe an account has been used without permission. The site supports email/password and Google sign-in; phone sign-in is unavailable in production."]],
        ["3. User conduct and content", ["Community users can create posts and comments, react to posts, join communities, and submit reports. Keep submissions relevant to the community and do not submit content you are not authorized to share, unlawful material, threats, spam, or attempts to disrupt the service. Posts and comments may be removed and reports may be reviewed by moderators or administrators under the application's moderation features."]],
        ["4. Jobs and official recruitment sources", ["SetBGet is not a government recruiting authority. It presents recruitment information and links to recruiting organizations' websites. SetBGet records job details, source URLs, and application URLs, and may show information supplied by sources or entered by authorized authors and staff. Details, eligibility, deadlines, fees, vacancies, and application instructions can change. Confirm them in the current official notification and apply through the recruiting organization's official site."]],
        ["5. Discovery and publication", ["Automated recruitment discovery creates records for review; the application does not automatically publish discovered notices. Published job information is subject to the application's author and administrator review workflow, but review does not guarantee that a recruiting organization has not changed its information afterward."]],
        ["6. Preparation resources and uploads", ["SetBGet provides preparation material links and resources. Authorized authors and staff may upload PDF and supported image files or add external links. Do not upload material unless you have the right to provide it and it is appropriate for the resource category. Resource access follows the displayed link and access mode; a link should not be treated as private unless the application explicitly requires authentication for it."]],
        ["7. Third-party sites and services", ["Official application links, external resource links, Google sign-in, and uploaded files may involve services operated by third parties. Their sites and services have their own terms and privacy practices. SetBGet does not control the availability or content of external sites."]],
        ["8. Account status and service availability", ["Users may deactivate their account through account settings. The application also permits authorized staff to manage accounts and content. SetBGet's service depends on its database, hosting, and configured external providers; access or integrations may be unavailable when those services are unavailable or not configured."]],
        ["9. Service information", ["Job notices, matching results, and preparation resources are provided for informational and organizational use. They are not a substitute for the recruiting organization's current official notice. Check the official source before making application, travel, payment, or preparation decisions."]],
        ["10. Changes and unresolved legal details", ["The service and these terms may change as SetBGet's features change. The project does not specify a governing-law jurisdiction, registered operating entity, limitation-of-liability language, or public legal contact. Those details require operator and legal review and are intentionally not invented here."]],
        ["11. Contact", ["A public contact address has not been configured in the project. See the Contact page for the current configuration status; the operator must supply a real monitored contact method before production publication."]]
      ]
    },
    "/about": {
      title: "About SetBGet", description: "SetBGet brings recruitment information and job-preparation tools together in one place.",
      sections: [
        ["Job information and preparation", ["SetBGet is a job-information and job-preparation platform. It presents recruitment notices, board information, application links, and preparation resources so users can explore opportunities and organize next steps."]],
        ["Tools for account holders", ["Signed-in users can save published jobs, keep an application tracker, manage profile and job preferences, and receive website or configured email notifications. Job recommendations can use profile education, location, and job preferences."]],
        ["Communities and resources", ["The application includes communities where members can publish posts and comments, and preparation resources that may be uploaded by authorized authors or linked from external sites."]],
        ["Verify recruitment details", ["SetBGet is not the recruiting authority. Confirm eligibility, dates, fees, and application instructions in the recruiting organization's official notification before applying."]]
      ]
    },
    "/contact": {
      title: "Contact SetBGet", description: "Contact details for SetBGet are not yet configured for public use.",
      sections: [
        ["Public contact details", ["A public support email address, contact form, or postal address is not present in the project configuration. No contact details are published here until the operator supplies an approved, monitored contact method."]],
        ["Production setup required", ["Before inviting users or submitting Google OAuth branding for production, configure a public contact method and use the same accurate contact details in the site's privacy information and Google OAuth branding."]]
      ]
    }
  };
  function informationPage() {
    const content = legalContent[path];
    document.title = `${content.title} | SetBGet`;
    const meta = document.querySelector('meta[name="description"]') || document.head.appendChild(Object.assign(document.createElement("meta"), { name: "description" }));
    meta.content = content.description;
    root.replaceChildren();
    const wrap = add(root, "article", "public-page information-page");
    add(wrap, "p", "public-eyebrow", "SETBGET");
    add(wrap, "h1", "", content.title);
    add(wrap, "p", "public-intro", content.description);
    content.sections.forEach(([heading, paragraphs]) => {
      const block = add(wrap, "section", "information-section");
      add(block, "h2", "", heading);
      paragraphs.forEach(text => add(block, "p", "", text));
    });
  }
  function loginFor(destination) { const to = destination.startsWith("/") && !destination.startsWith("//") ? destination : "/dashboard"; window.location.assign(`/?auth=login&returnTo=${encodeURIComponent(to)}`); }
  async function getUser() { try { return (await api("/users/me")).user; } catch (error) { if (error.status !== 401) throw error; try { await api("/auth/refresh", { method: "POST" }); return (await api("/users/me")).user; } catch { return null; } } }
  function setAccount(user) { const account = document.querySelector("#loginBtn"); if (!account) return; const key = !user ? "navigation.signIn" : user.role === "USER" ? "navigation.dashboard" : null; const label = key ? t(key) : `${user.name || "Account"} · ${user.role}`; const text = add(document.createDocumentFragment(), "span", "", label); if (key) text.dataset.i18n = key; if (document.body.classList.contains("public-mobile-shell")) { account.replaceChildren(icon("account", "home-account-icon"), text); if (key) account.dataset.i18nAriaLabel = key; else delete account.dataset.i18nAriaLabel; account.setAttribute("aria-label", label); } else account.replaceChildren(text); account.onclick = () => { if (!user) return loginFor(path); if (user.role === "USER") return window.location.assign("/dashboard"); window.location.assign(user.role === "AUTHOR" ? "/admin/jobs" : "/admin"); }; }
  function jobCard(parent, job) { const card = add(parent, "article", "public-card public-job-card"); link(card, `/jobs/${encodeURIComponent(job.slug || job._id)}`, job.title, "public-card-title"); add(card, "p", "", job.organization || ""); const facts = [job.board?.name || job.boardName, job.category, job.qualification, job.location, job.applicationDeadline ? t("jobs.deadline", { date: formatDate(job.applicationDeadline) }) : ""].filter(Boolean); if (facts.length) add(card, "p", "public-card-meta", facts.join(" · ")); }
  function pager(parent, meta, onPage, localizedNamespace = null) {
    parent.querySelectorAll(":scope > .public-pagination").forEach(item => item.remove());
    if (!meta || meta.total <= meta.limit) return;
    const bar = add(parent, "nav", "public-pagination");
    const namespace = localizedNamespace === true ? "jobs" : localizedNamespace;
    if (namespace && namespace !== "jobs") bar.setAttribute("aria-label", t(`${namespace}.paginationLabel`));
    add(bar, "span", "", namespace
      ? t(`${namespace}.pageResults`, { page: meta.page, count: meta.total })
      : `Page ${meta.page} · ${meta.total} results`);
    const previous = button(bar, namespace ? t(`${namespace}.previous`) : "Previous", () => onPage(meta.page - 1));
    previous.disabled = meta.page <= 1;
    const next = button(bar, namespace ? t(`${namespace}.next`) : "Next", () => onPage(meta.page + 1));
    next.disabled = !meta.hasNextPage;
    return bar;
  }
  async function jobsPage(user) {
    await i18n?.ready;
    const current = new URLSearchParams(location.search), currentPage = Math.max(1, Number(current.get("page")) || 1);
    const wrap = page(t("jobs.title"), t("jobs.description"));
    if (user) await renderRecommendations(wrap, user);
    else { const recommendations = section(wrap, t("jobs.recommendedForYou"), "/?auth=login", t("jobs.signIn")); notice(recommendations, t("jobs.signInPrompt")); }
    const results = section(wrap, t("jobs.findJobs"), "/jobs", t("jobs.results"));
    const form = add(results, "form", "public-filter-form");
    if (current.get("excludeJobId")) { const excluded = add(form, "input"); excluded.type = "hidden"; excluded.name = "excludeJobId"; excluded.value = current.get("excludeJobId"); }
    const boards = await apiCollection("/boards?page=1&limit=100");
    const field = (label, name, type = "search", value = "") => { const l = add(form, "label", "public-field"); add(l, "span", "", label); const input = add(l, "input"); input.name = name; input.type = type; input.value = value || ""; return input; };
    field(t("jobs.search"), "q", "search", current.get("q"));
    const searchInput = form.querySelector('input[name="q"]'); searchInput.placeholder = t("jobs.searchPlaceholder");
    const select = (label, name, options, value = "", allLabel = `All ${label.toLowerCase()}`) => { const l = add(form, "label", "public-field"); add(l, "span", "", label); const s = add(l, "select"); s.name = name; s.append(new Option(allLabel, "")); options.forEach(([text, key]) => s.append(new Option(text, key))); s.value = value || ""; return s; };
    select(t("jobs.board"), "board", boards.map(b => [b.name, b.slug]), current.get("board"), t("jobs.allBoards"));
    field(t("jobs.category"), "category", "text", current.get("category"));
    field(t("jobs.qualification"), "qualification", "text", current.get("qualification"));
    field(t("jobs.location"), "location", "text", current.get("location"));
    field(t("jobs.deadlineAfter"), "deadlineAfter", "date", current.get("deadlineAfter"));
    field(t("jobs.deadlineBefore"), "deadlineBefore", "date", current.get("deadlineBefore"));
    const actions = add(form, "div", "public-form-actions"); const submit = add(actions, "button", "small-btn", t("jobs.searchJobs")); submit.type = "submit"; link(actions, "/jobs", t("jobs.clearFilters"), "public-text-link");
    const list = add(results, "div", "public-card-list"); notice(list, t("jobs.loading")); const pagination = add(results, "div");
    const load = async pageNumber => {
      const values = Object.fromEntries(new FormData(form)); values.page = pageNumber; values.limit = 20;
      const query = queryString(values); history.replaceState({}, "", `/jobs${query ? `?${query}` : ""}`);
      list.replaceChildren(notice(list, t("jobs.loading")));
      try { const response = pageCollection(await apiPage(`/jobs?${query}`), "/jobs"); list.replaceChildren(); if (!response.items.length) notice(list, t("jobs.noMatchingFilters")); response.items.forEach(job => jobCard(list, job)); pager(pagination, response.pagination, load, true); }
      catch { list.replaceChildren(); notice(list, t("jobs.loadError"), "is-error"); }
    };
    form.addEventListener("submit", event => { event.preventDefault(); load(1); });
    try { const response = pageCollection(await apiPage(`/jobs?${queryString({ ...Object.fromEntries(current), page: currentPage, limit: 20 })}`), "/jobs"); list.replaceChildren(); if (!response.items.length) notice(list, t("jobs.noMatchingFilters")); response.items.forEach(job => jobCard(list, job)); pager(pagination, response.pagination, load, true); }
    catch { list.replaceChildren(); notice(list, t("jobs.loadError"), "is-error"); }
  }
  async function renderRecommendations(parent, user) {
    const block = section(parent, t("jobs.recommendedForYou"), "/dashboard#preferences", t("jobs.editPreferences"));
    const preferences = [user.education, user.location, ...(user.preferredExams || []), ...(user.preferredJobCategories || [])].filter(Boolean);
    if (!preferences.length) { notice(block, t("jobs.missingPreferences")); return; }
    const list = add(block, "div", "public-card-list");
    try {
      const candidates = await apiCollection("/jobs?page=1&limit=100");
      const categories = (user.preferredJobCategories || []).map(v => v.toLowerCase()); const exams = (user.preferredExams || []).map(v => v.toLowerCase());
      const location = String(user.location || "").toLowerCase(), education = String(user.education || "").toLowerCase();
      const today = Date.now();
      const ranked = candidates.map(job => {
        if (job.applicationDeadline && new Date(job.applicationDeadline).getTime() < today) return null;
        const category = `${job.category || ""} ${(job.tags || []).join(" ")}`.toLowerCase(), board = `${job.board?.name || job.boardName || ""} ${job.organization || ""}`.toLowerCase();
        const why = []; let score = 0;
        if (categories.some(value => category.includes(value))) { score += 4; why.push(t("jobs.preferredCategory")); }
        if (exams.some(value => board.includes(value))) { score += 3; why.push(t("jobs.preferredExamBoard")); }
        if (location && String(job.location || "").toLowerCase().includes(location)) { score += 2; why.push(t("jobs.locationReason")); }
        if (education && String(job.qualification || "").toLowerCase().includes(education)) { score += 2; why.push(t("jobs.qualificationReason")); }
        return score ? { job, score, why } : null;
      }).filter(Boolean).sort((a, b) => b.score - a.score || new Date(a.job.applicationDeadline || 8640000000000000) - new Date(b.job.applicationDeadline || 8640000000000000)).slice(0, 5);
      if (!ranked.length) notice(list, t("jobs.noCurrentMatches"));
      ranked.forEach(({ job, why }) => { jobCard(list, job); add(list.lastElementChild, "p", "public-card-meta", t("jobs.matchedCriteria", { reasons: why.join(", ") })); });
    } catch (error) { notice(list, apiError(error, "jobs.recommendationsUnavailable"), "is-error"); }
  }
  async function communitiesPage(user) {
    const params = new URLSearchParams(location.search), wrap = page("Communities", "Find active communities by name, exam, or board.");
    const area = section(wrap, "Discover communities", "/communities", "All communities"), form = add(area, "form", "public-filter-form");
    const search = add(form, "label", "public-field"); add(search, "span", "", "Search"); const input = add(search, "input"); input.name = "q"; input.value = params.get("q") || "";
    const boards = await apiCollection("/boards?page=1&limit=100"); const boardLabel = add(form, "label", "public-field"); add(boardLabel, "span", "", "Board"); const board = add(boardLabel, "select"); board.name = "board"; board.append(new Option("All boards", "")); boards.forEach(item => board.append(new Option(item.name, item.slug))); board.value = params.get("board") || "";
    const controls = add(form, "div", "public-form-actions"); const submit = add(controls, "button", "small-btn", "Search communities"); submit.type = "submit";
    const list = add(area, "div", "public-card-list"); notice(list, "Loading communities…"); const pagination = add(area, "div"); let joined = [];
    if (user) try { joined = (await api("/communities/membership/me")).map(x => String(x.community?._id || x.community)); } catch {}
    const load = async pageNumber => {
      const values = Object.fromEntries(new FormData(form)); values.page = pageNumber; values.limit = 20; const query = queryString(values); history.replaceState({}, "", `/communities${query ? `?${query}` : ""}`); list.replaceChildren();
      try { const result = pageCollection(await apiPage(`/communities?${query}`), "/communities"); if (!result.items.length) notice(list, "No active communities match this search."); result.items.forEach(item => communityCard(list, item, user, joined)); pager(pagination, result.pagination, load); }
      catch { notice(list, "Communities could not be loaded right now. Please try again later.", "is-error"); }
    };
    form.addEventListener("submit", event => { event.preventDefault(); load(1); }); await load(Math.max(1, Number(params.get("page")) || 1));
  }
  function communityCard(parent, item, user, joined) { const card = add(parent, "article", "public-card"); link(card, `/communities/${encodeURIComponent(item.slug || item._id)}`, item.name, "public-card-title"); add(card, "p", "", item.description || item.exam || ""); add(card, "p", "public-card-meta", `${item.board?.name ? `${item.board.name} · ` : ""}${item.memberCount || 0} members`); const action = add(card, "button", "small-btn", joined.includes(String(item._id)) ? "Leave" : "Join"); action.addEventListener("click", async () => { if (!user) return loginFor("/communities"); const member = joined.includes(String(item._id)); try { await api(`/communities/${item._id}/join`, { method: member ? "DELETE" : "POST" }); if (member) joined.splice(joined.indexOf(String(item._id)), 1); else joined.push(String(item._id)); action.textContent = member ? "Join" : "Leave"; } catch (error) { notice(card, error.message || "Could not update membership.", "is-error"); } }); }
  async function communityDetail(user) { const id = decodeURIComponent(path.slice("/communities/".length)); const wrap = page("Community", "Active community details and public posts."); try { const community = await api(`/communities/${encodeURIComponent(id)}`); const posts = await api(`/communities/${encodeURIComponent(community._id)}/posts?page=1&limit=20`); wrap.querySelector("h1").textContent = community.name; document.title = `${community.name} Community | SetBGet`; const canonical = `https://www.setbget.in/communities/${encodeURIComponent(community.slug || community._id)}`; document.head.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical); document.head.querySelector('meta[property="og:url"]')?.setAttribute("content", canonical); document.head.querySelector('meta[name="twitter:url"]')?.setAttribute("content", canonical); const description = community.description || `Join the ${community.name} community on SetBGet.`; document.head.querySelector('meta[name="description"]')?.setAttribute("content", description.slice(0, 300)); document.head.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title); document.head.querySelector('meta[property="og:description"]')?.setAttribute("content", description.slice(0, 300)); if (community.description) add(wrap, "p", "public-intro", community.description); add(wrap, "p", "public-card-meta", `${community.memberCount || 0} members${community.board?.name ? ` · ${community.board.name}` : ""}`); const memberList = user ? await api("/communities/membership/me").catch(() => []) : []; const joined = memberList.some(x => String(x.community?._id || x.community) === String(community._id)); button(wrap, joined ? "Leave community" : "Join community", async event => { try { await api(`/communities/${community._id}/join`, { method: joined ? "DELETE" : "POST" }); location.reload(); } catch (error) { notice(wrap, error.message || "Could not update membership.", "is-error"); } }, "small-btn"); const postsSection = section(wrap, "Community posts", `/communities/${encodeURIComponent(id)}`); if (!posts.length) notice(postsSection, "No public posts yet."); posts.forEach(post => { const card = add(postsSection, "article", "public-card"); add(card, "h3", "", post.title); add(card, "p", "", post.body); add(card, "p", "public-card-meta", post.author?.name || "Community member"); }); } catch (error) { notice(wrap, error.status === 404 ? "Community not found." : error.message || "Could not load this community.", "is-error"); } }
  async function notificationsPage() {
    const params = new URLSearchParams(location.search);
    const wrap = page("Recent Notifications", "Public announcements and notifications for your account.");
    const area = section(wrap, "Notifications", "/notifications", "Latest");
    const list = add(area, "div", "public-card-list");
    notice(list, "Loading notifications…");
    try {
      const result = pageCollection(await apiPage(`/notifications?page=${Math.max(1, Number(params.get("page")) || 1)}&limit=20`), "/notifications");
      list.replaceChildren();
      if (!result.items.length) notice(list, "No notifications yet.");
      for (const item of result.items) {
        const card = add(list, "article", "public-card notification-card");
        if (item.relatedJob) {
          link(card, `/jobs/${encodeURIComponent(item.relatedJob)}`, item.title, "public-card-title");
          const related = link(card, `/jobs?excludeJobId=${encodeURIComponent(item.relatedJob)}`, "View related jobs", "public-text-link notification-related-link");
          api(`/jobs/${encodeURIComponent(item.relatedJob)}`).then(job => {
            const filters = new URLSearchParams({ excludeJobId: item.relatedJob });
            if (job.board?.slug) filters.set("board", job.board.slug);
            else if (job.category) filters.set("category", job.category);
            else if (job.organization) filters.set("q", job.organization);
            related.href = `/jobs?${filters}`;
          }).catch(() => {});
        } else add(card, "h2", "public-card-title", item.title);
        if (item.message) add(card, "p", "", item.message);
        add(card, "p", "public-card-meta", `${item.type} · ${new Date(item.createdAt).toLocaleDateString()}`);
        if (item.user && !item.read) button(card, "Mark as read", async () => {
          try { await api(`/notifications/${item._id}/read`, { method: "PATCH" }); item.read = true; }
          catch { notice(card, "Could not mark this notification as read.", "is-error"); }
        });
      }
      pager(area, result.pagination, p => { location.assign(`/notifications?page=${p}`); });
    } catch { list.replaceChildren(); notice(list, "Notifications could not be loaded right now. Please try again later.", "is-error"); }
  }
  async function faqsPage() {
    const params = new URLSearchParams(location.search);
    const wrap = page("FAQs", "Answers to common questions about SetBGet.");
    const area = section(wrap, "All FAQs", "/faqs", "FAQs");
    const list = add(area, "div", "public-faq-list");
    notice(list, "Loading FAQs…");
    try {
      const result = pageCollection(await apiPage(`/faqs?page=${Math.max(1, Number(params.get("page")) || 1)}&limit=20`), "/faqs");
      list.replaceChildren();
      if (!result.items.length) notice(list, "No FAQs are published yet.");
      result.items.forEach(faq => { const details = add(list, "details", "public-faq"); add(details, "summary", "", faq.question); add(details, "p", "", faq.answer); });
      pager(area, result.pagination, p => location.assign(`/faqs?page=${p}`));
    } catch { list.replaceChildren(); notice(list, "FAQs could not be loaded right now. Please try again later.", "is-error"); }
  }
  async function boardsPage() {
    await i18n?.ready;
    const params = new URLSearchParams(location.search);
    const wrap = page(t("boards.title"), t("boards.description"));
    const list = add(wrap, "div", "public-card-list");
    notice(list, t("boards.loading"));
    try {
      const result = pageCollection(await apiPage(`/boards?page=${Math.max(1, Number(params.get("page")) || 1)}&limit=20&q=${encodeURIComponent(params.get("q") || "")}`), "/boards");
      list.replaceChildren();
      if (!result.items.length) notice(list, t("boards.noBoards"));
      result.items.forEach(item => {
        const card = add(list, "article", "public-card");
        const boardLink = link(card, `/boards/${encodeURIComponent(item.slug)}`, item.name, "public-card-title");
        boardLink.setAttribute("aria-label", `${t("boards.viewBoard")}: ${item.name}`);
        add(card, "p", "", item.shortDescription || item.organization || item.category || "");
        link(card, `/jobs?board=${encodeURIComponent(item.slug)}`, t("boards.viewJobs"), "public-text-link");
      });
      pager(wrap, result.pagination, p => location.assign(`/boards?page=${p}`), "boards");
    } catch (error) {
      list.replaceChildren();
      notice(list, apiError(error, "boards.loadError"), "is-error");
    }
  }
  async function preparationPage() {
    await i18n?.ready;
    const params = new URLSearchParams(location.search);
    const wrap = page(t("examPreparation.title"), t("examPreparation.description"));
    const form = add(wrap, "form", "public-filter-form");
    const label = add(form, "label", "public-field");
    add(label, "span", "", t("examPreparation.board"));
    const board = add(label, "select"); board.name = "board";
    const typeLabel = add(form, "label", "public-field");
    add(typeLabel, "span", "", t("examPreparation.resourceType"));
    const type = add(typeLabel, "select"); type.name = "type";
    const exam = add(form, "label", "public-field");
    add(exam, "span", "", t("examPreparation.exam"));
    const examInput = add(exam, "input"); examInput.name = "exam";
    examInput.placeholder = t("examPreparation.examPlaceholder");
    examInput.value = params.get("exam") || "";
    const go = add(form, "button", "small-btn", t("examPreparation.filterResources")); go.type = "submit";
    const list = add(wrap, "div", "public-card-list");
    notice(list, t("examPreparation.loading"));
    const typeOptions = [
      ["examPreparation.types.syllabus", "SYLLABUS"],
      ["examPreparation.types.previousPapers", "PYQ"],
      ["examPreparation.types.mockTests", "MOCK_TEST"],
      ["examPreparation.types.studyMaterials", "STUDY_MATERIAL"],
    ];
    const resourceTypeLabel = value => {
      const entry = typeOptions.find(([, code]) => code === value);
      return entry ? t(entry[0]) : value;
    };
    const query = queryString({ ...Object.fromEntries(params), page: params.get("page") || 1, limit: 20 });
    try {
      const boards = await apiCollection("/boards?page=1&limit=100");
      board.append(new Option(t("examPreparation.allBoards"), ""));
      boards.forEach(item => board.append(new Option(item.name, item._id)));
      board.value = params.get("board") || "";
      type.append(new Option(t("examPreparation.allResources"), ""));
      typeOptions.forEach(([labelKey, value]) => type.append(new Option(t(labelKey), value)));
      type.value = params.get("type") || "";
      form.addEventListener("submit", event => {
        event.preventDefault();
        const nextQuery = queryString(Object.fromEntries(new FormData(form)));
        location.assign(`/services/preparation${nextQuery ? `?${nextQuery}` : ""}`);
      });
      const result = pageCollection(await apiPage(`/resources?${query}`), "/resources");
      list.replaceChildren();
      if (!result.items.length) notice(list, t("examPreparation.noResults"));
      result.items.forEach(item => {
        const card = add(list, "article", "public-card");
        card.setAttribute("aria-label", `${t("accessibility.resourceCard")}: ${item.title}`);
        add(card, "h2", "public-card-title", item.title);
        add(card, "p", "public-card-meta", [resourceTypeLabel(item.type), item.exam, item.board?.name].filter(Boolean).join(" · "));
        if (item.description) add(card, "p", "", item.description);
        const url = item.url || item.externalUrl || item.cloudinaryUrl;
        if (url && /^https?:\/\//i.test(url)) {
          const label = item.accessMode === "DOWNLOAD" ? "examPreparation.downloadResource" : "examPreparation.openResource";
          const a = link(card, url, t(label), "public-text-link");
          a.setAttribute("aria-label", `${t(label)}: ${item.title}`);
          a.target = "_blank"; a.rel = "noopener noreferrer";
        }
      });
      pager(wrap, result.pagination, p => {
        const next = new URLSearchParams(location.search); next.set("page", p);
        location.assign(`/services/preparation?${next}`);
      }, "examPreparation");
    } catch (error) {
      list.replaceChildren();
      notice(list, apiError(error, "examPreparation.loadError"), "is-error");
    }
  }
  async function preferencesForm(parent, user) { const area = section(parent, "Job preferences", "/jobs", "Browse jobs"); area.id = "preferences"; const form = add(area, "form", "public-filter-form"); const education = add(form, "label", "public-field"); add(education, "span", "", "Education / qualification"); const educationInput = add(education, "input"); educationInput.name = "education"; educationInput.value = user.education || ""; const locationField = add(form, "label", "public-field"); add(locationField, "span", "", "Location"); const locationInput = add(locationField, "input"); locationInput.name = "location"; locationInput.value = user.location || ""; const exams = add(form, "label", "public-field"); add(exams, "span", "", "Preferred exams or boards (comma separated)"); const examsInput = add(exams, "input"); examsInput.name = "preferredExams"; examsInput.value = (user.preferredExams || []).join(", "); const candidates = await apiCollection("/jobs?page=1&limit=100"); const categories = [...new Set(candidates.map(x => x.category).filter(Boolean))].sort(); const box = add(form, "fieldset", "public-preference-categories"); add(box, "legend", "", "Preferred job categories (choose any that apply)"); if (!categories.length) add(box, "p", "public-card-meta", "No published job categories are available to choose yet."); categories.forEach(category => { const label = add(box, "label", "public-checkbox"); const input = add(label, "input"); input.type = "checkbox"; input.name = "preferredJobCategories"; input.value = category; input.checked = (user.preferredJobCategories || []).includes(category); add(label, "span", "", category); }); const save = add(form, "button", "small-btn", "Save preferences"); save.type = "submit"; const message = add(area, "p", "public-notice"); form.addEventListener("submit", async event => { event.preventDefault(); const values = new FormData(form); const categoriesSelected = values.getAll("preferredJobCategories"); const preferredExams = String(values.get("preferredExams") || "").split(",").map(v => v.trim()).filter(Boolean); try { const result = await api("/users/me", { method: "PATCH", body: JSON.stringify({ education: String(values.get("education") || "").trim(), location: String(values.get("location") || "").trim(), preferredExams, preferredJobCategories: categoriesSelected }) }); Object.assign(user, result.user); message.textContent = "Preferences saved."; } catch (error) { message.textContent = error.message || "Could not save preferences."; message.classList.add("is-error"); } }); }
  async function trackerPage(user) { const wrap = page("Application Tracker", "Track the application status and reminders you have saved to your account."); const list = section(wrap, "Your applications", "/jobs", "Find jobs"); if (!user) { notice(list, "Sign in to use your application tracker."); link(list, `/?auth=login&returnTo=${encodeURIComponent("/services/tracker")}`, "Sign in", "small-btn"); return; } try { const apps = await api("/applications?page=1&limit=100"); if (!apps.length) notice(list, "No applications tracked yet. Find a published job and add it to your tracker."); apps.forEach(app => { const card = add(list, "article", "public-card"); if (app.job) link(card, `/jobs/${encodeURIComponent(app.job.slug || app.job._id)}`, app.job.title, "public-card-title"); const form = add(card, "form", "public-filter-form"); const stateLabel = add(form, "label", "public-field"); add(stateLabel, "span", "", "Status"); const select = add(stateLabel, "select"); statuses.forEach(status => select.append(new Option(status.replaceAll("_", " "), status))); select.value = app.status; const notesLabel = add(form, "label", "public-field"); add(notesLabel, "span", "", "Notes"); const notes = add(notesLabel, "input"); notes.value = app.notes || ""; const save = add(form, "button", "small-btn", "Save update"); save.type = "submit"; const remove = add(form, "button", "public-danger-button", "Remove"); remove.type = "button"; remove.addEventListener("click", async () => { if (!confirm("Remove this application from your tracker?")) return; try { await api(`/applications/${app._id}`, { method: "DELETE" }); card.remove(); } catch (error) { notice(card, error.message, "is-error"); } }); form.addEventListener("submit", async event => { event.preventDefault(); try { await api(`/applications/${app._id}`, { method: "PATCH", body: JSON.stringify({ status: select.value, notes: notes.value }) }); notice(card, "Application updated."); } catch (error) { notice(card, error.message, "is-error"); } }); }); } catch (error) { notice(list, error.message || "Could not load applications.", "is-error"); } }
  async function eligibilityPage() { const wrap = page("Eligibility Checker", "Compare your details with structured recruitment criteria. This is a screening aid, not an official eligibility decision."); const jobs = await apiCollection("/jobs?page=1&limit=100"); const form = add(wrap, "form", "public-filter-form"); form.classList.add("eligibility-form"); const jobLabel = add(form, "label", "public-field"); add(jobLabel, "span", "", "Published recruitment"); const jobSelect = add(jobLabel, "select"); jobs.forEach(job => jobSelect.append(new Option(job.title, job._id))); const postLabel = add(form, "label", "public-field"); add(postLabel, "span", "", "Post"); const postSelect = add(postLabel, "select"); const updatePosts = () => { const job = jobs.find(x => String(x._id) === jobSelect.value); postSelect.replaceChildren(new Option("Recruitment-level criteria", "")); (job?.posts || []).forEach(post => postSelect.append(new Option(post.name || "Post", String(post._id)))); }; jobSelect.addEventListener("change", updatePosts); updatePosts(); const ageLabel = add(form, "label", "public-field"); add(ageLabel, "span", "", "Your age"); const age = add(ageLabel, "input"); age.type = "number"; age.min = "1"; const qualificationLabel = add(form, "label", "public-field"); add(qualificationLabel, "span", "", "Your qualification (optional)"); const qualification = add(qualificationLabel, "input"); const check = add(form, "button", "small-btn eligibility-submit", "Review criteria"); check.type = "submit"; const result = add(wrap, "section", "public-section"); form.addEventListener("submit", event => { event.preventDefault(); const job = jobs.find(x => String(x._id) === jobSelect.value); const post = job?.posts?.find(x => String(x._id) === postSelect.value); if (!job) return; result.replaceChildren(); add(result, "h2", "", "Available criteria"); const min = post?.ageMin ?? job.ageMin, max = post?.ageMax ?? job.ageMax; let assessed = false; if (age.value && (min != null || max != null)) { assessed = true; const matches = Number(age.value) >= (min ?? 0) && Number(age.value) <= (max ?? 120); add(result, "p", "", `Age range ${min ?? "not specified"}–${max ?? "not specified"}: ${matches ? "within the recorded range" : "outside the recorded range"}.`); } const qualRows = post?.qualifications || job?.qualifications || []; if (qualRows.length) { assessed = true; add(result, "p", "", `Qualification criteria: ${qualRows.map(x => [x.name, x.field, x.condition, x.additionalRequirement, x.minimumMarks && `Minimum marks ${x.minimumMarks}`].filter(Boolean).join(" · ")).join("; ")}`); if (qualification.value) add(result, "p", "", "Compare your qualification with each post requirement; the site cannot confirm equivalency."); } else if (job.qualification) { add(result, "p", "", `Recruitment qualification text: ${job.qualification}.`); } if (post?.experienceRequirements?.length) add(result, "p", "", `Experience: ${post.experienceRequirements.map(x => [x.minimumExperience, x.domain, x.description].filter(Boolean).join(" · ")).join("; ")}`); if (post?.mandatoryCertifications?.length) add(result, "p", "", `Mandatory certifications: ${post.mandatoryCertifications.join(", ")}`); add(result, "p", "public-notice", assessed ? "Only the displayed structured criteria were reviewed; other recruitment conditions may apply. Verify the official notice." : "Structured age or qualification criteria are not available for this selection. Check the official notice; eligibility cannot be assessed here."); }); }
  function servicesPage() {
    const wrap = page("Services", "Choose a focused SetBGet tool.");
    [["My Job Preparation", "/dashboard", "Saved jobs, applications, alerts, and your profile preferences."], ["Exam Preparation", "/services/preparation", "Find syllabus, previous papers, mock tests, and study material."], ["Study Materials", "/services/preparation", "Browse resources by resource type, board, or exam."], ["Eligibility Checker", "/services/eligibility", "Review available structured recruitment criteria."], ["Job Tracker", "/services/tracker", "Update the application records in your account."], ["FAQs", "/faqs", "Browse published answers."]].forEach(([title, href, description]) => {
      const card = add(wrap, "article", "public-card");
      link(card, href, title, "public-card-title");
      add(card, "p", "", description);
    });
    const gamesSection = add(wrap, "section", "public-section");
    const headingRow = add(gamesSection, "div", "public-section-heading");
    const gamesHeading = add(headingRow, "h2", "", t("navigation.brainGames"));
    gamesHeading.dataset.i18n = "navigation.brainGames";
    const gameCard = add(gamesSection, "article", "public-card");
    const gameLink = link(gameCard, "/number-rush/", t("navigation.numberRush"), "public-card-title");
    gameLink.dataset.i18n = "navigation.numberRush";
    const description = add(gameCard, "p", "", t("navigation.numberRushDescription"));
    description.dataset.i18n = "navigation.numberRushDescription";
  }
  async function workspaceUnreadCount(){try{const result=await api("/notifications/unread-count");const badge=root.querySelector(".user-notification-count");const summary=root.querySelector(".user-notification-trigger");if(!badge||!summary)return;const count=Math.max(0,Number(result.count)||0);badge.hidden=count===0;badge.textContent=count>99?"99+":String(count);summary.setAttribute("aria-label",count?`Notifications, ${count} unread`:"Notifications");}catch(error){const badge=root.querySelector(".user-notification-count");if(badge)badge.hidden=true;const summary=root.querySelector(".user-notification-trigger");if(summary)summary.title=error.message||"Unread count unavailable";}}
  function notificationJobPath(item){return item?.link&&/^[a-f\d]{24}$/i.test(String(item.jobId||""))?`/jobs/${encodeURIComponent(String(item.jobId))}`:null;}
  function notificationCategory(item){const type=String(item.type||"");if(type.includes("JOB")||type.includes("MATCH"))return "Job match";if(type.includes("APPLICATION"))return "Application";if(type.includes("DEADLINE"))return "Deadline";return "Account update";}
  function userNav(user){
    const currentPage=root.querySelector(":scope > .public-page");
    const layout=add(root,"div","user-dashboard-layout");
    const overlay=add(layout,"button","user-dashboard-drawer-backdrop");overlay.type="button";overlay.hidden=true;overlay.tabIndex=-1;overlay.setAttribute("aria-hidden","true");overlay.setAttribute("aria-label","Close dashboard navigation");
    const sidebar=add(layout,"aside","user-dashboard-sidebar");sidebar.id="userWorkspaceNavigation";sidebar.setAttribute("aria-label","User workspace navigation");
    const drawerHeader=add(sidebar,"div","user-dashboard-drawer-header");add(drawerHeader,"div","user-dashboard-brand","SetBGet");
    const drawerClose=button(drawerHeader,"",()=>closeDrawer(),"user-dashboard-drawer-close");drawerClose.dataset.i18nAriaLabel="accessibility.closeNavigation";drawerClose.setAttribute("aria-label",t("accessibility.closeNavigation"));drawerClose.append(icon("close"));
    const nav=add(sidebar,"nav","user-dashboard-nav");
    const items=[["Overview","/dashboard"],["Saved Jobs","/dashboard/saved"],["Applications","/dashboard/applications"],["Notifications","/dashboard/notifications"],["Profile","/profile"],["Settings","/settings"]];
    const activePath=path==="/dashboard"?"/dashboard":path;
    items.forEach(([name,href])=>{const a=link(nav,href,name,activePath===href?"is-active":"");if(activePath===href)a.setAttribute("aria-current","page");a.addEventListener("click",()=>closeDrawer(false));});
    const main=add(layout,"section","user-dashboard-main");
    const topbar=add(main,"header","user-workspace-topbar");
    const menuButton=button(topbar,"",()=>setDrawerOpen(true),"user-workspace-menu-button");menuButton.dataset.i18nAriaLabel="accessibility.openDashboardNavigation";menuButton.setAttribute("aria-label",t("accessibility.openDashboardNavigation"));menuButton.setAttribute("aria-controls",sidebar.id);menuButton.setAttribute("aria-expanded","false");menuButton.append(icon("menu"));
    add(topbar,"div","user-workspace-title","SetBGet · User Workspace");
    const actions=add(topbar,"div","user-workspace-actions");
    const home=link(actions,"/","","user-workspace-home");home.dataset.i18nAriaLabel="accessibility.setbgetHome";home.dataset.i18nTitle="navigation.home";home.setAttribute("aria-label",t("accessibility.setbgetHome"));home.title=t("navigation.home");home.append(icon("home","user-workspace-home-icon"));
    const bell=add(actions,"details","user-notification-menu");
    const bellButton=add(bell,"summary","user-notification-trigger");bellButton.setAttribute("aria-label","Notifications");bellButton.append(icon("bell","user-notification-icon"));
    const badge=add(bellButton,"span","user-notification-count","0");badge.hidden=true;
    const popover=add(bell,"div","user-notification-popover");popover.setAttribute("aria-label","Recent notifications");
    const recentList=add(popover,"div","user-notification-list");
    const bellActions=add(popover,"div","user-notification-actions");
    const markAll=button(bellActions,"Mark all read",async event=>{event.currentTarget.disabled=true;try{await api("/notifications/read-all",{method:"PATCH"});recentList.querySelectorAll(".user-notification-item.is-unread").forEach(item=>item.classList.remove("is-unread"));recentList.querySelectorAll(".user-notification-read").forEach(item=>item.remove());await workspaceUnreadCount();}catch(error){notice(recentList,error.message||"Could not mark notifications as read.","is-error");}finally{event.currentTarget.disabled=false;}});
    markAll.classList.add("user-notification-mark-all");
    link(bellActions,"/dashboard/notifications","View all notifications →","user-notification-view-all");
    const loadRecent=async()=>{recentList.replaceChildren(notice(recentList,"Loading notifications…"));try{const items=await apiCollection("/notifications?page=1&limit=5");recentList.replaceChildren();if(!items.length)notice(recentList,"No notifications yet.");items.forEach(item=>{const card=add(recentList,"article",`user-notification-item${item.read?"":" is-unread"}`);add(card,"span","user-notification-category",notificationCategory(item));add(card,"h3","",item.title||"Notification");if(item.message)add(card,"p","",item.message);if(item.createdAt)add(card,"time","user-notification-date",new Date(item.createdAt).toLocaleString());const destination=notificationJobPath(item);if(destination){card.tabIndex=0;card.setAttribute("role","link");card.setAttribute("aria-label",`${item.title||"Job notification"}. Open related job`);const open=async()=>{try{await api(`/notifications/${encodeURIComponent(item._id)}/read`,{method:"PATCH"});await workspaceUnreadCount();location.assign(destination);}catch(error){notice(card,error.message||"Could not open this notification.","is-error");}};card.addEventListener("click",open);card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open();}});}else if(!item.read){button(card,"Mark as read",async event=>{event.currentTarget.disabled=true;try{await api(`/notifications/${encodeURIComponent(item._id)}/read`,{method:"PATCH"});card.classList.remove("is-unread");event.currentTarget.remove();await workspaceUnreadCount();}catch(error){event.currentTarget.disabled=false;notice(card,error.message||"Could not mark this notification as read.","is-error");}} ,"user-notification-read");}});await workspaceUnreadCount();}catch(error){recentList.replaceChildren(notice(recentList,error.message||"Notifications could not be loaded.","is-error"));}};
    bell.addEventListener("toggle",()=>{if(bell.open)loadRecent();});workspaceUnreadCount();
    const account=add(actions,"details","user-workspace-account");const accountSummary=add(account,"summary","user-workspace-account-trigger",user.name||"Account");accountSummary.setAttribute("aria-label",`Account menu for ${user.name||"user"}`);const accountMenu=add(account,"div","user-workspace-account-menu");link(accountMenu,"/profile","Profile");link(accountMenu,"/settings","Settings");const signOut=button(accountMenu,"Sign out",async event=>{event.currentTarget.disabled=true;event.currentTarget.textContent="Signing out…";try{await api("/auth/logout",{method:"POST"});setAccount(null);location.assign("/?auth=login");}catch(error){event.currentTarget.disabled=false;event.currentTarget.textContent="Sign out";notice(accountMenu,error.message||"Could not sign out.","is-error");}});signOut.classList.add("user-workspace-signout");
    let bodyOverflowBeforeDrawer="";const mobile=window.matchMedia("(max-width: 850px)");
    function closeDrawer(restoreFocus=true){sidebar.classList.remove("is-drawer-open");overlay.hidden=true;main.inert=false;sidebar.inert=mobile.matches;sidebar.setAttribute("aria-hidden",mobile.matches?"true":"false");sidebar.removeAttribute("role");sidebar.removeAttribute("aria-modal");menuButton.setAttribute("aria-expanded","false");document.body.style.overflow=bodyOverflowBeforeDrawer;if(restoreFocus&&mobile.matches)menuButton.focus();}
    function setDrawerOpen(open){if(!mobile.matches)return;if(open){bodyOverflowBeforeDrawer=document.body.style.overflow;sidebar.classList.add("is-drawer-open");sidebar.inert=false;sidebar.setAttribute("aria-hidden","false");sidebar.setAttribute("role","dialog");sidebar.setAttribute("aria-modal","true");overlay.hidden=false;main.inert=true;menuButton.setAttribute("aria-expanded","true");const active=nav.querySelector('[aria-current="page"]');(active||drawerClose).focus();}else closeDrawer();}
    function syncDrawerMode(){if(mobile.matches){if(!sidebar.classList.contains("is-drawer-open")){sidebar.inert=true;sidebar.setAttribute("aria-hidden","true");}}else{closeDrawer(false);sidebar.inert=false;sidebar.setAttribute("aria-hidden","false");}}
    menuButton.addEventListener("click",()=>setDrawerOpen(true));overlay.addEventListener("click",()=>closeDrawer());document.addEventListener("keydown",event=>{if(event.key==="Escape"&&sidebar.classList.contains("is-drawer-open"))closeDrawer();if(event.key==="Tab"&&sidebar.classList.contains("is-drawer-open")){const focusable=[...sidebar.querySelectorAll('a[href],button:not(:disabled)')];const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});mobile.addEventListener?.("change",syncDrawerMode);syncDrawerMode();
    document.addEventListener("click",event=>{if(!topbar.contains(event.target)){bell.open=false;account.open=false;}});
    if(currentPage)main.append(currentPage);
  }
  async function accountPage(user){const titles={"/dashboard":[`Welcome back, ${user.name||"there"}`,"Your job search and next steps."],"/dashboard/saved":["Saved Jobs","Keep promising opportunities in one place."],"/dashboard/applications":["Applications","Track progress and notes for each opportunity."],"/dashboard/notifications":["Notifications","Updates and potential job matches for your account."],"/profile":["Profile","Your information helps personalize job matching."],"/settings":["Settings","Manage your account, security, and notifications."]};const [title,description]=titles[path];const wrap=page(title,description);if(path!=="/dashboard/applications")userNav(user);try{if(path==="/profile")return await profileForm(wrap,user);if(path==="/settings")return await settingsForm(wrap,user);if(path==="/dashboard/saved")return await savedPage(wrap);if(path==="/dashboard/applications"){await trackerPage(user);const h=root.querySelector("h1");if(h)h.textContent="Applications";userNav(user);return;}if(path==="/dashboard/notifications")return await userNotifications(wrap);return await dashboardOverview(wrap,user);}catch(error){notice(wrap,error.message||"This account page could not be loaded.","is-error");}}
  async function dashboardOverview(wrap,user){
    const [saved,apps,notes,jobs,unread]=await Promise.all([
      apiCollection("/saved-jobs?page=1&limit=100"),apiCollection("/applications?page=1&limit=100"),
      apiCollection("/notifications?page=1&limit=5"),apiCollection("/jobs/recommended?limit=5"),api("/notifications/unread-count")
    ]);
    if(user.isEmailVerified===false){const verification=notice(wrap,"Your email is not verified yet.");button(verification,"Resend verification email",async event=>{const b=event.currentTarget;b.disabled=true;try{await api("/auth/resend-verification",{method:"POST",body:JSON.stringify({email:user.email})});b.textContent="If verification is needed, an email will be sent";}catch(error){b.disabled=false;notice(verification,error.message||"Could not send verification email.","is-error");}});}
    const stats=add(wrap,"div","dashboard-stat-grid");
    [["Saved jobs",saved.length,"/dashboard/saved"],["Applications",apps.filter(x=>x.status!=="NOT_APPLIED").length,"/dashboard/applications"],["Unread",unread.count||0,"/dashboard/notifications"]].forEach(([label,n,href])=>link(stats,href,`${label}  ${n}`,"dashboard-stat-card"));
    const savedBlock=section(wrap,"Recently saved","/dashboard/saved","View saved jobs");if(!saved.length)notice(savedBlock,"You haven't saved any jobs yet.");saved.slice(0,3).forEach(job=>jobCard(savedBlock,job));
    const applicationBlock=section(wrap,"Recent applications","/dashboard/applications","View tracker");if(!apps.length)notice(applicationBlock,"No applications are tracked yet.");apps.slice(0,3).forEach(app=>{const card=add(applicationBlock,"article","public-card");if(app.job)link(card,`/jobs/${encodeURIComponent(app.job.slug||app.job._id)}`,app.job.title,"public-card-title");add(card,"p","public-card-meta",`${app.status.replaceAll("_"," ")} · ${new Date(app.updatedAt||app.createdAt).toLocaleDateString()}`);});
    const recommendations=section(wrap,"Potential job matches","/profile","Update preferences");if(!jobs.length)notice(recommendations,"No potential matches yet. Add your preferences to improve matching.");jobs.forEach(job=>{jobCard(recommendations,job);add(recommendations.lastElementChild,"p","public-card-meta",`${job.match.level.replaceAll("_"," ")} · ${job.match.reasons.join("; ")}${job.match.unknown.length?` · Review: ${job.match.unknown.join(", ")}`:""}`);});
    const notificationBlock=section(wrap,"Latest notifications","/dashboard/notifications","View all");if(!notes.length)notice(notificationBlock,"You're all caught up.");notes.forEach(item=>{const card=add(notificationBlock,"article",`public-card${item.read?"":" is-unread"}`);add(card,"p","user-notification-category",notificationCategory(item));add(card,"h3","",item.title);if(item.message)add(card,"p","",item.message);if(item.createdAt)add(card,"time","user-notification-date",new Date(item.createdAt).toLocaleString());const destination=notificationJobPath(item);if(destination){const open=link(card,destination,"Open related job","public-text-link");open.addEventListener("click",async event=>{event.preventDefault();try{await api(`/notifications/${encodeURIComponent(item._id)}/read`,{method:"PATCH"});await workspaceUnreadCount();location.assign(destination);}catch(error){notice(card,error.message||"Could not open this notification.","is-error");}});}});
  }
  async function savedPage(wrap){const list=add(wrap,"div","public-card-list"),jobs=await apiCollection("/saved-jobs?page=1&limit=100");if(!jobs.length){notice(list,"You haven't saved any jobs yet.");link(list,"/jobs","Browse Jobs","small-btn");return;}jobs.forEach(job=>{const c=add(list,"article","public-card");jobCard(c,job);button(c,"Remove",async event=>{const b=event.currentTarget;b.disabled=true;try{await api(`/saved-jobs/${job._id}`,{method:"DELETE"});c.remove();}catch(e){b.disabled=false;notice(c,e.message,"is-error");}},"public-danger-button");});}
  async function userNotifications(wrap){
    const items=await apiCollection("/notifications?page=1&limit=100"),list=add(wrap,"div","public-card-list");
    const actions=add(wrap,"div","notification-center-actions");
    if(items.some(item=>!item.read))button(actions,"Mark all read",async event=>{const action=event.currentTarget;action.disabled=true;try{await api("/notifications/read-all",{method:"PATCH"});list.querySelectorAll(".is-unread").forEach(card=>card.classList.remove("is-unread"));list.querySelectorAll(".user-notification-read").forEach(control=>control.remove());await workspaceUnreadCount();action.textContent="All caught up";}catch(error){action.disabled=false;notice(wrap,error.message||"Could not mark notifications as read.","is-error");}});
    if(!items.length){notice(list,"You're all caught up.");return;}
    items.forEach(item=>{
      const card=add(list,"article",`public-card notification-center-item${item.read?"":" is-unread"}`);
      add(card,"p","user-notification-category",notificationCategory(item));add(card,"h2","",item.title||"Notification");
      if(item.message)add(card,"p","",item.message);if(item.createdAt)add(card,"time","user-notification-date",new Date(item.createdAt).toLocaleString());
      const destination=notificationJobPath(item);
      if(destination){const open=link(card,destination,"Open related job","public-text-link");open.addEventListener("click",async event=>{event.preventDefault();open.setAttribute("aria-disabled","true");try{await api(`/notifications/${encodeURIComponent(item._id)}/read`,{method:"PATCH"});await workspaceUnreadCount();location.assign(destination);}catch(error){open.removeAttribute("aria-disabled");notice(card,error.message||"Could not open this notification.","is-error");}});}
      if(!item.read){button(card,"Mark as read",async event=>{const control=event.currentTarget;control.disabled=true;try{await api(`/notifications/${encodeURIComponent(item._id)}/read`,{method:"PATCH"});card.classList.remove("is-unread");control.remove();await workspaceUnreadCount();}catch(error){control.disabled=false;notice(card,error.message||"Could not mark this notification as read.","is-error");}},"user-notification-read");}
    });
  }
  async function profileForm(wrap,user){
    const form=add(wrap,"form","public-filter-form profile-form");
    const field=(text,type,value)=>{const box=add(form,"label","public-field profile-field");add(box,"span","",text);const input=add(box,"input","profile-control");input.type=type;input.value=value||"";return input;};
    const name=field("Name","text",user.name);
    const dob=field("Date of birth","date",user.dateOfBirth?new Date(user.dateOfBirth).toISOString().slice(0,10):"");
    const email=field("Email","email",user.email);email.readOnly=true;
    const [taxonomy,locs,cats]=await Promise.all([fetch("/data/qualification-taxonomy.json").then(r=>r.json()),fetch("/data/india-locations.json").then(r=>r.json()),fetch("/data/job-taxonomy.json").then(r=>r.json())]);
    const prefs=user.preferences||{},edu=prefs.education||{};
    const values=value=>Array.isArray(value)?value:(value?[value]:[]);
    const choiceField=(title,options,selected,changed)=>{
      const box=add(form,"div","public-field profile-choice-field");add(box,"span","",title);
      const details=add(box,"details","profile-multi-picker");const summary=add(details,"summary","profile-control profile-picker-trigger","Choose options");
      const optionList=add(details,"div","profile-picker-options");const inputs=[];
      options.forEach(option=>{const label=add(optionList,"label","profile-picker-option");const input=add(label,"input");input.type="checkbox";input.value=option;input.checked=selected.includes(option);input.addEventListener("change",()=>{changed();updateSummary();});add(label,"span","",option);inputs.push(input);});
      const updateSummary=()=>{const count=inputs.filter(input=>input.checked).length;summary.textContent=count?`${count} selected`:`Choose ${title.toLowerCase()}`;};updateSummary();
      return {details,summary,inputs,updateSummary};
    };
    const levelField=add(form,"label","public-field profile-field");add(levelField,"span","","Education Level");const level=add(levelField,"select","profile-control");level.append(new Option("Select level",""));taxonomy.levels.forEach(item=>level.append(new Option(item.label,item.id)));level.value=edu.level||"";
    let degreeTouched=false,fieldTouched=false,categoriesTouched=false,boardsTouched=false,locationTouched=false;
    const degreeNote=add(form,"p","profile-legacy-note","");
    const degreePicker=choiceField("Degree",[],values(edu.degrees),()=>{degreeTouched=true;degreeNote.textContent=values(edu.degrees).length?"Changing the degree selection replaces the saved degree list.":"";});
    degreePicker.details.classList.add("is-disabled");degreePicker.summary.setAttribute("aria-disabled","true");
    degreePicker.summary.addEventListener("click",event=>{if(degreePicker.details.classList.contains("is-disabled")){event.preventDefault();}});
    const fillDegrees=()=>{
      const current=taxonomy.levels.find(item=>item.id===level.value);
      degreePicker.details.open=false;degreePicker.details.classList.toggle("is-disabled",!current);
      degreePicker.summary.setAttribute("aria-disabled",current?"false":"true");
      degreePicker.summary.tabIndex=current?0:-1;
      const chosen=degreePicker.inputs.filter(input=>input.checked).map(input=>input.value);
      degreePicker.inputs.forEach(input=>input.closest("label").remove());degreePicker.inputs.length=0;
      (current?.degrees||[]).forEach(option=>{const label=add(degreePicker.details.querySelector(".profile-picker-options"),"label","profile-picker-option");const input=add(label,"input");input.type="checkbox";input.value=option;input.checked=chosen.includes(option)||(!degreeTouched&&values(edu.degrees).includes(option));input.addEventListener("change",()=>{degreeTouched=true;degreePicker.updateSummary();});add(label,"span","",option);degreePicker.inputs.push(input);});
      if(current)degreePicker.updateSummary();else degreePicker.summary.textContent="Select education level first";
      const unmatched=values(edu.degrees).filter(value=>!(current?.degrees||[]).some(option=>option.toLowerCase()===String(value).toLowerCase()));
      degreeNote.textContent=unmatched.length?`Saved degree values (${unmatched.join(", ")}) are retained unless you change the degree selection.`:"";
    };
    level.addEventListener("change",fillDegrees);fillDegrees();
    const fieldPicker=choiceField("Field / Discipline",taxonomy.fields,values(edu.fields).filter(value=>taxonomy.fields.includes(value)),()=>{fieldTouched=true;});
    const data=Array.isArray(locs.states)?Object.fromEntries(locs.states.map(item=>[item.name,item.districts])):(locs.states||locs);
    const stateField=add(form,"label","public-field profile-field");add(stateField,"span","","State / Union Territory");const state=add(stateField,"select","profile-control");state.append(new Option("Select state",""));Object.keys(data).sort().forEach(value=>state.append(new Option(value,value)));state.value=prefs.location?.state||"";
    const districtField=add(form,"label","public-field profile-field");add(districtField,"span","","District");const district=add(districtField,"select","profile-control");
    const fillDistricts=(selected="")=>{district.replaceChildren();if(!state.value){district.append(new Option("Select state first",""));district.disabled=true;return;}district.disabled=false;district.append(new Option("Select district",""),...(data[state.value]||[]).map(value=>new Option(value,value)));if(selected&&(data[state.value]||[]).includes(selected))district.value=selected;};
    fillDistricts(prefs.location?.district||"");
    state.addEventListener("change",()=>{locationTouched=true;fillDistricts("");});district.addEventListener("change",()=>{locationTouched=true;});
    const categories=choiceField("Preferred job categories",cats.categories,prefs.jobCategories?.length?prefs.jobCategories:(user.preferredJobCategories||[]),()=>{categoriesTouched=true;});
    const boards=choiceField("Preferred boards",cats.boards,prefs.preferredBoards?.length?prefs.preferredBoards:(user.preferredExams||[]),()=>{boardsTouched=true;});
    const structuredEducation=[edu.level,...values(edu.degrees),...values(edu.fields).filter(value=>taxonomy.fields.includes(value))].filter(Boolean);
    const legacyEducation=String(user.education||"").split(" · ").filter(value=>value&&!structuredEducation.includes(value));
    if(legacyEducation.length)notice(form,`Existing education details are preserved: ${legacyEducation.join(" · ")}. Select structured values when ready.`);
    const structuredLocation=[prefs.location?.state,prefs.location?.district].filter(Boolean).join(", ");
    if(user.location&&user.location!==structuredLocation)notice(form,`Existing location details are preserved: ${user.location}.`);
    const save=add(form,"button","small-btn profile-save","Save profile");save.type="submit";const msg=add(wrap,"p","public-notice","");
    form.addEventListener("submit",async event=>{event.preventDefault();save.disabled=true;const education={};if(level.value)education.level=level.value;if(degreeTouched)education.degrees=degreePicker.inputs.filter(input=>input.checked).map(input=>input.value);if(fieldTouched)education.fields=fieldPicker.inputs.filter(input=>input.checked).map(input=>input.value);const preferences={};if(Object.keys(education).length)preferences.education=education;if(state.value&&(locationTouched||prefs.location?.state)&&!(prefs.location?.district&&!district.value&&!locationTouched))preferences.location={state:state.value,...(district.value?{district:district.value}:{})};if(categoriesTouched)preferences.jobCategories=categories.inputs.filter(input=>input.checked).map(input=>input.value);if(boardsTouched)preferences.preferredBoards=boards.inputs.filter(input=>input.checked).map(input=>input.value);
      const body={name:name.value,dateOfBirth:dob.value||undefined};if(Object.keys(preferences).length)body.preferences=preferences;
      try{await api("/users/me",{method:"PATCH",body:JSON.stringify(body)});msg.textContent="Profile saved.";}catch(error){msg.textContent=error.message||"Could not save profile.";msg.classList.add("is-error");}finally{save.disabled=false;}
    });
  }
  async function settingsForm(wrap,user){
    const block=(title,description)=>{const box=add(wrap,"section","public-section settings-section");add(box,"h2","",title);add(box,"p","settings-description",description);return box;};
    const field=(form,labelText,type,value="",autocomplete="")=>{const label=add(form,"label","public-field settings-field");add(label,"span","",labelText);const input=add(label,"input");input.type=type;input.value=value||"";input.required=true;if(autocomplete)input.autocomplete=autocomplete;return input;};
    const status=(parent)=>{const msg=add(parent,"p","public-notice settings-status","");msg.setAttribute("role","status");return msg;};

    const account=block("Account","Review your account details and verify changes to your email address.");
    const details=add(account,"dl","settings-account-details");
    [["Name",user.name||"Not provided"],["Current email",user.email||"Not provided"],["Email status",user.isEmailVerified?"Verified":"Not verified"],["Phone",user.phoneNumber||"Not provided"]].forEach(([key,value])=>{add(details,"dt","",key);add(details,"dd","",value);});
    link(account,"/profile","Edit profile","public-text-link");
    const emailForm=add(account,"form","settings-form");emailForm.noValidate=false;
    const newEmail=field(emailForm,"New email address","email","","email");newEmail.autocomplete="email";newEmail.maxLength=254;
    const emailSave=add(emailForm,"button","small-btn","Send verification link");emailSave.type="submit";
    const emailMessage=status(account);
    emailForm.addEventListener("submit",async event=>{event.preventDefault();emailMessage.classList.remove("is-error");emailMessage.textContent="";if(!emailForm.reportValidity())return;emailSave.disabled=true;emailSave.textContent="Sending…";try{const result=await api("/users/me/email",{method:"PATCH",body:JSON.stringify({email:newEmail.value.trim()})});if(!result.verificationEmailSent)throw new Error("The verification email could not be confirmed. Please try again.");emailMessage.textContent="Verification link sent. Your current email remains active until you verify the new address.";newEmail.value="";}catch(error){emailMessage.textContent=error.message||"Could not request an email change.";emailMessage.classList.add("is-error");}finally{emailSave.disabled=false;emailSave.textContent="Send verification link";}});
    const security=block("Security","Change your password. This signs out existing sessions, including this browser.");
    const verification=add(security,"p","settings-email-status",`Email: ${user.email||"Not provided"} · ${user.isEmailVerified?"Verified":"Not verified"}`);
    if(user.isEmailVerified)verification.classList.add("is-verified");
    else if(user.email){const resend=button(security,"Resend verification email",async event=>{verification.classList.remove("is-error");event.currentTarget.disabled=true;event.currentTarget.textContent="Sending…";try{await api("/auth/resend-verification",{method:"POST",body:JSON.stringify({email:user.email})});verification.textContent="If this account needs verification, instructions have been sent.";}catch(error){verification.textContent=error.message||"Could not send a verification email.";verification.classList.add("is-error");}finally{event.currentTarget.disabled=false;event.currentTarget.textContent="Resend verification email";}});resend.classList.add("settings-secondary-action");}
    const passwordForm=add(security,"form","settings-form");
    const current=field(passwordForm,"Current password","password","","current-password");current.maxLength=128;
    const next=field(passwordForm,"New password","password","","new-password");next.minLength=10;next.maxLength=128;
    const confirm=field(passwordForm,"Confirm new password","password","","new-password");confirm.minLength=10;confirm.maxLength=128;
    const passwordSave=add(passwordForm,"button","small-btn","Change password");passwordSave.type="submit";
    const passwordMessage=status(security);
    passwordForm.addEventListener("submit",async event=>{event.preventDefault();passwordMessage.classList.remove("is-error");passwordMessage.textContent="";if(!passwordForm.reportValidity())return;if(next.value!==confirm.value){confirm.setCustomValidity("Passwords do not match.");confirm.reportValidity();confirm.setCustomValidity("");return;}passwordSave.disabled=true;passwordSave.textContent="Changing…";try{await api("/users/me/password",{method:"PATCH",body:JSON.stringify({currentPassword:current.value,newPassword:next.value,confirmPassword:confirm.value})});passwordForm.reset();passwordSave.disabled=true;passwordSave.textContent="Password changed";passwordMessage.textContent="Password changed. All sessions were signed out. Sign in again to continue.";setAccount(null);link(security,"/?auth=login","Sign in","public-text-link");}catch(error){passwordMessage.textContent=error.message||"Could not change password.";passwordMessage.classList.add("is-error");passwordSave.disabled=false;passwordSave.textContent="Change password";}});

    const notifications=block("Notifications","Choose the account notifications you receive.");
    const value=await api("/users/me/notification-preferences"),preferences=add(notifications,"form","settings-form settings-notifications"),items=[["website","Website notifications"],["email","Email notifications"],["jobMatches","Potential job matches"],["deadlineReminders","Application reminders"],["announcements","Announcements"]],inputs={};
    items.forEach(([key,text])=>{const label=add(preferences,"label","public-checkbox"),input=add(label,"input");input.type="checkbox";input.checked=value[key]!==false;inputs[key]=input;add(label,"span","",text);});
    const save=add(preferences,"button","small-btn","Save notification settings");save.type="submit";const preferenceMessage=status(notifications);
    preferences.addEventListener("submit",async event=>{event.preventDefault();save.disabled=true;save.textContent="Saving…";preferenceMessage.classList.remove("is-error");try{await api("/users/me/notification-preferences",{method:"PATCH",body:JSON.stringify(Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.checked])))});preferenceMessage.textContent="Notification settings saved.";}catch(error){preferenceMessage.textContent=error.message||"Could not save notification settings.";preferenceMessage.classList.add("is-error");}finally{save.disabled=false;save.textContent="Save notification settings";}});

    const management=block("Account management","Deactivate your account if you no longer want to use SetBGet.");
    add(management,"p","settings-warning","Deactivation signs you out and removes your saved jobs, application tracker entries, community memberships, and personal notifications. Your account record is deactivated rather than permanently erased.");
    const dialog=add(management,"dialog","settings-confirm-dialog");add(dialog,"h3","","Are you sure you want to deactivate your account?");add(dialog,"p","","You will be signed out and your account will no longer be active. Your saved jobs, application tracker entries, community memberships, and personal notifications will be removed.");const dialogActions=add(dialog,"div","settings-dialog-actions"),cancel=add(dialogActions,"button","small-btn","Cancel");cancel.type="button";const deactivate=add(dialogActions,"button","public-danger-button","Confirm deactivation");deactivate.type="button";const deactivateMessage=status(management);
    const open=button(management,"Deactivate account",()=>{deactivateMessage.textContent="";if(typeof dialog.showModal==="function")dialog.showModal();else if(window.confirm("Are you sure you want to deactivate your account? You will be signed out and your account will no longer be active."))void deactivateAccount();},"public-danger-button");
    async function deactivateAccount(){deactivate.disabled=true;deactivate.textContent="Deactivating…";deactivateMessage.classList.remove("is-error");try{await api("/users/me",{method:"DELETE"});if(dialog.open)dialog.close();deactivateMessage.textContent="Your account has been deactivated. You are signed out.";open.disabled=true;setAccount(null);window.setTimeout(()=>window.location.assign("/"),1200);}catch(error){deactivateMessage.textContent=error.message||"Could not deactivate your account.";deactivateMessage.classList.add("is-error");deactivate.disabled=false;deactivate.textContent="Confirm deactivation";}}
    cancel.addEventListener("click",()=>dialog.close());deactivate.addEventListener("click",()=>void deactivateAccount());
    const signOut=button(security,"Sign out",async event=>{event.currentTarget.disabled=true;event.currentTarget.textContent="Signing out…";try{await api("/auth/logout",{method:"POST"});setAccount(null);window.location.assign("/?auth=login");}catch(error){event.currentTarget.disabled=false;event.currentTarget.textContent="Sign out";const signOutMessage=status(security);signOutMessage.textContent=error.message||"Could not sign out.";signOutMessage.classList.add("is-error");}},"small-btn");signOut.classList.add("settings-signout");
  }
  async function start() { if (["/privacy", "/terms", "/about", "/contact"].includes(path)) { setAccount(null); return informationPage(); } try { const user = await getUser(); setAccount(user); if ((userWorkspaceRoute||path==="/services/tracker")&&user&&user.role!=="USER") { location.assign(user.role==="AUTHOR"?"/admin/jobs":"/admin"); return; } if ((userWorkspaceRoute||path==="/services/tracker")&&!user) { loginFor(path); return; }
      if (path === "/jobs") return await jobsPage(user);
      if (path === "/communities") return await communitiesPage(user);
      if (isCommunityDetail) return await communityDetail(user);
      if (path === "/notifications") return await notificationsPage();
      if (path === "/faqs") return await faqsPage();
      if (path === "/boards") return await boardsPage();
      if (path === "/services/preparation") return await preparationPage();
      if (path === "/services/eligibility") return await eligibilityPage();
      if (path === "/services/tracker") return await trackerPage(user);
      if (path === "/dashboard"||path.startsWith("/dashboard/")||path==="/profile"||path==="/settings") return await accountPage(user);
      servicesPage();
    } catch (error) { console.error("Public page failed to load.", { errorType: error.name || "Error", code: error.code }); root.replaceChildren(); const wrap = page(t("errors.pageUnavailable"), t("errors.pageLoadFailed")); notice(wrap, t("errors.connectionRetry"), "is-error"); } }
  start();
})();
