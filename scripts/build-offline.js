const esbuild = require('esbuild');
const path = require('path');

async function build() {
  await esbuild.build({
    entryPoints: ['public/js/app.js', 'public/js/services/auth.js'],
    bundle: true,
    format: 'iife',
    outfile: 'public/dist/offline.js',
    sourcemap: false,
    logLevel: 'info'
  });
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
