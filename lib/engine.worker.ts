import { chooseMove } from './engine';

self.onmessage = (event: MessageEvent<{ fen: string }>) => {
  try {
    self.postMessage({ fen: event.data.fen, move: chooseMove(event.data.fen) });
  } catch {
    self.postMessage({ fen: event.data.fen, error: true });
  }
};
