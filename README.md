# Theatre Attendance Diary Dashboard

Static site package for GitHub Pages.

## Files

- `index.html` - page shell
- `style.css` - visual styling
- `app.js` - dashboard behavior
- `theatre-data.json` - normalized source data

## Free hosting with GitHub Pages

1. Create a free GitHub account.
2. Create a new public repository named `theatre-diary`.
3. Upload the four site files: `index.html`, `style.css`, `app.js`, and `theatre-data.json`.
4. Go to Settings > Pages.
5. Under Build and deployment, choose `Deploy from a branch`.
6. Branch: `main`; Folder: `/root`.
7. Save.
8. Open the URL GitHub gives you, usually `https://YOURUSERNAME.github.io/theatre-diary/`.

## Editing from phone

### Quick dashboard notes
Use the in-dashboard edit panel. These save to the current browser with localStorage. Use Export edits for backup.

### Permanent data changes
For permanent changes, replace/edit `theatre-data.json` in GitHub and commit. The site will update after GitHub Pages refreshes.

Important: free GitHub Pages is public. Do not include private info you would hate having on the open web.
