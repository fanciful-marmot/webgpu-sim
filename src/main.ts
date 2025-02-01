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

const tupleToRgb = (t: [number, number, number]): {r: number, g: number, b: number} => ({
  r: t[0],
  g: t[1],
  b: t[2],
});
const rgbToTuple = ({r, g, b}: {r: number, g: number, b: number}): [number, number, number] => ([
  r, g, b
]);

// Connect knobs
const PARAMS = {
  decayRate: renderer.getSimParam('decayRate'),
  turnSpeed: renderer.getSimParam('turnSpeed'),
  agentSpeed: renderer.getSimParam('agentSpeed'),
  species1Colour: tupleToRgb(renderer.getBlitParam('species1Colour')),
  species2Colour: tupleToRgb(renderer.getBlitParam('species2Colour')),
  species3Colour: tupleToRgb(renderer.getBlitParam('species3Colour')),
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
const speciesFolder = pane.addFolder({
  title: 'Species',
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

speciesFolder.addBinding(PARAMS, 'species1Colour', { label: 'Colour 1', color: { type: 'float' } })
  .on('change', (ev) => {
    renderer.setBlitParam('species1Colour', rgbToTuple(ev.value));
  });

speciesFolder.addBinding(PARAMS, 'species2Colour', { label: 'Colour 2', color: { type: 'float' } })
  .on('change', (ev) => {
    renderer.setBlitParam('species2Colour', rgbToTuple(ev.value));
  });

speciesFolder.addBinding(PARAMS, 'species3Colour', { label: 'Colour 3', color: { type: 'float' } })
  .on('change', (ev) => {
    renderer.setBlitParam('species3Colour', rgbToTuple(ev.value));
  });

globalFolder.addBinding(PARAMS, 'decayRate', { label: 'Decay rate', min: 0, max: 1, step: 1 / 1000 })
  .on('change', (ev) => {
    renderer.setSimParam('decayRate', ev.value);
  });

initFolder.addBinding(INITIAL_CONDITIONS, 'numAgents', { label: 'Num agents', min: 1000, max: 2_000_000, step: 1000 });

initFolder.addBinding(INITIAL_CONDITIONS, 'fieldSize', { label: 'Field size', min: 128, max: 2048, step: 1 });

initFolder.addButton({ title: 'Restart' })
  .on('click', () => {
    renderer.setInitialCondition('numAgents', INITIAL_CONDITIONS.numAgents);
    renderer.setInitialCondition('fieldSize', INITIAL_CONDITIONS.fieldSize);
    renderer.reset()
  });
