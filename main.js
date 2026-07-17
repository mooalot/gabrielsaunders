const ACCENTS = {
  ink: '#0f172a',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
};

function heroFormations(isSmall) {
  if (isSmall) {
    return [
      [{ type: 'word', words: ['GABRIEL', 'SAUNDERS'], layout: 'vertical', color: [ACCENTS.ink, ACCENTS.blue] }],
      [{ type: 'word', words: ['I MAKE', 'SQUARES', 'DO THINGS'], layout: 'vertical', color: [ACCENTS.ink, ACCENTS.amber, ACCENTS.ink] }],
      [
        { type: 'shape', shape: SHAPES.editor.pattern, colorMap: SHAPES.editor.colorMap, offsetY: -7, maxScale: 0.8 },
        { type: 'word', words: ['NO CODE', 'EDITORS'], layout: 'vertical', color: ACCENTS.blue, offsetY: 8, maxScale: 0.55 },
      ],
      [
        { type: 'shape', shape: SHAPES.polarBear.pattern, colorMap: SHAPES.polarBear.colorMap, offsetY: -7, maxScale: 0.8 },
        { type: 'word', words: ['POLAR BEAR', 'RADAR'], layout: 'vertical', color: [ACCENTS.ink, ACCENTS.red], offsetY: 8, maxScale: 0.55 },
      ],
      [
        { type: 'shape', shape: SHAPES.controller.pattern, colorMap: SHAPES.controller.colorMap, offsetY: -7, maxScale: 0.8 },
        { type: 'word', words: ['PRESS', 'START'], layout: 'vertical', color: [ACCENTS.green, ACCENTS.ink], offsetY: 8, maxScale: 0.55 },
      ],
    ];
  }
  return [
    [{ type: 'word', words: ['GABRIEL', 'SAUNDERS'], layout: 'horizontal', color: [ACCENTS.ink, ACCENTS.blue] }],
    [{ type: 'word', words: ['I MAKE', 'SQUARES', 'DO THINGS'], layout: 'vertical', color: [ACCENTS.ink, ACCENTS.amber, ACCENTS.ink] }],
    [
      { type: 'shape', shape: SHAPES.editor.pattern, colorMap: SHAPES.editor.colorMap, offsetY: -7, maxScale: 1.0 },
      { type: 'word', words: ['NO CODE EDITORS'], color: ACCENTS.blue, offsetY: 9, maxScale: 0.5 },
    ],
    [
      { type: 'shape', shape: SHAPES.devices.pattern, colorMap: SHAPES.devices.colorMap, offsetY: -7, maxScale: 1.0 },
      { type: 'word', words: ['ONE CODEBASE. EVERY SCREEN.'], color: ACCENTS.ink, offsetY: 9, maxScale: 0.5 },
    ],
    [
      { type: 'shape', shape: SHAPES.polarBear.pattern, colorMap: SHAPES.polarBear.colorMap, offsetY: -7, maxScale: 1.0 },
      { type: 'word', words: ['YES. POLAR BEAR RADAR.'], color: ACCENTS.red, offsetY: 9, maxScale: 0.5 },
    ],
    [
      { type: 'shape', shape: SHAPES.controller.pattern, colorMap: SHAPES.controller.colorMap, offsetY: -7, maxScale: 1.0 },
      { type: 'word', words: ['I ALSO BUILT AN ARCADE'], color: ACCENTS.green, offsetY: 9, maxScale: 0.5 },
    ],
  ];
}

// hero
const isSmall = window.matchMedia('(max-width: 768px)').matches;
const hero = new SquareField(document.getElementById('hero-canvas'), {
  formations: heroFormations(isSmall),
  wordChangeDelay: 4200,
  rippleDuration: 900,
  theme: {
    mainColor: '#0f172a',
    mouseColor: '#0f172a',
    wordColor: '#0f172a',
    rippleColor: '#3b82f6',
  },
});

// footer
const footer = new SquareField(document.getElementById('footer-canvas'), {
  formations: [
    [
      { type: 'word', words: ['SAY HI'], color: ACCENTS.ink, offsetY: -3, maxScale: 0.8 },
      { type: 'shape', shape: SHAPES.heart.pattern, colorMap: SHAPES.heart.colorMap, offsetY: 6, maxScale: 0.5 },
    ],
    [
      { type: 'word', words: ['IGABE AT ICLOUD'], color: ACCENTS.blue, offsetY: -3, maxScale: 0.6 },
      { type: 'shape', shape: SHAPES.heart.pattern, colorMap: SHAPES.heart.colorMap, offsetY: 6, maxScale: 0.5 },
    ],
  ],
  wordChangeDelay: 5000,
  defaultOpacity: 0.14,
  rippleDuration: 900,
  theme: {
    mainColor: '#0f172a',
    mouseColor: '#ef4444',
    wordColor: '#0f172a',
    rippleColor: '#ef4444',
  },
});

// icons
drawPixelWord(document.getElementById('logo-canvas'), 'GABE', '#0f172a', 3.5, 0.7);

document.querySelectorAll('canvas[data-icon]').forEach((canvas) => {
  const shape = SHAPES[canvas.dataset.icon];
  if (shape) drawPixelIcon(canvas, shape.pattern, shape.colorMap, Number(canvas.dataset.cell) || 6);
});

// assemble the email from parts so scrapers reading raw HTML get nothing
const emailBtn = document.getElementById('email-btn');
if (emailBtn) {
  const addr = `${emailBtn.dataset.user}@${emailBtn.dataset.domain}`;
  emailBtn.textContent = addr;
  emailBtn.href = `mailto:${addr}`;
}
// the "Say hi" button links to the same address without exposing it in source
const sayhiBtn = document.getElementById('sayhi-btn');
if (sayhiBtn) {
  sayhiBtn.href = `mailto:${sayhiBtn.dataset.user}@${sayhiBtn.dataset.domain}`;
}

// buttons
const squareButtons = initSquareButtons();

// scroll reveal
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12 },
);
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
