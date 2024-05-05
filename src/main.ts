import { Pane, TpChangeEvent } from 'tweakpane';
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


agentFolder.addBinding(PARAMS, 'agentSpeed', { min: 0, max: 200, step: 1 })
  .on('change', (ev) => {
    console.log('speed change:', ev.value);
  });

globalFolder.addBinding(PARAMS, 'decayRate', { min: 0, max: 1, step: 1 / 1000 })
  .on('change', (ev) => {
    console.log('decay change:', ev.value);
  });
