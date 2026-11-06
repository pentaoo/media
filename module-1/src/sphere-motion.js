const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const MAX_PITCH = Math.PI / 3;
const DRAG_RADIANS_PER_PIXEL = 0.0042;
const TOUCH_FOLLOW_SECONDS = 0.04;
const VELOCITY_SAMPLE_SECONDS = 0.05;

// Rotation is separate from WebGL so gesture timing stays independent of video
// decoding, pointer-event frequency and the display's refresh rate.
export function createSphereMotion() {
  let yaw = 0;
  let pitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let velocityYaw = 0;
  let velocityPitch = 0;
  let previousTime = 0;
  let dragging = false;
  let touch = false;

  function stop() {
    velocityYaw = velocityPitch = 0;
    targetYaw = yaw;
    targetPitch = pitch;
  }

  return {
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get dragging() { return dragging; },
    get touch() { return touch; },
    get speed() { return Math.hypot(velocityYaw, velocityPitch); },
    get moving() {
      return Math.hypot(velocityYaw, velocityPitch) > 0.015
        || Math.abs(targetYaw - yaw) + Math.abs(targetPitch - pitch) > 0.0001;
    },
    start(pointerType, time) {
      stop();
      dragging = true;
      touch = pointerType === 'touch';
      previousTime = time;
    },
    move(dx, dy, time, reducedMotion = false) {
      const elapsed = Math.max(0.001, (time - previousTime) / 1000);
      const deltaYaw = dx * DRAG_RADIANS_PER_PIXEL;
      const nextPitch = clamp(targetPitch + dy * DRAG_RADIANS_PER_PIXEL, -MAX_PITCH, MAX_PITCH);
      const deltaPitch = nextPitch - targetPitch;
      targetYaw += deltaYaw;
      targetPitch = nextPitch;
      // Blend recent samples instead of launching from one noisy final event.
      const blend = touch ? 1 - Math.exp(-elapsed / VELOCITY_SAMPLE_SECONDS) : 1;
      velocityYaw += (clamp(deltaYaw / elapsed, -2.2, 2.2) - velocityYaw) * blend;
      velocityPitch += (clamp(deltaPitch / elapsed, -2.2, 2.2) - velocityPitch) * blend;
      previousTime = time;
      if (!touch || reducedMotion) {
        yaw = targetYaw;
        pitch = targetPitch;
      }
    },
    release(time, { cancelled = false, reducedMotion = false } = {}) {
      dragging = false;
      if (cancelled || reducedMotion) {
        stop();
        return;
      }
      // Holding still before lifting the finger must not replay an old flick.
      const stale = Math.max(0, (time - previousTime - 40) / 1000);
      const decay = Math.exp(-stale / VELOCITY_SAMPLE_SECONDS);
      velocityYaw *= decay;
      velocityPitch *= decay;
    },
    turn(deltaYaw, deltaPitch) {
      stop();
      yaw += deltaYaw;
      pitch = clamp(pitch + deltaPitch, -MAX_PITCH, MAX_PITCH);
      targetYaw = yaw;
      targetPitch = pitch;
    },
    step(dt, { reducedMotion = false, autoRotate = false } = {}) {
      if (!dragging && !reducedMotion) {
        const friction = touch ? 2.4 : 4.5;
        const decay = Math.exp(-friction * dt);
        // Exact exponential integration gives the same travel at 30/60/120 Hz.
        const travel = (1 - decay) / friction;
        targetYaw += velocityYaw * travel;
        const nextPitch = targetPitch + velocityPitch * travel;
        targetPitch = clamp(nextPitch, -MAX_PITCH, MAX_PITCH);
        velocityYaw *= decay;
        velocityPitch = nextPitch === targetPitch ? velocityPitch * decay : 0;
        if (autoRotate && Math.hypot(velocityYaw, velocityPitch) <= 0.015) {
          targetYaw += 0.06 * dt;
          yaw += 0.06 * dt;
        }
      }
      const follow = touch && !reducedMotion ? 1 - Math.exp(-dt / TOUCH_FOLLOW_SECONDS) : 1;
      yaw += (targetYaw - yaw) * follow;
      pitch += (targetPitch - pitch) * follow;
      if (Math.abs(yaw) > Math.PI * 2) {
        const turns = Math.trunc(yaw / (Math.PI * 2)) * Math.PI * 2;
        yaw -= turns;
        targetYaw -= turns;
      }
    },
    stop,
  };
}
