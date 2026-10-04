# Office Hours

A tiny, self-contained, full-screen office-simulator game. The 3D-style office, player, workstations, shift HUD, employee stats, activity log, action cards, and end-of-day screen are all rendered and played in one canvas. Clock in at 9, balance actual work with cartoonishly harmless office mischief, and make it to 5 without drawing too much suspicion.

## Controls

Walk around the office with **WASD** or the **arrow keys**, or use the on-screen directional pad on mobile. Drag to look around and click any workstation or in-game action card to take an action. Clicks on distant workstations automatically walk your character over to them.

## Play locally

Open `index.html` in a browser. No build step, dependencies, or server are required.

## Deploy to Vercel

Import the repository into Vercel and deploy it as a static site. The project does not need a build command or an output directory; Vercel serves `index.html` and the accompanying assets directly. The included `vercel.json` enables clean URLs and removes trailing slashes.

You can also deploy from the Vercel CLI:

```sh
npx vercel
```
