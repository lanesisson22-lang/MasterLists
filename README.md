# Masterlists

A simple, fast to-do list web app. No build step, no dependencies, and it works offline.

## Features

- Multiple lists: create, rename and delete them
- Add, complete, edit (double-click) and delete tasks
- Drag the ⠿ handle to reorder tasks (works with mouse and touch)
- Filter by All / To do / Done (plus any priority tag in use), and clear completed tasks
- **Set priority** link under every task (or tap an existing tag) to pick **Now**, **Next**, **Later**, **Big** or **None**, plus a **+ Note** link
- **Per-task options (⋯ menu):** give any task a priority tag (**Now**, **Next**, **Later**, **Big**) or remove it; add, edit or remove a note; move it into or out of a section; edit or delete it
- **Sections:** group a list into collapsible cards, each with an icon, its own progress bar and add box. Create one with **＋ Add section** or from a task's ⋯ menu, drag tasks between sections, and rename, reorder or remove sections from the section's ⋯ menu
- **Import from Claude:** tap ⤓ and paste a list Claude (or anyone) wrote. Bullets, numbers, `- [ ]`/`- [x]` checkboxes, bold, links and strikethrough are cleaned up; the title heading becomes the suggested list name, other headings become sections, and `[Now]`-style tags and `Note:` lines are picked up; chatty intro and outro lines are skipped. You can add to the current list or a new one. When installed on Android, Masterlists also appears in the Share menu, so you can share text from the Claude app straight into it.
- Undo for deletes and imports, and sharing a list through the share sheet (or copying it to the clipboard)
- Saves automatically in your browser (localStorage) and syncs across open tabs
- Light and dark mode follow your system setting
- Installable to a phone home screen or desktop (PWA), and works offline

## Run it

Serve the folder and open it in a browser:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Opening `index.html` directly also works, but offline support and installing need it to be served over http(s).

## Host it for free

Turn on **GitHub Pages**: repo **Settings → Pages → Build and deployment → Deploy from a branch**, pick `main` and `/ (root)`, and save. The app is then at **https://lanesisson22-lang.github.io/Masterlists/** (once the repo is named `Masterlists`). GitHub gives you a link you can open on any device. On a phone, use the browser's **Add to Home Screen** to install it like an app.

GitHub Pages on a free account requires the repo to be public.

## Files

| File | What it is |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Styles, including dark mode and phone layout |
| `app.js` | All app logic: lists, tasks, import parser, saving |
| `manifest.webmanifest`, `icon.svg`, `icons/` | Install-to-home-screen details and icons |
| `sw.js` | Service worker for offline use |
