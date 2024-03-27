import Renderer from './renderer';

const canvas = document.getElementById('gfx') as HTMLCanvasElement;
const { width, height } = canvas.getBoundingClientRect();
canvas.width = width;
canvas.height = height;
const renderer = new Renderer(canvas);
renderer.start();
