(() => {
  "use strict";

  const STORAGE_KEY = "list-app:v1";

  // ---------- State ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const defaultState = () => {
    const id = uid();
    return {
      lists: [{ id, name: "My tasks", tasks: [] }],
      currentId: id,
      filter: "all",
    };
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.lists) || s.lists.length === 0) return defaultState();
      if (!s.lists.some((l) => l.id === s.currentId)) s.currentId = s.lists[0].id;
      if (!["all", "active", "done"].includes(s.filter)) s.filter = "all";
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

  // ---------- Undo ----------
  let undoSnapshot = null;
  let toastTimer = null;

  function withUndo(message, mutate) {
    undoSnapshot = JSON.stringify(state);
    mutate();
    commit();
    showToast(message);
  }

  function showToast(message) {
    $toastMsg.textContent = message;
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
  const $lists = $("lists");
  const $tasks = $("tasks");
  const $empty = $("empty");
  const $count = $("count");
  const $title = $("listTitle");
  const $taskInput = $("taskInput");
  const $clearDone = $("clearDone");
  const $sidebar = $("sidebar");
  const $scrim = $("scrim");
  const $toast = $("toast");
  const $toastMsg = $("toastMsg");

  function commit() {
    save();
    render();
  }

  function render() {
    renderLists();
    renderTasks();
  }

  function renderLists() {
    $lists.replaceChildren(
      ...state.lists.map((list) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = list.id === state.currentId ? "active" : "";
        btn.dataset.id = list.id;
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = list.name;
        const badge = document.createElement("span");
        badge.className = "badge";
        const left = list.tasks.filter((t) => !t.done).length;
        badge.textContent = left || "";
        btn.append(name, badge);
        li.append(btn);
        return li;
      })
    );
  }

  function visibleTasks(list) {
    if (state.filter === "active") return list.tasks.filter((t) => !t.done);
    if (state.filter === "done") return list.tasks.filter((t) => t.done);
    return list.tasks;
  }

  function renderTasks() {
    const list = current();
    $title.textContent = list.name;
    document.title = `${list.name} · List`;

    document.querySelectorAll(".filters button").forEach((b) => {
      b.classList.toggle("active", b.dataset.filter === state.filter);
    });

    const tasks = visibleTasks(list);
    $tasks.replaceChildren(...tasks.map(taskElement));

    const left = list.tasks.filter((t) => !t.done).length;
    const done = list.tasks.length - left;
    $count.textContent = `${left} ${left === 1 ? "task" : "tasks"} left`;
    $clearDone.disabled = done === 0;

    if (tasks.length === 0) {
      $empty.hidden = false;
      $empty.textContent =
        list.tasks.length === 0
          ? "Nothing here yet. Add your first task above."
          : state.filter === "active"
          ? "All done. Nice work!"
          : "No completed tasks yet.";
    } else {
      $empty.hidden = true;
    }
  }

  function taskElement(task) {
    const li = document.createElement("li");
    li.className = "task" + (task.done ? " done" : "");
    li.dataset.id = task.id;

    const handle = document.createElement("span");
    handle.className = "handle";
    handle.textContent = "⠿";
    handle.title = "Drag to reorder";
    handle.setAttribute("aria-hidden", "true");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "check";
    check.checked = task.done;
    check.setAttribute("aria-label", `Mark "${task.text}" as ${task.done ? "not done" : "done"}`);

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = task.text;
    text.title = "Double-click to edit";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "icon-btn edit-btn";
    edit.textContent = "✎";
    edit.setAttribute("aria-label", `Edit "${task.text}"`);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "icon-btn danger delete-btn";
    del.textContent = "✕";
    del.setAttribute("aria-label", `Delete "${task.text}"`);

    li.append(handle, check, text, edit, del);
    return li;
  }

  // ---------- Inline editing ----------
  function startEdit(li) {
    const list = current();
    const task = list.tasks.find((t) => t.id === li.dataset.id);
    if (!task) return;
    const textEl = li.querySelector(".text");
    const input = document.createElement("input");
    input.className = "edit";
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
    const input = document.createElement("input");
    input.className = "list-title-input";
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

  // ---------- Drag to reorder (pointer events: works with mouse and touch) ----------
  let drag = null;

  $tasks.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest(".handle");
    if (!handle) return;
    e.preventDefault();
    const li = handle.closest(".task");
    li.classList.add("dragging");
    drag = { id: li.dataset.id, overId: null, before: true };
    handle.setPointerCapture(e.pointerId);
  });

  $tasks.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const over = el && el.closest(".task");
    $tasks.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
    if (!over || over.dataset.id === drag.id) {
      drag.overId = null;
      return;
    }
    const rect = over.getBoundingClientRect();
    drag.overId = over.dataset.id;
    drag.before = e.clientY < rect.top + rect.height / 2;
    over.classList.add("drop-target");
  });

  const endDrag = () => {
    if (!drag) return;
    const { id, overId, before } = drag;
    drag = null;
    if (overId) {
      const tasks = current().tasks;
      const from = tasks.findIndex((t) => t.id === id);
      const [moved] = tasks.splice(from, 1);
      let to = tasks.findIndex((t) => t.id === overId);
      if (!before) to += 1;
      tasks.splice(to, 0, moved);
    }
    commit();
  };
  $tasks.addEventListener("pointerup", endDrag);
  $tasks.addEventListener("pointercancel", endDrag);

  // ---------- Events ----------
  $("addTaskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $taskInput.value.trim();
    if (!text) return;
    current().tasks.unshift({ id: uid(), text, done: false, created: Date.now() });
    $taskInput.value = "";
    if (state.filter === "done") state.filter = "all";
    commit();
  });

  $tasks.addEventListener("change", (e) => {
    if (!e.target.classList.contains("check")) return;
    const id = e.target.closest(".task").dataset.id;
    const task = current().tasks.find((t) => t.id === id);
    task.done = e.target.checked;
    commit();
  });

  $tasks.addEventListener("click", (e) => {
    const li = e.target.closest(".task");
    if (!li) return;
    if (e.target.closest(".delete-btn")) {
      const list = current();
      const task = list.tasks.find((t) => t.id === li.dataset.id);
      withUndo(`Deleted "${truncate(task.text)}"`, () => {
        list.tasks = list.tasks.filter((t) => t.id !== task.id);
      });
    } else if (e.target.closest(".edit-btn")) {
      startEdit(li);
    }
  });

  $tasks.addEventListener("dblclick", (e) => {
    if (e.target.classList.contains("text")) startEdit(e.target.closest(".task"));
  });

  document.querySelector(".filters").addEventListener("click", (e) => {
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
    state.lists.push({ id, name, tasks: [] });
    state.currentId = id;
    state.filter = "all";
    input.value = "";
    commit();
    closeSidebar();
    $taskInput.focus();
  });

  $("renameList").addEventListener("click", startRenameList);
  $title.addEventListener("dblclick", startRenameList);

  $("deleteList").addEventListener("click", () => {
    const list = current();
    if (list.tasks.length > 0 && !confirm(`Delete "${list.name}" and its ${list.tasks.length} task(s)?`)) return;
    withUndo(`Deleted list "${truncate(list.name)}"`, () => {
      state.lists = state.lists.filter((l) => l.id !== list.id);
      if (state.lists.length === 0) {
        const fresh = defaultState();
        state.lists = fresh.lists;
      }
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

  // Keep tabs in sync
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      render();
    }
  });

  function truncate(s, n = 30) {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  render();

  // Offline support
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
