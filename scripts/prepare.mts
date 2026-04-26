import { load } from 'js-yaml'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { argv, exit } from 'node:process'

const DEP_WHITELIST = ['koishi']
const DEV_DEP_WHITELIST = ['cross-env']

interface PackageJson {
  name?: string
  workspaces?: string[] | { packages?: string[] }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  [key: string]: unknown
}

interface YamlConfig {
  plugins?: Record<string, unknown>
  [key: string]: unknown
}

interface ManifestInfo {
  path: string
  dir: string
  packageJson: PackageJson
}

const repoRoot = resolve(import.meta.dirname, '..')

function getPackageNames(pluginName: string): string[] {
  const cleanName = pluginName.startsWith('~')
    ? pluginName.slice(1)
    : pluginName
  const nameWithoutAlias = cleanName.split(':')[0]

  if (!nameWithoutAlias || nameWithoutAlias === 'group') return []

  if (nameWithoutAlias.startsWith('@')) {
    return [nameWithoutAlias.replace(/^(@[^/]+)\/(.+)$/, '$1/koishi-plugin-$2')]
  }

  return [
    `@koishijs/plugin-${nameWithoutAlias}`,
    `koishi-plugin-${nameWithoutAlias}`,
  ]
}

function extractPlugins(
  config: Record<string, unknown>,
  plugins: Set<string>,
): void {
  for (const [key, value] of Object.entries(config)) {
    getPackageNames(key).forEach((pkg) => plugins.add(pkg))

    if (
      (key === 'group' || key.startsWith('group:')) &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      extractPlugins(value as Record<string, unknown>, plugins)
    }
  }
}

function normalizePath(filePath: string): string {
  return resolve(filePath).replace(/\\/g, '/').toLowerCase()
}

function hasNodeModulesSegment(filePath: string): boolean {
  return filePath.split(/[\\/]+/).includes('node_modules')
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

function segmentToRegExp(segment: string): RegExp {
  return new RegExp(`^${escapeRegExp(segment).replace(/\*/g, '[^/\\\\]*')}$`)
}

function getWorkspacePatterns(packageJson: PackageJson): string[] {
  if (Array.isArray(packageJson.workspaces)) {
    return packageJson.workspaces
  }

  if (
    packageJson.workspaces &&
    typeof packageJson.workspaces === 'object' &&
    Array.isArray(packageJson.workspaces.packages)
  ) {
    return packageJson.workspaces.packages
  }

  return []
}

async function pathIsDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory()
  } catch {
    return false
  }
}

async function pathIsFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

async function expandWorkspacePattern(
  baseDir: string,
  pattern: string,
): Promise<string[]> {
  const segments = pattern.split('/').filter(Boolean)

  async function walk(currentDir: string, index: number): Promise<string[]> {
    if (hasNodeModulesSegment(currentDir)) return []

    if (index === segments.length) {
      const manifestPath = resolve(currentDir, 'package.json')
      return (await pathIsFile(manifestPath)) ? [manifestPath] : []
    }

    const segment = segments[index]
    if (segment === 'node_modules') return []

    if (!segment.includes('*')) {
      const nextDir = resolve(currentDir, segment)
      if (!(await pathIsDirectory(nextDir))) return []
      return walk(nextDir, index + 1)
    }

    const entries = await readdir(currentDir, { withFileTypes: true }).catch(
      () => [],
    )
    const matcher = segmentToRegExp(segment)
    const matchedDirs = entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name !== 'node_modules' &&
          matcher.test(entry.name),
      )
      .map((entry) => resolve(currentDir, entry.name))

    const nested = await Promise.all(
      matchedDirs.map((dir) => walk(dir, index + 1)),
    )
    return nested.flat()
  }

  return walk(baseDir, 0)
}

async function readManifest(manifestPath: string): Promise<ManifestInfo> {
  const content = await readFile(manifestPath, 'utf-8')
  return {
    path: manifestPath,
    dir: dirname(manifestPath),
    packageJson: JSON.parse(content) as PackageJson,
  }
}

async function discoverManifests(
  rootManifest: ManifestInfo,
): Promise<ManifestInfo[]> {
  const manifests = [rootManifest]
  const visitedManifestPaths = new Set([normalizePath(rootManifest.path)])
  const visitedWorkspaceRoots = new Set([normalizePath(rootManifest.dir)])

  async function visit(current: ManifestInfo): Promise<void> {
    for (const pattern of getWorkspacePatterns(current.packageJson)) {
      const manifestPaths = await expandWorkspacePattern(current.dir, pattern)

      for (const manifestPath of manifestPaths) {
        if (hasNodeModulesSegment(manifestPath)) continue

        const normalizedManifestPath = normalizePath(manifestPath)
        if (visitedManifestPaths.has(normalizedManifestPath)) continue

        const manifest = await readManifest(manifestPath)
        const normalizedWorkspaceRoot = normalizePath(manifest.dir)
        if (visitedWorkspaceRoots.has(normalizedWorkspaceRoot)) continue

        visitedManifestPaths.add(normalizedManifestPath)
        visitedWorkspaceRoots.add(normalizedWorkspaceRoot)
        manifests.push(manifest)
        await visit(manifest)
      }
    }
  }

  await visit(rootManifest)
  return manifests
}

