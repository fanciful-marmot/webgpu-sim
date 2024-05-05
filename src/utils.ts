// Random point in unit circle (radius 0.5)
const randomPoint = () => {
  let x, y;

  do {
    x = Math.random() - 0.5;
    y = Math.random() - 0.5;
  } while (Math.sqrt(x * x + y * y) > 0.5);

  return { x, y };
};

export {
  randomPoint,
};
