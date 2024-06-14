import { ListBladeApi, Pane } from 'tweakpane';
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

// Editable params
const PARAMS = {
  decayRate: renderer.getSimParam('decayRate'),
  turnSpeed: renderer.getSimParam('turnSpeed'),
  agentSpeed: renderer.getSimParam('agentSpeed'),
};

const INITIAL_CONDITIONS = {
  numAgents: renderer.getInitialCondition('numAgents'),
  fieldSize: renderer.getInitialCondition('fieldSize'),
};

// Presets
const PRESETS = {
  Default: {
    params: { ...PARAMS },
    init: { ...INITIAL_CONDITIONS },
  },
  Nova: {
    params: {
      agentSpeed: 54,
      turnSpeed: 2.6,
      decayRate: 0.25,
    },
    init: {
      numAgents: 220_000,
      fieldSize: 2048,
    },
  },
};

// Connect knobs
const pane = new Pane({
  title: 'Parameters',
  expanded: true,
});
(pane.addBlade({
  view: 'list',
  label: 'Preset',
  options: [...Object.keys(PRESETS)]
    .map((text) => ({
      text,
      value: text,
    })),
  value: 'Default',
}) as ListBladeApi<keyof typeof PRESETS>).on('change', (ev) => {
  const preset = PRESETS[ev.value];

  [...Object.entries(preset.params)]
    .forEach(([param, value]) => renderer.setSimParam(param as any, value as any));

  [...Object.entries(preset.init)]
    .forEach(([param, value]) => renderer.setInitialCondition(param as any, value as any));

  renderer.reset();
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

initFolder.addBinding(INITIAL_CONDITIONS, 'numAgents', { label: 'Num agents', min: 1000, max: 2_000_000, step: 1000 });

initFolder.addBinding(INITIAL_CONDITIONS, 'fieldSize', { label: 'Field size', min: 128, max: 2048, step: 1 });

initFolder.addButton({ title: 'Restart' })
  .on('click', () => {
    renderer.setInitialCondition('numAgents', INITIAL_CONDITIONS.numAgents);
    renderer.setInitialCondition('fieldSize', INITIAL_CONDITIONS.fieldSize);
    renderer.reset()
  });
