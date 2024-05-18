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
  decayRate: renderer.getSimParam('decayRate'),
  turnSpeed: renderer.getSimParam('turnSpeed'),
  agentSpeed: renderer.getSimParam('agentSpeed'),
};

const INITIAL_CONDITIONS = {
  numAgents: renderer.getInitialCondition('numAgents'),
  fieldSize: renderer.getInitialCondition('fieldSize'),
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
const initFolder = pane.addFolder({
  title: 'Initial conditions',
  expanded: true,
})

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

initFolder.addBinding(INITIAL_CONDITIONS, 'numAgents', { label: 'Num agents', min: 1000, max: 4_000_000, step: 1000 });

initFolder.addBinding(INITIAL_CONDITIONS, 'fieldSize', { label: 'Field size', min: 128, max: 2048, step: 1 });

initFolder.addButton({ title: 'Restart' })
  .on('click', () => {
    renderer.setInitialCondition('numAgents', INITIAL_CONDITIONS.numAgents);
    renderer.setInitialCondition('fieldSize', INITIAL_CONDITIONS.fieldSize);
    renderer.reset()
  });
