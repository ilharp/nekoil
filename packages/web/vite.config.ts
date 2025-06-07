import react from '@vitejs/plugin-react'
import type { SpawnOptions } from 'node:child_process'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { defineConfig } from 'vite'

// eslint-disable-next-line import/no-default-export
export default defineConfig(async () => {
  const [_, versionString] = await buildVersion()

  return {
    plugins: [react()],

    optimizeDeps: {
      // Vite 的恶心 bug
      force: true,
    },

    define: {
      __DEFINE_NEKOIL_VERSION_STRING__: versionString,
      __DEFINE_NEKOIL_ENV__: process.env.NEKOIL_ENV
        ? `"${process.env.NEKOIL_ENV}"`
        : '"production"',
    },

    build: {
      rollupOptions: {
        external: ['react', 'react-dom/client'],
        output: {
          paths: {
            react: 'https://esm.sh/react@19.1.0',
            'react-dom/client': 'https://esm.sh/react-dom@19.1.0/client',
          },
        },
      },
    },
  }
})

const buildVersion = () =>
  Promise.all([
    spawnOutput('git', ['describe', '--tags', '--dirty']),
    spawnOutput('git', ['rev-list', '--count', 'HEAD']),
  ])
    .then((x) => x.map((y) => y.trim()))
    .then(([x, y]) => [y, `"${x} (${y})"`])
    .catch(() => ['0', '"0.0.0 (0)"'])

export async function spawnOutput(
  command: string,
  args?: readonly string[],
  options?: SpawnOptions,
): Promise<string> {
  const parsedArgs = args ?? []
  const parsedOptions: SpawnOptions = Object.assign<
    SpawnOptions,
    SpawnOptions,
    SpawnOptions | undefined
  >({}, { stdio: 'pipe', shell: true }, options)
  const child = spawn(command, parsedArgs, parsedOptions)
  let stdout = ''
  if (!child.stdout)
    throw new Error(`cannot get stdout of ${command} ${parsedArgs.join(' ')}`)
  child.stdout.on('data', (x) => (stdout += x as string))
  return new Promise<string>((resolve, reject) => {
    child.on('close', (x) => {
      if (x) reject(new Error(`Command ${command} exited: ${x}`))
      else resolve(stdout)
    })
  })
}
