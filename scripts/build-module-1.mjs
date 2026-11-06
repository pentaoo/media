// Собирает архив модуля 1 своим старым сборщиком и кладёт его в dist/module-1/,
// чтобы прошлый сайт оставался доступен по адресу /Chinatown/module-1/.
import { execSync } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';

const archive = new URL('../module-1/', import.meta.url);
execSync('npm run build', { cwd: archive, stdio: 'inherit' });
await cp(new URL('dist/', archive), new URL('../dist/module-1/', import.meta.url), { recursive: true });
await rm(new URL('dist/', archive), { recursive: true, force: true });
console.log('Архив модуля 1 скопирован в dist/module-1/');