function buildPackageIndex(
  manifests: ManifestInfo[],
): Map<string, ManifestInfo> {
  const index = new Map<string, ManifestInfo>()

  for (const manifest of manifests) {
    const { name } = manifest.packageJson
    if (!name) {
      throw new Error(
        `package.json 缺少 name 字段: ${relative(repoRoot, manifest.path)}`,
      )
    }

    const existing = index.get(name)
    if (existing) {
      throw new Error(
        `发现重复的 package name: ${name}\n- ${relative(repoRoot, existing.path)}\n- ${relative(repoRoot, manifest.path)}`,
      )
    }

    index.set(name, manifest)
  }

  return index
}

function pickWhitelistedDependencies(
  source: Record<string, string> | undefined,
  whitelist: string[],
): Record<string, string> | undefined {
  if (!source) return undefined

  const result: Record<string, string> = {}
  for (const name of whitelist) {
    const version = source[name]
    if (version) result[name] = version
  }
  return result
}

function buildRootDependencies(
  rootPackageJson: PackageJson,
  pluginPackages: Set<string>,
  packageIndex: Map<string, ManifestInfo>,
): Record<string, string> {
  if (!rootPackageJson.dependencies) {
    throw new Error('根 package.json 中没有 dependencies 字段')
  }

  const result: Record<string, string> = {}

  for (const name of DEP_WHITELIST) {
    const version = rootPackageJson.dependencies[name]
    if (version) result[name] = version
  }

  for (const name of Array.from(pluginPackages).sort()) {
    if (packageIndex.has(name)) {
      result[name] = 'workspace:^'
      continue
    }

    const version = rootPackageJson.dependencies[name]
    if (version) {
      result[name] = version
    }
  }

  return result
}

function rebuildRootManifest(
  rootManifest: ManifestInfo,
  pluginPackages: Set<string>,
  packageIndex: Map<string, ManifestInfo>,
): PackageJson {
  const nextPackageJson = { ...rootManifest.packageJson }
  delete nextPackageJson.optionalDependencies
  nextPackageJson.dependencies = buildRootDependencies(
    rootManifest.packageJson,
    pluginPackages,
    packageIndex,
  )
  nextPackageJson.devDependencies =
    pickWhitelistedDependencies(
      rootManifest.packageJson.devDependencies,
      DEV_DEP_WHITELIST,
    ) ?? {}
  return nextPackageJson
}

function rebuildWorkspaceManifest(manifest: ManifestInfo): PackageJson {
  const nextPackageJson = { ...manifest.packageJson }
  nextPackageJson.dependencies = manifest.packageJson.dependencies
  nextPackageJson.devDependencies = pickWhitelistedDependencies(
    manifest.packageJson.devDependencies,
    DEV_DEP_WHITELIST,
  )

  if (!nextPackageJson.devDependencies) {
    delete nextPackageJson.devDependencies
  }

  return nextPackageJson
}

async function writeManifest(
  manifestPath: string,
  packageJson: PackageJson,
): Promise<boolean> {
  const nextContent = `${JSON.stringify(packageJson, null, 2)}\n`
  const currentContent = await readFile(manifestPath, 'utf-8')

  if (currentContent === nextContent) {
    return false
  }

  await writeFile(manifestPath, nextContent, 'utf-8')
  return true
}

async function main(): Promise<void> {
  const args = argv.slice(2)

  if (args.length === 0) {
    console.error('错误：请提供至少一个配置文件路径')
    exit(1)
  }

  const allPluginPackages = new Set<string>()

  for (const arg of args) {
    const configPath = resolve(repoRoot, arg)

    try {
      const content = await readFile(configPath, 'utf-8')
      const config = load(content) as YamlConfig
      if (config.plugins) {
        extractPlugins(config.plugins, allPluginPackages)
      }
    } catch (error) {
      console.error(error)
    }
  }

  const rootManifestPath = resolve(repoRoot, 'package.json')
  const rootManifest = await readManifest(rootManifestPath)
  const manifests = await discoverManifests(rootManifest)
  const packageIndex = buildPackageIndex(manifests)

  let updatedCount = 0

  for (const manifest of manifests) {
    const nextPackageJson =
      manifest.path === rootManifestPath
        ? rebuildRootManifest(manifest, allPluginPackages, packageIndex)
        : rebuildWorkspaceManifest(manifest)

    if (await writeManifest(manifest.path, nextPackageJson)) {
      updatedCount += 1
    }
  }

  console.log(`已处理 ${manifests.length} 个 package.json`)
  console.log(`已更新 ${updatedCount} 个 package.json`)
}

main().catch((error: unknown) => {
  console.error('发生错误:', error)
  exit(1)
})
