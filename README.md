# personal-site

My personal site. Everything is squares.

Runs with no build step, just open `index.html` (or `python3 -m http.server`).

The square engine is one I originally built for another project and adapted
here: a canvas grid that idles quietly, flies into pixel-font words and shapes,
follows the mouse as a cursor made of squares, and ripples when you click.

- `squares.js` - the grid engine
- `squares-button.js` - buttons made of squares (hover to see why)
- `patterns.js` - pixel font + shapes (yes there's a polar bear)
- `main.js` - hero/footer setup, icons, scroll reveals
- `styles.css`, `index.html` - the rest

New hero frames go in `heroFormations()` in main.js. New shapes go in
`SHAPES` in patterns.js, numbers map to colors through each shape's colorMap.
# gabrielsaunders
