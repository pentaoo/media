import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm, rename, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('npm run video:prepare -- [--config config/video-cuts.json] [--only clip-id]\nRequires ffmpeg and ffprobe. Times are seconds; focus is [x, y] between 0 and 1.\nOriginal files stay local. Outputs: silent vertical H.264 MP4 up to 360/720 px, article up to 1280 px with original audio unless articleAudio=false, JPEG posters and public manifest.');
  process.exit(0);
}
let configPath = resolve(root, 'config/video-cuts.json');
let only;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' && args[i + 1]) configPath = resolve(args[++i]);
  else if (args[i] === '--only' && args[i + 1]) only = args[++i];
  else throw new Error(`Unknown or incomplete option: ${args[i]}`);
}

function run(command, commandArgs) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-8000); });
    child.on('error', error => reject(new Error(`${command}: ${error.message}. Install ffmpeg (includes ffprobe).`)));
    child.on('close', code => code === 0 ? resolveRun(stdout) : reject(new Error(`${command} failed (${code}): ${stderr}`)));
  });
}
async function probe(path) {
  return JSON.parse(await run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]));
}
function validateRecipes(recipes) {
  if (!Array.isArray(recipes) || !recipes.length) throw new Error('clips must contain at least one cut');
  const ids = new Set();
  for (const recipe of recipes) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.id || '') || ids.has(recipe.id)) throw new Error(`Invalid or duplicate clip id: ${recipe.id}`);
    ids.add(recipe.id);
    if (typeof recipe.source !== 'string' || !recipe.source.trim() || /^[a-z]+:\/\//i.test(recipe.source)) throw new Error(`${recipe.id}: source must be a local file path`);
    if (!Number.isFinite(recipe.start) || recipe.start < 0 || !Number.isFinite(recipe.duration) || recipe.duration < 1 || recipe.duration > 90) throw new Error(`${recipe.id}: start >= 0, duration between 1 and 90 seconds`);
    if (!Array.isArray(recipe.focus) || recipe.focus.length !== 2 || !recipe.focus.every(n => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error(`${recipe.id}: focus must be [x, y] in the 0–1 range`);
    if (typeof recipe.title !== 'string' || !recipe.title.trim()) throw new Error(`${recipe.id}: title is required`);
    if (recipe.articleAudio !== undefined && typeof recipe.articleAudio !== 'boolean') throw new Error(`${recipe.id}: articleAudio must be true or false`);
    if (recipe.railEnabled !== undefined && typeof recipe.railEnabled !== 'boolean') throw new Error(`${recipe.id}: railEnabled must be true or false`);
    if (recipe.creditUrl && !['http:', 'https:'].includes(new URL(recipe.creditUrl).protocol)) throw new Error(`${recipe.id}: creditUrl must use HTTP(S)`);
  }
}

const recipes = JSON.parse(await readFile(configPath, 'utf8')).clips;
validateRecipes(recipes);
if (only && !recipes.some(clip => clip.id === only)) throw new Error(`No cut named ${only}`);
await run('ffmpeg', ['-version']);
const output = resolve(root, 'assets/video/editorial');
await mkdir(output, { recursive: true });
const manifestPath = join(output, 'manifest.json');
let previous = { clips: [] };
try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const prepared = new Map(previous.clips.map(clip => [clip.id, clip]));

for (const recipe of recipes.filter(clip => !only || clip.id === only)) {
  const source = resolve(dirname(configPath), recipe.source);
  const sourceInfo = await probe(source);
  if (!sourceInfo.streams.some(stream => stream.codec_type === 'video')) throw new Error(`${recipe.id}: source has no video`);
  const sourceDuration = Number(sourceInfo.format.duration);
  if (!Number.isFinite(sourceDuration) || recipe.start + recipe.duration > sourceDuration + .05) throw new Error(`${recipe.id}: cut ends at ${recipe.start + recipe.duration}s, source lasts ${sourceDuration}s`);
  const sourceStat = await stat(source);
  const sourceVideo = sourceInfo.streams.find(stream => stream.codec_type === 'video');
  const rotation = sourceVideo.side_data_list?.find(item => Number.isFinite(item.rotation))?.rotation || 0;
  const rotated = Math.abs(rotation) % 180 === 90;
  const sourceWidth = rotated ? sourceVideo.height : sourceVideo.width;
  const sourceHeight = rotated ? sourceVideo.width : sourceVideo.height;
  const even = value => Math.max(2, Math.floor(value / 2) * 2);
  const railSize = maxHeight => {
    const height = even(Math.min(maxHeight, sourceHeight, sourceWidth * 16 / 9));
    return [even(height * 9 / 16), height];
  };
  const articleScale = Math.min(1, 1280 / sourceWidth, 1280 / sourceHeight);
  const articleSize = [even(sourceWidth * articleScale), even(sourceHeight * articleScale)];
  const fingerprint = createHash('sha256').update(JSON.stringify({ recipe, size: sourceStat.size, mtime: sourceStat.mtimeMs, version: 3 })).digest('hex').slice(0, 12);
  const folder = `${recipe.id}-${fingerprint}`;
  const stage = await mkdtemp(join(tmpdir(), 'chinatown-video-'));
  const files = {};
  const filter = (width, height) => `fps=24,scale=${width}:${height}:force_original_aspect_ratio=increase:force_divisible_by=2,crop=${width}:${height}:(in_w-out_w)*${recipe.focus[0]}:(in_h-out_h)*${recipe.focus[1]},setsar=1`;
  try {
    for (const [name, width, height, crf] of [['rail-small', ...railSize(640), 28], ['rail-large', ...railSize(1280), 27], ['article', ...articleSize, 25]]) {
      const filename = `${name}.mp4`;
      const hasAudio = name === 'article' && recipe.articleAudio !== false && sourceInfo.streams.some(stream => stream.codec_type === 'audio');
      const audioArgs = hasAudio ? ['-map', '0:a:0', '-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : ['-an'];
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(recipe.start), '-i', source, '-t', String(name.startsWith('rail') ? Math.min(recipe.duration, 20) : recipe.duration), '-map', '0:v:0', ...audioArgs, '-sn', '-dn', '-map_metadata', '-1', '-map_chapters', '-1', '-vf', filter(width, height), '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '2', join(stage, filename)]);
      const info = await probe(join(stage, filename));
      const stream = info.streams.find(item => item.codec_type === 'video');
      if (stream?.width !== width || stream?.height !== height || stream.codec_name !== 'h264' || info.streams.some(item => item.codec_type === 'audio') !== hasAudio) throw new Error(`${recipe.id}/${filename}: invalid export`);
      files[name] = { src: `./${folder}/${filename}`, bytes: (await stat(join(stage, filename))).size, width, height, duration: Number(info.format.duration), hasAudio };
    }
    for (const [name, width, height] of [['poster', ...railSize(1280)], ['article-poster', ...articleSize]]) {
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(recipe.start + Math.min(recipe.duration / 3, 2)), '-i', source, '-frames:v', '1', '-vf', filter(width, height), '-c:v', 'mjpeg', '-q:v', '3', '-threads', '2', join(stage, `${name}.jpg`)]);
    }
    // A failed encode never replaces the files referenced by the public manifest.
    const destination = join(output, folder);
    try { await stat(destination); await rm(stage, { recursive: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await rename(stage, destination); }
    prepared.set(recipe.id, {
      id: recipe.id, title: recipe.title.trim(), caption: recipe.caption || '', preview: !!recipe.preview,
      creditUrl: recipe.creditUrl || '', focus: recipe.focus, railEnabled: recipe.railEnabled !== false,
      rail: { small: files['rail-small'].src, large: files['rail-large'].src },
      poster: `./${folder}/poster.jpg`, article: files.article.src, articlePoster: `./${folder}/article-poster.jpg`,
      exports: files,
    });
    console.log(`${recipe.id}: ${Object.values(files).map(file => `${file.width}×${file.height} ${(file.bytes / 1024).toFixed(0)} KB`).join(', ')}`);
  } finally { await rm(stage, { recursive: true, force: true }); }
}
const manifest = { version: 1, clips: recipes.map(recipe => prepared.get(recipe.id)).filter(Boolean) };
await writeFile(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
await rename(`${manifestPath}.tmp`, manifestPath);
console.log('Ready: assets/video/editorial/manifest.json');
