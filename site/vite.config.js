// dev only: POST /__still?name=x (body = PNG data URL) writes build-cache/review/stills/x.png, for pose review sheets
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../build-cache/review/stills');
export default defineConfig({
  build: { target: 'es2022' },
  plugins: [{
    name: 'stills',
    configureServer(server) {
      server.middlewares.use('/__still', (req, res) => {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
          const name = new URL(req.url, 'http://x').searchParams.get('name').replace(/[^\w-]/g, '');
          fs.mkdirSync(OUT, { recursive: true });
          fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(body.split(',')[1], 'base64'));
          res.end('ok');
        });
      });
    },
  }],
});
