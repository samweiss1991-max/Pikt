# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pikt is a browser-based table tennis game rendered with HTML5 Canvas. It is a single-file application (`Pikt v1.html`) — no build tools, dependencies, or package manager.

## Running

Open `Pikt v1.html` directly in a browser. No server or build step required.

## Architecture

The game is a single HTML file containing inline CSS and JavaScript:

- **Rendering**: HTML5 Canvas (2D context), 500x700px, using `requestAnimationFrame` for the game loop
- **Input**: Mouse-driven — player paddle follows cursor X position; click to start/restart
- **AI**: Simple tracking AI that follows the ball's X position with a speed cap
- **Physics**: Custom ball-paddle collision with angle-based deflection (up to 60°) and incremental speed increases (capped at 10)
- **Scoring**: First to 7 points wins; score tracked in DOM overlay elements

Key constants: `TABLE` defines the play area with 30px margins; `PADDLE_W=70`, `PADDLE_H=12`; ball radius 8px with an 8-frame trail effect.

## Git Workflow

All changes should be committed with clear messages and pushed to GitHub (origin: `samweiss1991-max/Pikt`). The repo uses the `master` branch.
