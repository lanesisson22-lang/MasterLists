(() => {
  "use strict";

  const STORAGE_KEY = "list-app:v1";

  // Priority tags any task can carry (or not).
  const TAGS = {
    now: { label: "Now", hint: "do first" },
    next: { label: "Next", hint: "up next" },
    later: { label: "Later", hint: "when there's time" },
    big: { label: "Big", hint: "major project" },
  };
  const TAG_IDS = Object.keys(TAGS);

  // Section icons (drawn in the accent colour).
  const ICONS = {
    list: '<path d="M8 11l3 3 5-6M8 22l3 3 5-6M20 11h13M20 22h13M20 32h13M10 32h3"/>',
    cart: '<path d="M4 8h5l4 17h17l3-12H11"/><circle cx="15" cy="31" r="2.5"/><circle cx="28" cy="31" r="2.5"/>',
    home: '<path d="M6 19L20 7l14 12M10 16v17h20V16M17 33v-9h6v9"/>',
    work: '<rect x="5" y="12" width="30" height="20" rx="3"/><path d="M15 12V8h10v4M5 21h30"/>',
    box: '<path d="M5 13l15-7 15 7v15l-15 7-15-7z"/><path d="M5 13l15 7 15-7M20 20v15"/>',
    shelf: '<path d="M6 5v31M34 5v31M6 13h28M6 23h28M6 33h28"/>',
    tools: '<path d="M27 5a8 8 0 0 0-8 10L6 28a3.5 3.5 0 0 0 5 5l13-13a8 8 0 0 0 10-8l-5 2-4-4z"/>',
    calendar: '<rect x="6" y="9" width="28" height="25" rx="3"/><path d="M6 17h28M13 5v7M27 5v7"/>',
    star: '<path d="M20 5l4.5 9.5 10.5 1.5-7.5 7.5 2 10.5-9.5-5-9.5 5 2-10.5L5 16l10.5-1.5z"/>',
    heart: '<path d="M20 33S6 24 6 15a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 9-14 18-14 18z"/>',
    bolt: '<path d="M22 4L9 22h10l-2 14 13-19H20z"/>',
    flag: '<path d="M9 35V6M9 7h20l-4 7 4 7H9"/>',
  };
  const iconSvg = (name) =>
    `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.list}</svg>`;

  // ---------- State ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const defaultState = () => {
    const id = uid();
    return {
      lists: [{ id, name: "My tasks", tasks: [], sections: [] }],
      currentId: id,
      filter: "all",
    };
  };

  const FILTERS = ["all", "active", "done", ...TAG_IDS.map((t) => "tag:" + t)];

  function readLocal() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function load(raw = readLocal()) {
    try {
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.lists) || s.lists.length === 0) return defaultState();
      for (const l of s.lists) {
        if (!Array.isArray(l.tasks)) l.tasks = [];
        if (!Array.isArray(l.sections)) l.sections = [];
        const ids = new Set(l.sections.map((x) => x.id));
        for (const t of l.tasks) if (t.sectionId && !ids.has(t.sectionId)) delete t.sectionId;
      }
      if (!s.lists.some((l) => l.id === s.currentId)) s.currentId = s.lists[0].id;
      if (!FILTERS.includes(s.filter)) s.filter = "all";
      return s;
    } catch {
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable (private mode etc.) — app still works in memory */
    }
  }

  let state = load();
  const current = () => state.lists.find((l) => l.id === state.currentId);
  const findTask = (id) => current().tasks.find((t) => t.id === id);
  const findSection = (id) => current().sections.find((s) => s.id === id);

  // ---------- Undo ----------
  let undoSnapshot = null;
  let toastTimer = null;

  function withUndo(message, mutate) {
    undoSnapshot = JSON.stringify(state);
    mutate();
    commit();
    showToast(message);
  }

  function showToast(message, canUndo = true) {
    $toastMsg.textContent = message;
    $("toastUndo").hidden = !canUndo;
    $toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 5000);
  }

  function hideToast() {
    $toast.hidden = true;
    undoSnapshot = null;
  }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const $lists = $("lists");
  const $board = $("board");
  const $tasks = $("tasks");
  const $sections = $("sections");
  const $empty = $("empty");
  const $count = $("count");
  const $title = $("listTitle");
  const $taskInput = $("taskInput");
  const $clearDone = $("clearDone");
  const $sidebar = $("sidebar");
  const $scrim = $("scrim");
  const $toast = $("toast");
  const $toastMsg = $("toastMsg");
  const $menu = $("menu");

  function commit() {
    save();
    render();
  }

  function render() {
    closeMenu();
    renderLists();
    renderBoard();
  }

  function renderLists() {
    $lists.replaceChildren(
      ...state.lists.map((list) => {
        const li = el("li");
        const btn = el("button", list.id === state.currentId ? "active" : "");
        btn.type = "button";
        btn.dataset.id = list.id;
        const total = list.tasks.length;
        const done = list.tasks.filter((t) => t.done).length;
        const mini = el("span", "mini");
        const fill = el("i");
        fill.style.width = total ? `${(done / total) * 100}%` : "0";
        mini.append(fill);
        btn.append(el("span", "name", list.name), el("span", "badge", total ? `${done}/${total}` : ""), mini);
        li.append(btn);
        return li;
      })
    );
  }

  function matchesFilter(task) {
    const f = state.filter;
    if (f === "active") return !task.done;
    if (f === "done") return task.done;
    if (f.startsWith("tag:")) return task.priority === f.slice(4);
    return true;
  }

  function renderFilters(list) {
    const used = new Set(list.tasks.map((t) => t.priority).filter(Boolean));
    const chips = [
      ["all", "All"],
      ["active", "To do"],
      ["done", "Done"],
      ...TAG_IDS.filter((t) => used.has(t) || state.filter === "tag:" + t).map((t) => ["tag:" + t, TAGS[t].label]),
    ];
    $("filters").replaceChildren(
      ...chips.map(([f, label]) => {
        const b = el("button", f === state.filter ? "active" : "", label);
        b.type = "button";
        b.dataset.filter = f;
        if (f.startsWith("tag:")) b.classList.add("tag-chip", "c-" + f.slice(4));
        return b;
      })
    );
    const legend = $("legend");
    legend.hidden = used.size === 0;
    legend.replaceChildren(
      ...TAG_IDS.filter((t) => used.has(t)).map((t) => {
        const s = el("span");
        s.append(tagEl(t), document.createTextNode(" " + TAGS[t].hint));
        return s;
      })
    );
  }

  function tagEl(t) {
    return el("span", `tag t-${t}`, TAGS[t].label);
  }

  function renderBoard() {
    const list = current();
    $title.textContent = list.name;
    document.title = `${list.name} · Masterlists`;
    renderFilters(list);

    const filtering = state.filter !== "all";
    const sectionIds = new Set(list.sections.map((s) => s.id));
    const loose = list.tasks.filter((t) => !t.sectionId || !sectionIds.has(t.sectionId));
    $tasks.replaceChildren(...loose.filter(matchesFilter).map(taskElement));

    $sections.replaceChildren(
      ...list.sections
        .map((sec) => {
          const items = list.tasks.filter((t) => t.sectionId === sec.id);
          const shown = items.filter(matchesFilter);
          if (filtering && shown.length === 0) return null;
          return sectionElement(sec, items, shown, filtering);
        })
        .filter(Boolean)
    );

    const total = list.tasks.length;
    const done = list.tasks.filter((t) => t.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $count.textContent = `${done} of ${total} done`;
    $("ovNum").textContent = `${pct}%`;
    $("ovBar").style.width = `${pct}%`;
    $clearDone.disabled = done === 0;

    const anyShown = $board.querySelector(".task");
    if (!anyShown && !(list.sections.length && !filtering)) {
      $empty.hidden = false;
      $empty.textContent =
        total === 0
          ? "Nothing here yet. Add your first task above."
          : state.filter === "active"
          ? "All done. Nice work!"
          : state.filter === "done"
          ? "No completed tasks yet."
          : "No tasks with this tag.";
    } else {
      $empty.hidden = true;
    }
    $tasks.hidden = loose.length === 0 && list.sections.length > 0;
  }

  function sectionElement(sec, items, shown, filtering) {
    const card = el("section", "card sec" + (sec.collapsed && !filtering ? " collapsed" : ""));
    card.dataset.section = sec.id;

    const head = el("div", "sec-head");
    const icon = el("div", "sec-icon");
    icon.innerHTML = iconSvg(sec.icon);
    const titleBox = el("div", "sec-title");
    const done = items.filter((t) => t.done).length;
    const mini = el("span", "mini");
    const fill = el("i");
    fill.style.width = items.length ? `${(done / items.length) * 100}%` : "0";
    mini.append(fill);
    titleBox.append(el("h3", null, sec.name), el("small", null, `${done} of ${items.length} done`), mini);
    const more = el("button", "icon-btn sec-more", "⋯");
    more.type = "button";
    more.setAttribute("aria-label", `Section options for "${sec.name}"`);
    const chev = el("span", "chev", "▾");
    chev.setAttribute("aria-hidden", "true");
    head.append(icon, titleBox, more, chev);
    head.setAttribute("role", "button");
    head.tabIndex = 0;
    head.setAttribute("aria-expanded", String(!card.classList.contains("collapsed")));

    const body = el("div", "sec-body");
    const ul = el("ul", "tasks");
    ul.dataset.section = sec.id;
    ul.append(...shown.map(taskElement));
    const form = el("form", "add-task sec-add");
    const input = el("input");
    input.type = "text";
    input.maxLength = 200;
    input.placeholder = `Add to ${sec.name}…`;
    input.setAttribute("aria-label", `New task in ${sec.name}`);
    input.autocomplete = "off";
    const add = el("button", "primary", "Add");
    add.type = "submit";
    form.append(input, add);
    body.append(ul, form);
    card.append(head, body);
    return card;
  }

  function taskElement(task) {
    const li = el("li", "task" + (task.done ? " done" : ""));
    li.dataset.id = task.id;

    const handle = el("span", "handle", "⠿");
    handle.title = "Drag to reorder";
    handle.setAttribute("aria-hidden", "true");

    const check = el("input", "check");
    check.type = "checkbox";
    check.checked = task.done;
    check.setAttribute("aria-label", `Mark "${task.text}" as ${task.done ? "not done" : "done"}`);

    const body = el("div", "body");
    const line = el("div", "line");
    if (task.priority && TAGS[task.priority]) line.append(tagEl(task.priority), document.createTextNode(" "));
    const text = el("span", "text", task.text);
    text.title = "Double-click to edit";
    line.append(text);
    body.append(line);

    if (typeof task.note === "string") {
      const note = el("textarea", "note");
      note.rows = 1;
      note.maxLength = 1000;
      note.value = task.note;
      note.placeholder = "Add a note…";
      note.setAttribute("aria-label", `Note for "${task.text}"`);
      body.append(note);
      requestAnimationFrame(() => autoGrow(note));
    }

    const more = el("button", "icon-btn more-btn", "⋯");
    more.type = "button";
    more.setAttribute("aria-label", `Options for "${task.text}"`);
    more.setAttribute("aria-haspopup", "menu");

    li.append(handle, check, body, more);
    return li;
  }

  function autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + 2 + "px";
  }

  // ---------- Pop-up menus ----------
  let menuFor = null;

  function openMenu(anchor, build) {
    closeMenu();
    $menu.replaceChildren();
    build($menu);
    $menu.hidden = false;
    menuFor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    const r = anchor.getBoundingClientRect();
    const m = $menu.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    let left = Math.min(Math.max(8, r.right - m.width), vw - m.width - 8);
    let top = r.bottom + 6;
    if (top + m.height > vh - 8) top = Math.max(8, r.top - m.height - 6);
    $menu.style.left = left + "px";
    $menu.style.top = top + "px";
    const first = $menu.querySelector("button");
    if (first) first.focus({ preventScroll: true });
  }

  function closeMenu() {
    if ($menu.hidden) return;
    $menu.hidden = true;
    if (menuFor) {
      menuFor.removeAttribute("aria-expanded");
      if (document.activeElement && $menu.contains(document.activeElement)) menuFor.focus({ preventScroll: true });
    }
    menuFor = null;
  }

  const menuLabel = (text) => el("div", "menu-label", text);

  function menuChip(label, active, onClick, cls = "") {
    const b = el("button", "menu-chip" + (active ? " on" : "") + (cls ? " " + cls : ""), label);
    b.type = "button";
    b.setAttribute("role", "menuitemradio");
    b.setAttribute("aria-checked", String(active));
    b.addEventListener("click", onClick);
    return b;
  }

  function menuItem(label, onClick, cls = "") {
    const b = el("button", "menu-item" + (cls ? " " + cls : ""), label);
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.addEventListener("click", onClick);
    return b;
  }

  function openTaskMenu(btn, task) {
    const list = current();
    openMenu(btn, (m) => {
      m.append(menuLabel("Priority"));
      const pri = el("div", "menu-chips");
      for (const t of TAG_IDS) {
        pri.append(
          menuChip(TAGS[t].label, task.priority === t, () => {
            task.priority = t;
            commit();
          }, "c-" + t)
        );
      }
      pri.append(
        menuChip("None", !task.priority, () => {
          delete task.priority;
          commit();
        })
      );
      m.append(pri);

      m.append(menuLabel("Section"));
      const secs = el("div", "menu-chips");
      for (const s of list.sections) {
        secs.append(
          menuChip(s.name, task.sectionId === s.id, () => {
            task.sectionId = s.id;
            s.collapsed = false;
            commit();
          })
        );
      }
      secs.append(
        menuChip("None", !task.sectionId, () => {
          delete task.sectionId;
          commit();
        }),
        menuChip("＋ New…", false, () => {
          closeMenu();
          openSectionDialog(null, task.id);
        }, "new")
      );
      m.append(secs);

      m.append(el("hr"));
      if (typeof task.note === "string") {
        m.append(
          menuItem("Remove note", () => {
            const had = task.note.trim();
            if (had) {
              withUndo("Note removed", () => delete task.note);
            } else {
              delete task.note;
              commit();
            }
          })
        );
      } else {
        m.append(
          menuItem("Add note", () => {
            task.note = "";
            commit();
            focusNote(task.id);
          })
        );
      }
      m.append(
        menuItem("Edit text", () => {
          closeMenu();
          const li = $board.querySelector(`.task[data-id="${task.id}"]`);
          if (li) startEdit(li);
        }),
        menuItem("Delete task", () => {
          withUndo(`Deleted "${truncate(task.text)}"`, () => {
            list.tasks = list.tasks.filter((t) => t.id !== task.id);
          });
        }, "danger")
      );
    });
  }

  function openSectionMenu(btn, sec) {
    const list = current();
    const idx = list.sections.indexOf(sec);
    const count = list.tasks.filter((t) => t.sectionId === sec.id).length;
    openMenu(btn, (m) => {
      m.append(
        menuItem("Rename or change icon", () => {
          closeMenu();
          openSectionDialog(sec);
        })
      );
      if (idx > 0)
        m.append(
          menuItem("Move up", () => {
            list.sections.splice(idx, 1);
            list.sections.splice(idx - 1, 0, sec);
            commit();
          })
        );
      if (idx < list.sections.length - 1)
        m.append(
          menuItem("Move down", () => {
            list.sections.splice(idx, 1);
            list.sections.splice(idx + 1, 0, sec);
            commit();
          })
        );
      m.append(el("hr"));
      m.append(
        menuItem(count ? "Remove section (keep its tasks)" : "Remove section", () => {
          withUndo(`Removed section "${truncate(sec.name)}"`, () => {
            list.sections = list.sections.filter((s) => s.id !== sec.id);
            for (const t of list.tasks) if (t.sectionId === sec.id) delete t.sectionId;
          });
        }, "danger")
      );
      if (count)
        m.append(
          menuItem(`Delete section and its ${count} ${count === 1 ? "task" : "tasks"}`, () => {
            withUndo(`Deleted "${truncate(sec.name)}" and ${count} ${count === 1 ? "task" : "tasks"}`, () => {
              list.sections = list.sections.filter((s) => s.id !== sec.id);
              list.tasks = list.tasks.filter((t) => t.sectionId !== sec.id);
            });
          }, "danger")
        );
    });
  }

  document.addEventListener("pointerdown", (e) => {
    if (!$menu.hidden && !$menu.contains(e.target) && e.target !== menuFor) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$menu.hidden) {
      e.preventDefault();
      closeMenu();
    }
  });
  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", closeMenu, { passive: true });

  function focusNote(taskId) {
    const ta = $board.querySelector(`.task[data-id="${taskId}"] .note`);
    if (ta) {
      ta.focus();
      ta.scrollIntoView({ block: "nearest" });
    }
  }

  // ---------- Section dialog ----------
  const $sectionDialog = $("sectionDialog");
  const $sectionName = $("sectionName");
  let sectionEditing = null;
  let sectionAssignTask = null;

  $("iconGrid").replaceChildren(
    ...Object.keys(ICONS).map((name) => {
      const label = el("label", "icon-opt");
      label.title = name;
      const radio = el("input");
      radio.type = "radio";
      radio.name = "icon";
      radio.value = name;
      radio.setAttribute("aria-label", name);
      const span = el("span");
      span.innerHTML = iconSvg(name);
      label.append(radio, span);
      return label;
    })
  );

  function openSectionDialog(sec, assignTaskId = null) {
    sectionEditing = sec;
    sectionAssignTask = assignTaskId;
    $("sectionTitle").textContent = sec ? "Edit section" : "New section";
    $("sectionSave").textContent = sec ? "Save" : "Add section";
    $sectionName.value = sec ? sec.name : "";
    $("sectionForm").elements.icon.value = sec ? sec.icon : "list";
    closeSidebar();
    if (typeof $sectionDialog.showModal === "function") $sectionDialog.showModal();
    else $sectionDialog.setAttribute("open", "");
    $sectionName.focus();
  }

  $("sectionCancel").addEventListener("click", () => $sectionDialog.close());
  $("sectionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $sectionName.value.trim().slice(0, 60);
    if (!name) return $sectionName.focus();
    const icon = $("sectionForm").elements.icon.value || "list";
    const list = current();
    if (sectionEditing) {
      sectionEditing.name = name;
      sectionEditing.icon = icon;
    } else {
      const sec = { id: uid(), name, icon, collapsed: false };
      list.sections.push(sec);
      const task = sectionAssignTask && findTask(sectionAssignTask);
      if (task) task.sectionId = sec.id;
    }
    $sectionDialog.close();
    commit();
  });

  $("addSection").addEventListener("click", () => openSectionDialog(null));

  // ---------- Inline editing ----------
  function startEdit(li) {
    const task = findTask(li.dataset.id);
    if (!task) return;
    const textEl = li.querySelector(".text");
    const input = el("input", "edit");
    input.value = task.text;
    input.maxLength = 200;
    input.setAttribute("aria-label", "Edit task");
    textEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (keep) => {
      if (finished) return;
      finished = true;
      const value = input.value.trim();
      if (keep && value) task.text = value;
      commit();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(true);
      if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  }

  function startRenameList() {
    const list = current();
    const input = el("input", "list-title-input");
    input.value = list.name;
    input.maxLength = 60;
    input.setAttribute("aria-label", "List name");
    $title.hidden = true;
    $title.after(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (keep) => {
      if (finished) return;
      finished = true;
      const value = input.value.trim();
      if (keep && value) list.name = value;
      input.remove();
      $title.hidden = false;
      commit();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(true);
      if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  }

  // ---------- Drag to reorder / move between sections (mouse and touch) ----------
  let drag = null;

  const clearDropMarks = () =>
    $board.querySelectorAll(".drop-target, .drop-into").forEach((n) => n.classList.remove("drop-target", "drop-into"));

  $board.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest(".handle");
    if (!handle) return;
    e.preventDefault();
    const li = handle.closest(".task");
    li.classList.add("dragging");
    drag = { id: li.dataset.id, overId: null, before: true, intoSection: undefined };
    handle.setPointerCapture(e.pointerId);
  });

  $board.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    clearDropMarks();
    drag.overId = null;
    drag.intoSection = undefined;
    if (!hit) return;
    const over = hit.closest(".task");
    if (over && over.dataset.id !== drag.id) {
      const rect = over.getBoundingClientRect();
      drag.overId = over.dataset.id;
      drag.before = e.clientY < rect.top + rect.height / 2;
      over.classList.add("drop-target");
      return;
    }
    const card = !over && hit.closest(".card");
    if (card) {
      drag.intoSection = card.classList.contains("sec") ? card.dataset.section : "";
      card.classList.add("drop-into");
    }
  });

  const endDrag = () => {
    if (!drag) return;
    const { id, overId, before, intoSection } = drag;
    drag = null;
    clearDropMarks();
    const tasks = current().tasks;
    const from = tasks.findIndex((t) => t.id === id);
    if (overId) {
      const [moved] = tasks.splice(from, 1);
      const target = tasks.find((t) => t.id === overId);
      let to = tasks.indexOf(target);
      if (!before) to += 1;
      if (target.sectionId) moved.sectionId = target.sectionId;
      else delete moved.sectionId;
      tasks.splice(to, 0, moved);
    } else if (intoSection !== undefined) {
      const moved = tasks[from];
      if (intoSection) {
        moved.sectionId = intoSection;
        const sec = findSection(intoSection);
        if (sec) sec.collapsed = false;
      } else delete moved.sectionId;
    }
    commit();
  };
  $board.addEventListener("pointerup", endDrag);
  $board.addEventListener("pointercancel", endDrag);

  // ---------- Events ----------
  function addTask(text, sectionId) {
    const task = { id: uid(), text, done: false, created: Date.now() };
    if (sectionId) task.sectionId = sectionId;
    current().tasks.unshift(task);
    if (state.filter !== "all" && state.filter !== "active") state.filter = "all";
  }

  $("addTaskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $taskInput.value.trim();
    if (!text) return;
    addTask(text);
    $taskInput.value = "";
    commit();
  });

  $board.addEventListener("submit", (e) => {
    const form = e.target.closest(".sec-add");
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector("input");
    const text = input.value.trim();
    if (!text) return;
    const secId = form.closest(".sec").dataset.section;
    addTask(text, secId);
    commit();
    const again = $board.querySelector(`.sec[data-section="${secId}"] .sec-add input`);
    if (again) again.focus();
  });

  $board.addEventListener("change", (e) => {
    if (!e.target.classList.contains("check")) return;
    const task = findTask(e.target.closest(".task").dataset.id);
    task.done = e.target.checked;
    commit();
  });

  $board.addEventListener("click", (e) => {
    const more = e.target.closest(".more-btn");
    if (more) {
      if (menuFor === more) return closeMenu();
      return openTaskMenu(more, findTask(more.closest(".task").dataset.id));
    }
    const secMore = e.target.closest(".sec-more");
    if (secMore) {
      if (menuFor === secMore) return closeMenu();
      return openSectionMenu(secMore, findSection(secMore.closest(".sec").dataset.section));
    }
    const head = e.target.closest(".sec-head");
    if (head) toggleSection(head);
  });

  $board.addEventListener("keydown", (e) => {
    const head = e.target.classList && e.target.classList.contains("sec-head") ? e.target : null;
    if (head && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggleSection(head);
    }
  });

  function toggleSection(head) {
    if (state.filter !== "all") return;
    const sec = findSection(head.closest(".sec").dataset.section);
    sec.collapsed = !sec.collapsed;
    commit();
    const again = $board.querySelector(`.sec[data-section="${sec.id}"] .sec-head`);
    if (again) again.focus({ preventScroll: true });
  }

  $board.addEventListener("dblclick", (e) => {
    if (e.target.classList.contains("text")) startEdit(e.target.closest(".task"));
  });

  // Notes: save as you type, tidy up when you leave the box.
  $board.addEventListener("input", (e) => {
    if (!e.target.classList.contains("note")) return;
    const task = findTask(e.target.closest(".task").dataset.id);
    task.note = e.target.value;
    autoGrow(e.target);
    save();
  });
  $board.addEventListener("focusout", (e) => {
    if (!e.target.classList.contains("note")) return;
    const task = findTask(e.target.closest(".task").dataset.id);
    if (task && typeof task.note === "string" && !task.note.trim()) {
      delete task.note;
      setTimeout(commit);
    }
  });

  $("filters").addEventListener("click", (e) => {
    const f = e.target.dataset && e.target.dataset.filter;
    if (!f) return;
    state.filter = f;
    commit();
  });

  $clearDone.addEventListener("click", () => {
    const list = current();
    const n = list.tasks.filter((t) => t.done).length;
    if (!n) return;
    withUndo(`Cleared ${n} completed ${n === 1 ? "task" : "tasks"}`, () => {
      list.tasks = list.tasks.filter((t) => !t.done);
    });
  });

  $lists.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.currentId = btn.dataset.id;
    commit();
    closeSidebar();
    $taskInput.focus();
  });

  $("newListForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("newListInput");
    const name = input.value.trim();
    if (!name) return;
    const id = uid();
    state.lists.push({ id, name, tasks: [], sections: [] });
    state.currentId = id;
    state.filter = "all";
    input.value = "";
    commit();
    closeSidebar();
    $taskInput.focus();
  });

  $("renameList").addEventListener("click", startRenameList);
  $title.addEventListener("dblclick", startRenameList);

  // Share as plain text that the importer can read back (sections, tags and notes included).
  function listToText(list) {
    const line = (t) => {
      const tag = t.priority && TAGS[t.priority] ? `[${TAGS[t.priority].label}] ` : "";
      const note = t.note && t.note.trim() ? "\n   Note: " + t.note.trim().replace(/\s*\n\s*/g, " / ") : "";
      return `${t.done ? "☑" : "☐"} ${tag}${t.text}${note}`;
    };
    const ids = new Set(list.sections.map((s) => s.id));
    const parts = [`# ${list.name}`];
    const loose = list.tasks.filter((t) => !t.sectionId || !ids.has(t.sectionId));
    if (loose.length) parts.push(loose.map(line).join("\n"));
    for (const s of list.sections) {
      const items = list.tasks.filter((t) => t.sectionId === s.id);
      parts.push(`## ${s.name}` + (items.length ? "\n" + items.map(line).join("\n") : ""));
    }
    return parts.join("\n\n");
  }

  $("shareList").addEventListener("click", async () => {
    const list = current();
    const text = listToText(list);
    try {
      if (navigator.share) {
        await navigator.share({ title: list.name, text });
      } else {
        await navigator.clipboard.writeText(text);
        showToast("List copied to clipboard", false);
      }
    } catch {
      /* user cancelled the share sheet */
    }
  });

  $("deleteList").addEventListener("click", () => {
    const list = current();
    if (list.tasks.length > 0 && !confirm(`Delete "${list.name}" and its ${list.tasks.length} task(s)?`)) return;
    withUndo(`Deleted list "${truncate(list.name)}"`, () => {
      state.lists = state.lists.filter((l) => l.id !== list.id);
      if (state.lists.length === 0) state.lists = defaultState().lists;
      state.currentId = state.lists[0].id;
    });
  });

  $("toastUndo").addEventListener("click", () => {
    if (undoSnapshot) {
      state = JSON.parse(undoSnapshot);
      commit();
    }
    hideToast();
  });

  // Mobile sidebar
  function openSidebar() {
    $sidebar.classList.add("open");
    $scrim.hidden = false;
  }
  function closeSidebar() {
    $sidebar.classList.remove("open");
    $scrim.hidden = true;
  }
  $("openSidebar").addEventListener("click", openSidebar);
  $("closeSidebar").addEventListener("click", closeSidebar);
  $scrim.addEventListener("click", closeSidebar);

  // Keep tabs in sync (but don't yank a note out from under the cursor)
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = load();
    if (!(document.activeElement && document.activeElement.classList.contains("note"))) render();
  });

  function truncate(s, n = 30) {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  // ---------- Import (paste a list, e.g. one Claude wrote) ----------
  const BULLET = /^(?:[-*+•▪◦‣–]|\d{1,3}[.)]|[a-zA-Z][.)])\s+/;
  const CHECKBOX = /^\[( |x|X|✓|✔)?\]\s*/;
  const DONE_MARK = /^[☑☒✅✔✓]\s*/;
  const OPEN_MARK = /^[☐□○◯]\s*/;
  const TAG_MARK = new RegExp(`^[\\[(](${TAG_IDS.join("|")})[\\])]\\s*[:\\-–]?\\s*`, "i");
  const NOTE_LINE = /^(?:[-*•]\s*)?(?:note|notes)\s*:\s*/i;

  function cleanInline(text) {
    return text
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) -> text
      .replace(/(\*\*|__)(.+?)\1/g, "$2") // **bold** / __bold__
      .replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, "$1$2") // *italic*
      .replace(/`([^`]*)`/g, "$1") // `code`
      .replace(/\s+/g, " ")
      .trim();
  }

  // Turns pasted text into { name, tasks: [{ text, done, priority?, note?, section? }] }.
  // Headings become sections; a title heading (a "# " heading, or one with nothing under it
  // before the next heading, or the only heading) becomes the suggested list name.
  function parseList(raw) {
    const lines = String(raw || "").replace(/\r\n?/g, "\n").split("\n");
    let inFence = false;
    const rows = [];
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (!t || /^([-*_=])\1{2,}$/.test(t) || /^\|?[\s:-]+\|[\s|:-]*$/.test(t)) continue; // blank, rules, table dividers
      rows.push({ t, inFence });
    }

    const isItem = (t) => BULLET.test(t) || CHECKBOX.test(t) || DONE_MARK.test(t) || OPEN_MARK.test(t);
    // If the text has a real list in it, ignore the prose around it ("Here's your list:", "Let me know…").
    const listMode = rows.filter((r) => isItem(r.t) && !NOTE_LINE.test(r.t)).length >= 2;

    const groups = [{ heading: null, level: 0, tasks: [] }];
    for (const { t, inFence } of rows) {
      const heading = t.match(/^(#{1,6})\s+(.*)$/);
      const boldLine = !inFence && t.match(/^(\*\*|__)([^*_]+)\1:?$/);
      if (heading || boldLine) {
        const text = cleanInline((heading ? heading[2] : boldLine[2]).replace(/:$/, "")).slice(0, 60);
        if (text) groups.push({ heading: text, level: heading ? heading[1].length : 3, tasks: [] });
        continue;
      }
      const group = groups[groups.length - 1];
      const last = group.tasks[group.tasks.length - 1];
      if (NOTE_LINE.test(t) && last) {
        const note = t.replace(NOTE_LINE, "").trim();
        if (note) last.note = last.note ? last.note + "\n" + note : note;
        continue;
      }

      let text = t;
      if (listMode && !isItem(text)) continue;
      if (/^\|.*\|$/.test(text)) text = text.slice(1, -1).split("|").map((c) => c.trim()).filter(Boolean)[0] || ""; // first table cell

      let done = false;
      text = text.replace(/^>\s*/, "").replace(BULLET, "");
      const box = text.match(CHECKBOX);
      if (box) {
        done = !!box[1] && box[1] !== " ";
        text = text.slice(box[0].length);
      } else if (DONE_MARK.test(text)) {
        done = true;
        text = text.replace(DONE_MARK, "");
      } else {
        text = text.replace(OPEN_MARK, "");
      }
      let priority;
      const tag = text.match(TAG_MARK);
      if (tag) {
        priority = tag[1].toLowerCase();
        text = text.slice(tag[0].length);
      }
      const strike = text.match(/^~~(.+)~~$/);
      if (strike) {
        done = true;
        text = strike[1];
      }
      text = cleanInline(text.replace(/~~/g, "")).slice(0, 200);
      if (!text) continue;
      const task = { text, done };
      if (priority) task.priority = priority;
      group.tasks.push(task);
    }

    // Decide which heading (if any) is the list's title.
    let name = "";
    const headed = groups.filter((g) => g.heading);
    const first = headed[0];
    if (first) {
      const loneHeading = headed.length === 1 && groups[0].tasks.length === 0;
      const emptyTitle = first.tasks.length === 0 && headed.length > 1;
      if (first.level === 1 || loneHeading || emptyTitle) {
        name = first.heading;
        first.isTitle = true;
      }
    }
    const tasks = [];
    for (const g of groups) {
      const section = g.heading && !g.isTitle ? g.heading : undefined;
      for (const t of g.tasks) tasks.push(section ? { ...t, section } : t);
    }
    return { name, tasks };
  }

  const $importDialog = $("importDialog");
  const $importText = $("importText");
  const $importPreview = $("importPreview");
  const $importConfirm = $("importConfirm");
  const $importListName = $("importListName");
  let importNameTouched = false;

  const importTarget = () => $("importForm").elements.target.value;

  function updateImportPreview() {
    const { name, tasks } = parseList($importText.value);
    const shown = [];
    let lastSection;
    for (const t of tasks.slice(0, 60)) {
      if (t.section !== lastSection && t.section) shown.push(el("li", "sec-row", t.section));
      lastSection = t.section;
      const li = el("li", t.done ? "done" : "");
      if (t.priority) li.append(tagEl(t.priority), document.createTextNode(" "));
      li.append(document.createTextNode(t.text));
      if (t.note) li.append(el("small", "note-prev", t.note));
      shown.push(li);
    }
    if (tasks.length > 60) shown.push(el("li", "more", `+ ${tasks.length - 60} more`));
    $importPreview.replaceChildren(...shown);
    $importConfirm.disabled = tasks.length === 0;
    $importConfirm.textContent = tasks.length ? `Add ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}` : "Add tasks";
    if (!importNameTouched) $importListName.value = name;
    $importListName.placeholder = name || "List name";
  }

  function openImport(prefill = "") {
    $importText.value = prefill;
    importNameTouched = false;
    $("currentListLabel").textContent = `"${truncate(current().name, 24)}"`;
    $("importForm").elements.target.value = "current";
    $importListName.hidden = true;
    updateImportPreview();
    closeSidebar();
    if (typeof $importDialog.showModal === "function") $importDialog.showModal();
    else $importDialog.setAttribute("open", "");
    $importText.focus();
  }

  function closeImport() {
    if ($importDialog.open) $importDialog.close();
  }

  const canReadClipboard = !!(navigator.clipboard && navigator.clipboard.readText);
  $("pasteBtn").hidden = !canReadClipboard;
  $("pasteBtn").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        $importText.value = text;
        updateImportPreview();
      }
    } catch {
      $importText.focus();
      $importText.placeholder = "Couldn't read the clipboard. Long-press here and choose Paste.";
    }
  });

  $("importBtn").addEventListener("click", () => openImport());
  $("importCancel").addEventListener("click", closeImport);
  $importText.addEventListener("input", updateImportPreview);
  $importListName.addEventListener("input", () => (importNameTouched = true));
  $("importForm").addEventListener("change", (e) => {
    if (e.target.name !== "target") return;
    $importListName.hidden = importTarget() !== "new";
    if (!$importListName.hidden) $importListName.focus();
  });

  $("importForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const { name, tasks } = parseList($importText.value);
    if (!tasks.length) return;
    const toNew = importTarget() === "new";
    const listName = ($importListName.value.trim() || name || "Imported").slice(0, 60);
    const n = tasks.length;
    withUndo(`Imported ${n} ${n === 1 ? "task" : "tasks"}${toNew ? ` into "${truncate(listName)}"` : ""}`, () => {
      let list;
      if (toNew) {
        list = { id: uid(), name: listName, tasks: [], sections: [] };
        state.lists.push(list);
        state.currentId = list.id;
      } else {
        list = current();
      }
      const sectionFor = (secName) => {
        let sec = list.sections.find((s) => s.name.toLowerCase() === secName.toLowerCase());
        if (!sec) {
          sec = { id: uid(), name: secName, icon: "list", collapsed: false };
          list.sections.push(sec);
        }
        return sec.id;
      };
      const now = Date.now();
      const newTasks = tasks.map((t, i) => {
        const task = { id: uid(), text: t.text, done: t.done, created: now + i };
        if (t.priority) task.priority = t.priority;
        if (t.note) task.note = t.note;
        if (t.section) task.sectionId = sectionFor(t.section);
        return task;
      });
      list.tasks.unshift(...newTasks);
      state.filter = "all";
    });
    closeImport();
  });

  // Text shared to the installed web app (Android "Share → Masterlists") arrives as URL parameters.
  function handleSharedText() {
    const params = new URLSearchParams(location.search);
    const shared = ["title", "text", "url"].map((k) => params.get(k)).filter(Boolean).join("\n");
    if (!shared) return;
    history.replaceState(null, "", location.pathname);
    openImport(shared);
  }

  render();
  handleSharedText();

  // Offline support
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
