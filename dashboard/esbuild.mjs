import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isMcp = process.argv.includes('--mcp');

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: true,
  external: ['vscode'],
  logLevel: 'info',
};

const extensionConfig = {
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'out/extension.js',
};

const mcpConfig = {
  ...sharedOptions,
  entryPoints: ['src/mcp/server.ts'],
  outfile: 'out/mcp/server.js',
  external: [],
};


async function main() {
  const configs = isMcp ? [mcpConfig] : [extensionConfig, mcpConfig];

  if (isWatch) {
    for (const config of configs) {
      const ctx = await esbuild.context(config);
      await ctx.watch();
    }
    console.log('Watching for changes...');
  } else {
    for (const config of configs) {
      await esbuild.build(config);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
