import { Pane } from 'tweakpane';
import Renderer from './renderer';

const canvas = document.getElementById('gfx') as HTMLCanvasElement;
const { width, height } = canvas.getBoundingClientRect();
const dpr = window.devicePixelRatio;
canvas.width = width * dpr;
canvas.height = height * dpr;

// Handle canvas resize
const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
  for (const entry of entries) {
    if (entry.target === canvas) {
      const dpr = window.devicePixelRatio;
      const { width, height } = entry.contentRect;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
  }
});
observer.observe(canvas, { box: 'device-pixel-content-box' });

const renderer = new Renderer(canvas);
renderer.start();

// Connect knobs
const PARAMS = {
  decayRate: 0.25,
  turnSpeed: 13,
  agentSpeed: 100,
};

const pane = new Pane({
  title: 'Parameters',
  expanded: true,
});
const agentFolder = pane.addFolder({
  title: 'Agents',
  expanded: true,
});
const globalFolder = pane.addFolder({
  title: 'Global',
  expanded: true,
});

agentFolder.addBinding(PARAMS, 'agentSpeed', { label: 'Speed', min: 0, max: 200, step: 1 })
  .on('change', (ev) => {
    renderer.setSimParam('agentSpeed', ev.value);
  });

agentFolder.addBinding(PARAMS, 'turnSpeed', { label: 'Turn speed', min: 1, max: 30, step: 0.2 })
  .on('change', (ev) => {
    renderer.setSimParam('turnSpeed', ev.value);
  });

globalFolder.addBinding(PARAMS, 'decayRate', { label: 'Decay rate', min: 0, max: 1, step: 1 / 1000 })
  .on('change', (ev) => {
    renderer.setSimParam('decayRate', ev.value);
  });
