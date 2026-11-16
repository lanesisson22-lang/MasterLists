# List

A simple, fast to-do list web app. No build step, no dependencies, and it works offline.

## Features

- Multiple lists: create, rename and delete them
- Add, complete, edit (double-click or ✎) and delete tasks
- Drag the ⠿ handle to reorder tasks (works with mouse and touch)
- Filter by All / Active / Done, and clear completed tasks
- Undo for deletes
- Saves automatically in your browser (localStorage) and syncs across open tabs
- Light and dark mode follow your system setting
- Installable as an app on phone or desktop (PWA), and works offline

## Run it

Open `index.html` in a browser, or serve the folder to enable offline/install support:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

To host it for free, enable **GitHub Pages** for this repo (Settings → Pages → deploy from branch) and open the URL it gives you.
