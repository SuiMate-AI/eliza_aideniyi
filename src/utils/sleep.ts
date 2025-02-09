export const sleep = (minMs: number = 1000, maxMs: number = 3000) => {
  const waitTime = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};
