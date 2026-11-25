import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { exportarDatos, VOX_DIR, OUT } from './tools/exportar_datos.mjs';

// Solo en desarrollo: el botón "Guardar" del editor de niveles hace POST /api/level?name=piso1 y este plugin
// lo escribe en public/levels/piso1.json; el de animaciones hace POST /api/animation?name=walk → public/animations/walk.json.
const guardarNiveles = {
  name: 'guardar-niveles',
  configureServer(server) {
    // el editor de animaciones guarda en public/animations/<clip>.json
    server.middlewares.use('/api/animation', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      const name = (new URL(req.url, 'http://localhost').searchParams.get('name') || '').replace(/[^a-z0-9_-]/gi, '');
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        try {
          const clip = JSON.parse(body);
          if (!name || typeof clip.tracks !== 'object' || !(clip.duration > 0)) throw new Error('clip inválido');
          fs.mkdirSync(path.resolve('public/animations'), { recursive: true });
          fs.writeFileSync(path.resolve('public/animations', name + '.json'), JSON.stringify(clip, null, 1));
          server.ws.send({ type: 'custom', event: 'anim:saved', data: { name, clip } }); // el juego abierto lo toma sin recargar
          res.end('ok');
        } catch (e) { res.statusCode = 400; res.end(String(e.message || e)); }
      });
    });
    server.middlewares.use('/api/level', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      const name = (new URL(req.url, 'http://localhost').searchParams.get('name') || '').replace(/[^a-z0-9_-]/gi, '');
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        try {
          const level = JSON.parse(body);
          if (!name || !Array.isArray(level.props) || !Array.isArray(level.agents)) throw new Error('nivel inválido');
          fs.writeFileSync(path.resolve('public/levels', name + '.json'), JSON.stringify(level, null, 1));
          res.end('ok');
        } catch (e) { res.statusCode = 400; res.end(String(e.message || e)); }
      });
    });
  },
};

// Solo en desarrollo: al guardar un .vox de assets/vox (props u oficina_base) en MagicaVoxel,
// regenera public/data/office.json y recarga la página. Al arrancar, lo regenera si algún .vox es más nuevo.
const voxAutomatico = {
  name: 'vox-automatico',
  configureServer(server) {
    const log = (m, err) => server.config.logger[err ? 'error' : 'info'](`\x1b[32m[vox]\x1b[0m ${m}`, { timestamp: true });
    const exportar = (reintento = true) => {
      try {
        const r = exportarDatos(); r.warnings.forEach(w => log(w));
        log(`office.json actualizado (${r.props} props, ${r.colors} colores)`); server.ws.send({ type: 'full-reload' });
      } catch (e) {
        if (reintento) setTimeout(() => exportar(false), 800); // MagicaVoxel puede estar terminando de escribir
        else log(e.message, true);
      }
    };
    const esVox = f => f.endsWith('.vox') && path.resolve(f).startsWith(VOX_DIR);
    const listar = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listar(path.join(d, e.name)) : [path.join(d, e.name)]);
    try {
      const t = fs.existsSync(OUT) ? fs.statSync(OUT).mtimeMs : 0;
      if (listar(VOX_DIR).some(f => f.endsWith('.vox') && fs.statSync(f).mtimeMs > t)) exportar();
    } catch (e) { log(e.message, true); }
    let timer;
    server.watcher.add(VOX_DIR);
    for (const ev of ['add', 'change', 'unlink'])
      server.watcher.on(ev, f => { if (!esVox(f)) return; log(`cambió ${path.relative(VOX_DIR, f)}`); clearTimeout(timer); timer = setTimeout(exportar, 300); });
  },
};

export default defineConfig({
  base: './',                       // rutas relativas: el build funciona en itch.io, Poki o cualquier carpeta
  plugins: [guardarNiveles, voxAutomatico],
  server: { host: true, watch: { ignored: ['**/public/levels/**', '**/public/animations/**', '**/public/data/**'] } }, // host: true → accesible desde el teléfono en la misma red // guardar un nivel no recarga la página
  build: { rollupOptions: { input: 'index.html' } },        // el editor no se incluye en el build del juego
});
