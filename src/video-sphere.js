import { mountDragHint } from './drag-hint.js';

const VIDEO_SOURCES = [
  { video: new URL('../assets/video/concert.mp4', import.meta.url).href, poster: new URL('../assets/video/concert.jpg', import.meta.url).href },
  { video: new URL('../assets/video/dj.mp4', import.meta.url).href, poster: new URL('../assets/video/dj.jpg', import.meta.url).href },
  { video: new URL('../assets/video/moscow.mp4', import.meta.url).href, poster: new URL('../assets/video/moscow.jpg', import.meta.url).href },
];

const VERTEX_SHADER = [
  'attribute vec2 aPosition;',
  'varying vec2 vUv;',
  'void main() {',
  '  vUv = aPosition * 0.5 + 0.5;',
  '  gl_Position = vec4(aPosition, 0.0, 1.0);',
  '}',
].join('\n');

// Each pixel casts a ray from the centre of a video-covered sphere.
// Equidistant angular projection gives the scene its curved fisheye edges.
const FRAGMENT_SHADER = [
  'precision highp float;',
  'varying vec2 vUv;',
  'uniform float uAspect;',
  'uniform float uYaw;',
  'uniform float uPitch;',
  'uniform float uFov;',
  'uniform vec3 uRatios;',
  'uniform sampler2D uConcert;',
  'uniform sampler2D uDj;',
  'uniform sampler2D uMoscow;',
  'vec2 coverUv(vec2 uv, float sourceRatio) {',
  '  float targetRatio = 1.2;',
  '  if (sourceRatio > targetRatio) {',
  '    uv.x = (uv.x - 0.5) * targetRatio / sourceRatio + 0.5;',
  '  } else {',
  '    uv.y = (uv.y - 0.5) * sourceRatio / targetRatio + 0.5;',
  '  }',
  '  return uv;',
  '}',
  'void main() {',
  '  vec2 screen = vec2((vUv.x * 2.0 - 1.0) * sqrt(uAspect), vUv.y * 2.0 - 1.0);',
  '  float radius = length(screen);',
  '  float angle = radius * uFov;',
  '  vec3 ray = radius > 0.0001',
  '    ? vec3(screen / radius * sin(angle), -cos(angle))',
  '    : vec3(0.0, 0.0, -1.0);',
  '  float cp = cos(uPitch);',
  '  float sp = sin(uPitch);',
  '  ray = vec3(ray.x, ray.y * cp - ray.z * sp, ray.y * sp + ray.z * cp);',
  '  float cy = cos(uYaw);',
  '  float sy = sin(uYaw);',
  '  ray = vec3(ray.x * cy + ray.z * sy, ray.y, -ray.x * sy + ray.z * cy);',
  '  float longitude = atan(ray.x, -ray.z);',
  '  float latitude = asin(clamp(ray.y, -1.0, 1.0));',
  '  float u = fract(0.5 + longitude / 6.2831853 + 0.0625);',
  '  float v = clamp(0.5 - latitude / 3.1415927 + 0.125, 0.0, 0.99999);',
  '  vec2 tile = vec2(u * 8.0, v * 4.0);',
  '  vec2 cell = floor(tile);',
  '  vec2 uv = fract(tile);',
  '  uv.y = 1.0 - uv.y;',
  '  float source = mod(cell.x + cell.y * 2.0 + 2.0, 3.0);',
  '  vec4 color;',
  '  if (source < 0.5) {',
  '    color = texture2D(uConcert, coverUv(uv, uRatios.x));',
  '  } else if (source < 1.5) {',
  '    color = texture2D(uDj, coverUv(uv, uRatios.y));',
  '  } else {',
  '    color = texture2D(uMoscow, coverUv(uv, uRatios.z));',
  '  }',
  '  float poleBlend = smoothstep(0.96, 1.26, abs(latitude));',
  '  if (latitude > 0.0) {',
  '    vec2 capUv = coverUv(vec2(0.5 + ray.x * 0.55, 0.5 + ray.z * 0.55), uRatios.x);',
  '    color = mix(color, texture2D(uConcert, capUv), poleBlend);',
  '  } else {',
  '    vec2 capUv = coverUv(vec2(0.5 + ray.x * 0.55, 0.5 + ray.z * 0.55), uRatios.z);',
  '    color = mix(color, texture2D(uMoscow, capUv), poleBlend);',
  '  }',
  '  gl_FragColor = vec4(color.rgb, 1.0);',
  '}',
].join('\n');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const MAX_PITCH = Math.PI / 3;
const DRAG_RADIANS_PER_PIXEL = 0.0042;
const AUTO_ROTATION_RADIANS_PER_SECOND = 0.06;
const BASE_FOV = 0.92;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  const message = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw new Error(message || 'Video sphere shader could not compile');
}

