# Gravity Simulation Toy

A browser-based 3D n-body gravity simulator with astronomical objects and collision merging.

## Features

- 3D gravitational physics simulation with Cannon-ES
- Astronomical objects: central star, orbiting planets, and comets
- Collision detection and mass merging with momentum conservation
- Real-time controls for star mass, body count, simulation speed, trails, and velocity vectors
- Interactive 3D camera with orbit controls
- Click canvas to add comet bodies

## Controls

- **Star mass**: Controls the mass of the central star (in solar masses)
- **Body count**: Total number of bodies (star + planets + comets)
- **Simulation speed**: Adjusts physics time step
- **Show trails**: Toggle orbital trails
- **Show velocity vectors**: Toggle velocity direction indicators
- **Pause/Resume**: Stop/start simulation
- **Reset**: Generate new solar system
- **Add/Remove body**: Manually add/remove comets

## Physics

- Newtonian gravity between all bodies
- Collision merging: smaller body merges into larger one
- Orbital mechanics for planets around central star
- Momentum and mass conservation during merges

## Run locally

1. It is best to serve the files from a local HTTP server because the simulation loads ES modules.
2. Open `index.html` in your browser or run a simple server from this directory.

Example using Python:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Files

- `index.html` — UI layout with import map for ES modules
- `styles.css` — visual styling and responsive layout
- `app.js` — 3D physics engine, rendering loop, and UI bindings
