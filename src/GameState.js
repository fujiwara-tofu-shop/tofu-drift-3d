// GameState.js - Centralized game state
import { eventBus, EVENTS } from './EventBus.js';
import { GAME } from './Constants.js';

class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.isPlaying = false;
    this.isGameOver = false;
    this.score = 0;
    this.speed = GAME.PLAYER_SPEED;
  }

  start() {
    this.reset();
    this.isPlaying = true;
    eventBus.emit(EVENTS.GAME_START);
  }

  gameOver() {
    this.isPlaying = false;
    this.isGameOver = true;
    eventBus.emit(EVENTS.GAME_OVER, { score: this.score });
  }

  addScore(points) {
    this.score += points;
    eventBus.emit(EVENTS.SCORE_UPDATE, { score: this.score });
  }
}

export const gameState = new GameState();