function createProgram(gl) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  const message = gl.getProgramInfoLog(program);
  gl.deleteProgram(program);
  throw new Error(message || 'Video sphere program could not link');
}

export function mountVideoSphere(intro) {
  const host = intro.querySelector('#intro-sphere');
  const unavailable = () => {
    host.removeAttribute('tabindex');
    host.removeAttribute('role');
    host.removeAttribute('aria-label');
    host.classList.add('intro__sphere--unavailable');
    return () => {};
  };
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });
  } catch {
    return unavailable();
  }
  if (!gl) return unavailable();

  let program;
  try {
    program = createProgram(gl);
  } catch (error) {
    console.warn('Video sphere unavailable:', error);
    return unavailable();
  }

  host.append(canvas);
  const dragHint = mountDragHint(host, intro);
  gl.useProgram(program);
  const position = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, position);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]), gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    aspect: gl.getUniformLocation(program, 'uAspect'),
    yaw: gl.getUniformLocation(program, 'uYaw'),
    pitch: gl.getUniformLocation(program, 'uPitch'),
    fov: gl.getUniformLocation(program, 'uFov'),
    ratios: gl.getUniformLocation(program, 'uRatios'),
  };
  const samplers = ['uConcert', 'uDj', 'uMoscow'];
  const textures = VIDEO_SOURCES.map((_, index) => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([16, 16, 16, 255]));
    gl.uniform1i(gl.getUniformLocation(program, samplers[index]), index);
    return texture;
  });
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ratios = [16 / 9, 16 / 9, 16 / 9];
  const lastVideoTimes = [-1, -1, -1];
  const freshVideoFrames = [false, false, false];
  const videos = [];
  const listeners = [];
  let destroyed = false;
  let dragging = false;
  let activePointer = null;
  let previousX = 0;
  let previousY = 0;
  let previousPointerTime = 0;
  let yaw = 0;
  let pitch = 0;
  let velocityYaw = 0;
  let velocityPitch = 0;
  let fov = BASE_FOV;
  let lastFrameTime = 0;
  let lastInteractionTime = performance.now();
  let frame = 0;
  let posterCount = 0;

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function upload(index, source) {
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, textures[index]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  function showScene() {
    if (destroyed || intro.classList.contains('intro--sphere-ready')) return;
    intro.classList.add('intro--sphere-ready');
    dragHint.reveal();
  }

  VIDEO_SOURCES.forEach((source, index) => {
    const poster = new Image();
    poster.onload = () => {
      if (destroyed) return;
      ratios[index] = poster.naturalWidth / poster.naturalHeight;
      upload(index, poster);
      posterCount += 1;
      if (posterCount === VIDEO_SOURCES.length) showScene();
      requestFrame();
    };
    poster.src = source.poster;

    const video = document.createElement('video');
    video.src = source.video;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    host.append(video);
    videos.push(video);
    listen(video, 'loadedmetadata', () => {
      ratios[index] = video.videoWidth / video.videoHeight;
    });
    if (video.requestVideoFrameCallback) {
      const markFrame = () => {
        if (destroyed) return;
        freshVideoFrames[index] = true;
        video.requestVideoFrameCallback(markFrame);
      };
      video.requestVideoFrameCallback(markFrame);
    }
    if (!reducedMotion.matches) video.play().catch(() => {});
  });

  function resize() {
    const rect = host.getBoundingClientRect();
    const maxPixels = 2_000_000;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(maxPixels / Math.max(1, rect.width * rect.height)));
    const width = Math.max(1, Math.round(rect.width * scale));
    const height = Math.max(1, Math.round(rect.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    requestFrame();
  }

  function requestFrame() {
    if (!frame && !destroyed && !document.hidden) frame = requestAnimationFrame(render);
  }

  function render(time) {
    frame = 0;
    if (destroyed || document.hidden) return;
    const movingFast = dragging || time - lastInteractionTime < 800;
    if (!reducedMotion.matches && !movingFast && lastFrameTime && time - lastFrameTime < 32) {
      requestFrame();
      return;
    }
    const dt = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
    lastFrameTime = time;

    if (!dragging && !reducedMotion.matches) {
      yaw += velocityYaw * dt;
      pitch = clamp(pitch + velocityPitch * dt, -MAX_PITCH, MAX_PITCH);
      const decay = Math.exp(-4.5 * dt);
      velocityYaw *= decay;
      velocityPitch *= decay;
      if (time - lastInteractionTime > 1800) yaw += AUTO_ROTATION_RADIANS_PER_SECOND * dt;
    }
    if (Math.abs(yaw) > Math.PI * 2) yaw %= Math.PI * 2;
    const speed = dragging ? Math.hypot(velocityYaw, velocityPitch) : 0;
    const targetFov = reducedMotion.matches ? BASE_FOV : BASE_FOV + Math.min(0.11, speed * 0.025);
    fov += (targetFov - fov) * Math.min(1, dt * 5);

    if (!reducedMotion.matches) {
      videos.forEach((video, index) => {
        const newFrame = video.requestVideoFrameCallback
          ? freshVideoFrames[index]
          : Math.abs(video.currentTime - lastVideoTimes[index]) >= 1 / 30;
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !newFrame) return;
        try {
          upload(index, video);
          lastVideoTimes[index] = video.currentTime;
          freshVideoFrames[index] = false;
        } catch {
          // The poster remains in place if a browser cannot upload a video frame.
        }
      });
    }

    gl.uniform1f(uniforms.aspect, canvas.width / canvas.height);
    gl.uniform1f(uniforms.yaw, yaw);
    gl.uniform1f(uniforms.pitch, pitch);
    gl.uniform1f(uniforms.fov, fov);
    gl.uniform3fv(uniforms.ratios, ratios);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!reducedMotion.matches || dragging) requestFrame();
  }

  function pointerDown(event) {
    if (dragging || (event.pointerType !== 'touch' && event.button !== 0)) return;
    dragging = true;
    activePointer = event.pointerId;
    previousX = event.clientX;
    previousY = event.clientY;
    previousPointerTime = event.timeStamp;
    velocityYaw = 0;
    velocityPitch = 0;
    host.classList.add('is-dragging');
    host.setPointerCapture(event.pointerId);
    requestFrame();
  }

  function pointerMove(event) {
    if (!dragging || event.pointerId !== activePointer) return;
    const elapsed = Math.max(0.016, (event.timeStamp - previousPointerTime) / 1000);
    const deltaYaw = (event.clientX - previousX) * DRAG_RADIANS_PER_PIXEL;
    const deltaPitch = (event.clientY - previousY) * DRAG_RADIANS_PER_PIXEL;
    yaw += deltaYaw;
    pitch = clamp(pitch + deltaPitch, -MAX_PITCH, MAX_PITCH);
    velocityYaw = clamp(deltaYaw / elapsed, -2.2, 2.2);
    velocityPitch = clamp(deltaPitch / elapsed, -2.2, 2.2);
    previousX = event.clientX;
    previousY = event.clientY;
    previousPointerTime = event.timeStamp;
    lastInteractionTime = performance.now();
    requestFrame();
  }

  function pointerUp(event) {
    if (event.pointerId !== activePointer) return;
    dragging = false;
    activePointer = null;
    host.classList.remove('is-dragging');
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    if (reducedMotion.matches) {
      velocityYaw = 0;
      velocityPitch = 0;
    }
    requestFrame();
  }

  function wheel(event) {
    event.preventDefault();
    // Natural trackpad scrolling reports the opposite sign of the finger movement.
    yaw -= event.deltaX * 0.0015;
    pitch = clamp(pitch - event.deltaY * 0.0015, -MAX_PITCH, MAX_PITCH);
    velocityYaw = 0;
    velocityPitch = 0;
    lastInteractionTime = performance.now();
    requestFrame();
  }

  function keyDown(event) {
    const turns = { ArrowLeft: [-0.14, 0], ArrowRight: [0.14, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] };
    const turn = turns[event.key];
    if (!turn) return;
    event.preventDefault();
    yaw += turn[0];
    pitch = clamp(pitch + turn[1], -MAX_PITCH, MAX_PITCH);
    lastInteractionTime = performance.now();
    requestFrame();
  }

  function visibilityChange() {
    if (document.hidden) {
      videos.forEach((video) => video.pause());
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else {
      if (!reducedMotion.matches) videos.forEach((video) => video.play().catch(() => {}));
      lastFrameTime = 0;
      requestFrame();
    }
  }

  function motionChange() {
    if (reducedMotion.matches) {
      videos.forEach((video) => video.pause());
      velocityYaw = 0;
      velocityPitch = 0;
    } else if (!document.hidden) {
      videos.forEach((video) => video.play().catch(() => {}));
    }
    requestFrame();
  }

  listen(host, 'pointerdown', pointerDown);
  listen(host, 'pointermove', pointerMove);
  listen(host, 'pointerup', pointerUp);
  listen(host, 'pointercancel', pointerUp);
  listen(host, 'wheel', wheel, { passive: false });
  listen(host, 'keydown', keyDown);
  listen(document, 'visibilitychange', visibilityChange);
  listen(reducedMotion, 'change', motionChange);
  listen(window, 'resize', resize);
  resize();
  requestFrame();

  return () => {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    listeners.forEach((remove) => remove());
    dragHint.destroy();
    videos.forEach((video) => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    });
    textures.forEach((texture) => gl.deleteTexture(texture));
    gl.deleteBuffer(position);
    gl.deleteProgram(program);
    canvas.remove();
  };
}
