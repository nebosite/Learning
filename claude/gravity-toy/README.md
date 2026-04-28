# Gravity Simulation Toy

A browser-based n-body gravity simulator with real-time controls.

## Features

- Interactive gravitational physics simulation
- Canvas rendering with optional trails and velocity vectors
- Controls for simulation speed, body count, mass scale, and pause/reset
- Click to add bodies and drag bodies to reposition them

## Run locally

1. It is best to serve the files from a local HTTP server because the simulation loads ES modules.
2. Open `index.html` in your browser or run a simple server from this directory.

Example using Python:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Files

- `index.html` — UI layout and canvas container
- `styles.css` — visual styling and responsive layout
- `app.js` — physics engine, rendering loop, and UI bindings
