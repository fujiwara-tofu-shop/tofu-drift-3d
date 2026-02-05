// EventBus.js - Pub/sub for decoupled modules
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) callbacks.splice(index, 1);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(cb => cb(data));
  }

  clear() {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();

// Event types
export const EVENTS = {
  GAME_START: 'game:start',
  GAME_OVER: 'game:over',
  GAME_RESTART: 'game:restart',
  SCORE_UPDATE: 'score:update',
  TOFU_SPILL: 'tofu:spill',
  COLLISION: 'collision',
  DRIFT: 'drift',
};
