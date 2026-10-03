# Fantasy Football Dashboard

A side project, live at **[joaquinvargas.me/fantasy-football-dashboard](https://joaquinvargas.me/fantasy-football-dashboard/)**.

Built with React and [Vite](https://vite.dev).

## Run it locally

```sh
npm install      # first time only
npm run dev      # starts a dev server with live reload
```

Then open the address it prints (usually http://localhost:5173/fantasy-football-dashboard/).

To check the production build: `npm run build`, then `npm run preview`.

## Deploying

Every push to `main` builds the app and publishes it to GitHub Pages automatically (see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). Progress shows under the repo's **Actions** tab.

`base` in [`vite.config.js`](vite.config.js) must match the repo name (`'/fantasy-football-dashboard/'`). If the repo is ever renamed, update it, or the live site loads a blank page.

## API keys

Anything in this app is public: GitHub Pages serves static files, so any key in the code can be read in the browser's dev tools. If the dashboard needs a secret API key, move hosting to Vercel or Netlify and call the API from a serverless function there.
