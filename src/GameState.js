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
    this.distance = 0;
    this.tofuSpill = 0;
    this.speed = GAME.PLAYER_SPEED;
    this.lateralVelocity = 0;
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

  addDistance(d) {
    this.distance += d;
    // Score based on distance
    if (Math.floor(this.distance) % 10 === 0) {
      this.addScore(1);
    }
  }

  spillTofu(amount) {
    this.tofuSpill = Math.min(GAME.TOFU_MAX_SPILL, this.tofuSpill + amount);
    eventBus.emit(EVENTS.TOFU_SPILL, { spill: this.tofuSpill });
    if (this.tofuSpill >= GAME.TOFU_MAX_SPILL) {
      this.gameOver();
    }
  }

  updateLateralVelocity(velocity) {
    this.lateralVelocity = velocity;
    // Spill tofu on hard turns
    if (Math.abs(velocity) > GAME.TOFU_SPILL_THRESHOLD) {
      this.spillTofu(Math.abs(velocity) * 0.5);
    }
  }
}

export const gameState = new GameState();
