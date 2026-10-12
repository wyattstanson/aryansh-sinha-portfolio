# aryansh-portfolio

Personal site for Aryansh Sinha. Static HTML, CSS and JavaScript with no build step.

- **Hero:** a raw WebGL shader renders the portrait in monochrome. The cursor leaves a trail that bends the image and lets the colour through. On touch screens the reveal drifts by itself.
- **Scroll:** Lenis smooth scrolling and GSAP ScrollTrigger drive these scenes:
  - the name scatters as the hero pins
  - an about sheet slides over the hero, then its manifesto lights up word by word
  - the project list skews with scroll velocity
  - the gallery pans horizontally
  - the experience cards stack
  - the tools marquee reacts to scroll speed and direction
- **Hover guide:** hovering a project opens a panel that follows the cursor. It walks through how the project works, one step at a time. On touch screens a tap expands the same walkthrough inline.
- **Fallbacks:** reduced motion, no WebGL and a failed CDN load all degrade to a static, fully readable page.

## Run locally

The page uses ES modules, and the hero reads its photo as a WebGL texture, so serve it over HTTP. Opening `index.html` from disk won't work.

```bash
python -m http.server 8777 --bind 127.0.0.1
```

Then open http://127.0.0.1:8777.

## Edit content

- Projects, walkthrough steps and social links: `js/data.js`
- Experience, education and the about text: `index.html`
- Portrait: `assets/portrait.webp`
- Project screenshots: `assets/shots/`

## Tests

```bash
npm test
```

This covers the pure helpers in `js/lib.js`: guide placement, cover-fit maths for the shader, marquee wrapping and loader progress.

## Deploy

The repo works on any static host as it is:

- **GitHub Pages:** push the repo, then set Settings > Pages > Deploy from branch > `main` / root.
- **Vercel:** import the repo with framework preset "Other" and no build command.
