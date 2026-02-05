// Constants.js - All magic numbers in one place
export const GAME = {
  ROAD_WIDTH: 10,
  ROAD_LENGTH: 200,
  ROAD_SEGMENTS: 50,
  
  PLAYER_SPEED: 0.5,
  PLAYER_LATERAL_SPEED: 0.15,
  PLAYER_SIZE: { width: 1.2, height: 0.8, depth: 2 },
  PLAYER_Y: 0.5,
  
  OBSTACLE_SPAWN_RATE: 60, // frames
  OBSTACLE_MIN_SPEED: 0.3,
  OBSTACLE_MAX_SPEED: 0.5,
  OBSTACLE_TYPES: ['tree', 'rock', 'cone'],
  
  TOFU_SPILL_THRESHOLD: 0.8, // lateral movement speed
  TOFU_MAX_SPILL: 100,
  
  CAMERA_HEIGHT: 4,
  CAMERA_DISTANCE: 8,
  CAMERA_LOOK_AHEAD: 5,
  
  SKY_TOP_COLOR: 0x1a0a2e,
  SKY_BOTTOM_COLOR: 0x4a1942,
  
  FOG_COLOR: 0x2d1b3d,
  FOG_NEAR: 20,
  FOG_FAR: 100,
  
  PARTICLE_COUNT: 100,
};

export const COLORS = {
  CAR_BODY: 0xf5f5f5,
  CAR_ROOF: 0x333333,
  TOFU_BOX: 0xffeedd,
  ROAD: 0x333344,
  ROAD_LINE: 0xffff00,
  TREE_TRUNK: 0x4a3728,
  TREE_LEAVES: 0x2d5a27,
  ROCK: 0x666677,
  CONE: 0xff6600,
  HEADLIGHT: 0xffffaa,
  TAILLIGHT: 0xff3333,
};
