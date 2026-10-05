import { cp, mkdir, copyFile, rm } from 'node:fs/promises';

// Next exports browser assets to out; dist is the distributable, never source.
// Preserve existing Sites package files; overlay freshly generated assets.
await cp('out', 'dist', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
async function copyRuntime(root) {
  await mkdir(`${root}/server`, { recursive: true });
  await copyFile('server/index.js', `${root}/server/index.js`);
  await cp('functions', `${root}/functions`, { recursive: true });
}
await copyRuntime('dist');
await copyRuntime('dist/dist');
await rm('.output', { recursive: true, force: true });
await copyRuntime('.output');
await cp('out', '.output/public', { recursive: true });
await rm('.vercel/output/static', { recursive: true, force: true });
await mkdir('.vercel/output/static', { recursive: true });
await cp('out', '.vercel/output/static', { recursive: true });
