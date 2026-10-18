# Beautifood demo video

A Remotion project for the ~100-second demo. Footage comes from the persona evidence videos
(`../docs/evidence/videos`, recorded by the Playwright tests) and screenshots in `public/`. `npm run clips` copies the recordings into `public/clips/` (dev and render do it for you).

```sh
npm i
npm run dev      # Remotion Studio
npm run render   # out/beautifood-demo.mp4
```

Without a downloaded Chrome, pass `--browser-executable` pointing at a chrome-headless-shell binary.
