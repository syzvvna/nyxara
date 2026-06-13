# NYXARA

**the night has coordinates.**

A full immersive rave discovery experience. Six cities, six venues, six
frequencies — entered through a door that was never supposed to be found.

**Live:** https://syzvvna.github.io/nyxara

## the journey

```
LOADING → INTRO → CONSTELLATION → DESCENDING → VENUE → ASCENDING → …
```

You arrive above a field of breathing stars. A door waits below the title.
Click it and you fall — three seconds through a tunnel of light — and land at
eye height inside TRESOR, Berlin, surrounded by 150 extruded human silhouettes
swaying out of sync, twelve lasers sweeping the smoke, a sub drone at 45Hz.

Six names hang in an arc on the left edge. Pick one. You ascend back through
the stars (they retint to the city you chose), then fall again somewhere else
on Earth.

| city | venue | drone |
|---|---|---|
| BERLIN | TRESOR | 45/90 Hz |
| TOKYO | WOMB | 48/96 Hz |
| MEXICO CITY | TEMPLE RAVE | 43/86 Hz |
| NEW YORK | AVANT GARDNER | 46/92 Hz |
| LONDON | FABRIC | 44/88 Hz |
| TBILISI | BASSIANI | 42/84 Hz |

## run it

Static files — any server works:

```sh
python3 -m http.server 8377
# → http://localhost:8377
```

Three.js r128 loads from CDN with a vendored fallback in `assets/vendor/`.

## controls

- **drag / swipe** — look around the room (360° yaw, −15°…+25° pitch)
- **left-edge menu** — travel
- **CALM** (top right) — kills strobe, RGB drift, head bob; damps all motion
- audio only ever starts from your click on the door

## tests

Headless against real Three.js (geometry, scene graphs, state machine, timing):

```sh
for f in test/test-*.mjs; do node "$f"; done
```

## structure

```
src/
├── main.js                 state machine, HUD, cursor, render loop
├── scenes/
│   ├── constellation.js    200 shader stars, nebula, the door
│   ├── descent.js          the 3s fall, streak smear, FOV pump
│   └── venue.js            six procedural architectures, fog, controls
├── components/
│   ├── crowd.js            extruded human silhouettes, 7 body types
│   ├── lasers.js           12 sweeping spotlight rigs + beam cones
│   ├── particles.js        300 rising smoke motes
│   └── radialMenu.js       the six-city arc
├── data/cities.js          colors, lore, coordinates, density
└── utils/                  math + gesture-gated dual-drone audio
```
