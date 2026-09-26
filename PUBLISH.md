# Publishing tss-demo to GitHub Pages (website only, no terminal)

The contents of this folder (`~/Desktop/tss-demo/`) become the root of a public GitHub
repository named `tss-demo`. GitHub Pages then serves it at:

    https://khaledismail-sandbox.github.io/tss-demo/

Everything below is done in the browser on github.com while signed in as
`khaledismail-sandbox`.

## First publish

1. Go to **github.com** → click the **+** menu (top right) → **New repository**.
   - Repository name: `tss-demo`
   - Visibility: **Public**
   - Leave "Add a README", ".gitignore" and "license" **unchecked** (the repo must start empty).
   - Click **Create repository**.
2. On the empty-repository page, under "Quick setup", click the link **uploading an existing file**.
3. Open `~/Desktop/tss-demo` in Finder. Press **⌘A** to select **everything inside the folder**
   (not the `tss-demo` folder itself) and drag the selection into the upload area on GitHub.
   Wait until every file and folder is listed under the drop zone (the folder structure
   `css/`, `js/`, `events/`, `venue/`, … is kept automatically).
4. Scroll down and click **Commit changes** (leave the default message and "Commit directly to the main branch").
5. In the repository, click **Settings** (top tab) → left sidebar **Pages**.
   - Under **Build and deployment** → **Source**: choose **Deploy from a branch**.
   - **Branch**: `main`, folder **/ (root)** → click **Save**.
6. Wait 1–2 minutes (refresh the Pages settings page until it shows "Your site is live at …"),
   then open **https://khaledismail-sandbox.github.io/tss-demo/**.

## Updating later

1. Open the repository on github.com → click **Add file** → **Upload files**.
2. Drag the changed files or folders from `~/Desktop/tss-demo` into the upload area
   (uploading a folder replaces the files inside it with the same names).
3. Click **Commit changes**. Pages redeploys in about a minute; hard-refresh the site
   (**⌘⇧R**) to bypass the browser cache.

## Notes

- Keep the total file count under 100 and never add a file or folder whose name starts
  with `_` or `.` — GitHub Pages ignores or rejects those.
- `404.html` must stay in the root: it serves every dynamic route
  (`/tss-demo/invites/…`, `/tss-demo/collabs/…`, `/tss-demo/venue/offers/…`).
- The site sends no Amplitude events when opened on `localhost`; it only sends from the
  GitHub Pages URL.
