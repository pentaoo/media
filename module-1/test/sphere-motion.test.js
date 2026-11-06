import test from 'node:test';
import assert from 'node:assert/strict';
import { createSphereMotion } from '../src/sphere-motion.js';

function swipe(type = 'touch', interval = 16) {
  const motion = createSphereMotion();
  motion.start(type, 0);
  for (let time = interval; time <= 160; time += interval) {
    motion.move(interval * 0.4, interval * 0.04, time);
    motion.step(interval / 1000);
  }
  motion.release(160);
  return motion;
}

test('touch follows sparse input over frames instead of jumping at each event', () => {
  const motion = createSphereMotion();
  motion.start('touch', 0);
  motion.move(40, 0, 80);
  assert.equal(motion.yaw, 0);
  motion.step(1 / 60);
  const first = motion.yaw;
  motion.step(1 / 60);
  assert(first > 0 && first < motion.yaw && motion.yaw < 40 * 0.0042);
});

test('touch coasts longer than the desktop drag and slows continuously', () => {
  const touch = swipe();
  const mouse = swipe('mouse');
  const touchStart = touch.yaw;
  const mouseStart = mouse.yaw;
  let previousSpeed = touch.speed;
  for (let frame = 0; frame < 120; frame++) {
    touch.step(1 / 60);
    mouse.step(1 / 60);
    assert(touch.speed < previousSpeed);
    previousSpeed = touch.speed;
  }
  assert(touch.yaw - touchStart > (mouse.yaw - mouseStart) * 1.5);
  assert(touch.speed < 0.02);
});

test('travel stays consistent across pointer sample rates and display refresh rates', () => {
  const positions = [];
  for (const interval of [8, 16, 32]) {
    for (const fps of [30, 60, 120]) {
      const motion = swipe('touch', interval);
      for (let frame = 0; frame < fps * 3; frame++) motion.step(1 / fps);
      positions.push(motion.yaw);
    }
  }
  assert(Math.max(...positions) - Math.min(...positions) < 0.005, positions.join(', '));
});

test('holding still before release removes stale fling velocity', () => {
  const motion = swipe();
  motion.start('touch', 200);
  motion.move(60, 0, 250);
  motion.release(600);
  assert(motion.speed < 0.005);
});

test('cancelled gestures and a new touch stop existing momentum immediately', () => {
  const motion = swipe();
  motion.step(0.1);
  motion.start('touch', 300);
  const caught = motion.yaw;
  motion.step(0.1);
  assert.equal(motion.yaw, caught);
  motion.move(30, 0, 350);
  motion.release(360, { cancelled: true });
  motion.step(0.1);
  assert.equal(motion.yaw, caught);
  assert.equal(motion.moving, false);
});

test('reduced motion follows input directly without smoothing or inertia', () => {
  const motion = createSphereMotion();
  motion.start('touch', 0);
  motion.move(50, 20, 80, true);
  assert.equal(motion.yaw, 50 * 0.0042);
  const end = motion.yaw;
  motion.release(80, { reducedMotion: true });
  motion.step(1, { reducedMotion: true, autoRotate: true });
  assert.equal(motion.yaw, end);
  assert.equal(motion.moving, false);
});

test('vertical momentum stops at the pole and reverses without a dead zone', () => {
  const motion = createSphereMotion();
  motion.start('touch', 0);
  motion.move(0, 1000, 100);
  motion.release(100);
  for (let frame = 0; frame < 120; frame++) motion.step(1 / 60);
  assert(Math.abs(motion.pitch - Math.PI / 3) < 0.00001);
  assert.equal(motion.speed, 0);
  motion.start('touch', 2200);
  motion.move(0, -20, 2240);
  motion.step(1 / 60);
  assert(motion.pitch < Math.PI / 3 - 0.01);
});

test('idle rotation after a touch does not keep the high frame rate active', () => {
  const motion = createSphereMotion();
  motion.start('touch', 0);
  motion.release(0);
  for (let frame = 0; frame < 60; frame++) motion.step(1 / 60, { autoRotate: true });
  assert(Math.abs(motion.yaw - 0.06) < 0.00001);
  assert.equal(motion.moving, false);
});
