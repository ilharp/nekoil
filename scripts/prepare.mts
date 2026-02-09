import { load } from 'js-yaml'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { argv, exit } from 'node:process'

// 固定白名单
const DEP_WHITELIST = ['koishi']
const DEV_DEP_WHITELIST = ['cross-env']

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  [key: string]: unknown
}

interface YamlConfig {
  plugins?: Record<string, unknown>
  [key: string]: unknown
}

// 插件名到包名的映射
function getPackageNames(pluginName: string): string[] {
  // 移除波浪线前缀（禁用标记）
  const cleanName = pluginName.startsWith('~')
    ? pluginName.slice(1)
    : pluginName

  // 移除别名后缀（冒号后的部分）
  const nameWithoutAlias = cleanName.split(':')[0]

  if (!nameWithoutAlias) return []

  // 如果是 group，不是插件
  if (nameWithoutAlias === 'group') return []

  const packages: string[] = []

  // 如果插件名以 @ 开头（scoped package）
  if (nameWithoutAlias.startsWith('@')) {
    // @foo/bar -> @foo/koishi-plugin-bar
    packages.push(
      nameWithoutAlias.replace(/^(@[^/]+)\/(.+)$/, '$1/koishi-plugin-$2'),
    )
  } else {
    // 普通插件名
    // market -> @koishijs/plugin-market (官方)
    packages.push(`@koishijs/plugin-${nameWithoutAlias}`)
    // market -> koishi-plugin-market (社区)
    packages.push(`koishi-plugin-${nameWithoutAlias}`)
  }

  return packages
}

// 递归提取配置中的所有插件名
function extractPlugins(
  config: Record<string, unknown>,
  plugins: Set<string>,
): void {
  for (const [key, value] of Object.entries(config)) {
    // 获取当前键对应的包名
    const packageNames = getPackageNames(key)
    packageNames.forEach((pkg) => plugins.add(pkg))

    // 如果是 group，递归处理其内容
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

// 主函数
async function main(): Promise<void> {
  const args = argv.slice(2)

  if (args.length === 0) {
    console.error('错误：请提供至少一个配置文件路径')
    exit(1)
  }

  // 收集所有配置文件中的插件包名
  const allPluginPackages = new Set<string>()

  // 遍历所有配置文件
  for (const arg of args) {
    const configPath = resolve(import.meta.dirname, '..', arg)

    try {
      const content = await readFile(configPath, 'utf-8')
      const config = load(content) as YamlConfig

      // 提取 plugins 部分
      if (config.plugins) {
        extractPlugins(config.plugins, allPluginPackages)
      }
    } catch (e) {
      console.error(e)
      continue
    }
  }

  // 读取 package.json
  const packageJsonPath = resolve(import.meta.dirname, '../package.json')
  const packageJsonContent = await readFile(packageJsonPath, 'utf-8')
  const packageJson = JSON.parse(packageJsonContent) as PackageJson

  if (!packageJson.dependencies) {
    console.error('错误：package.json 中没有 dependencies 字段')
    process.exit(1)
  }

  // 构建新的 dependencies
  const newDeps: Record<string, string> = {}

  // 添加白名单包
  for (const pkg of DEP_WHITELIST) {
    const version = packageJson.dependencies[pkg]
    if (version) {
      newDeps[pkg] = version
    } else {
      console.error(
        `错误：白名单包 ${pkg} 在 package.json 的 dependencies 中不存在`,
      )
      process.exit(1)
    }
  }

  // 添加插件包
  for (const pkg of allPluginPackages) {
    const version = packageJson.dependencies[pkg]
    if (version) {
      newDeps[pkg] = version
    }
    // 如果包不存在，不报错，因为可能有多个候选包名
  }

  // 构建新的 devDependencies
  const newDevDeps: Record<string, string> = {}
  for (const pkg of DEV_DEP_WHITELIST) {
    const version = packageJson.devDependencies?.[pkg]
    if (version) {
      newDevDeps[pkg] = version
    } else {
      console.error(
        `错误：白名单包 ${pkg} 在 package.json 的 devDependencies 中不存在`,
      )
      process.exit(1)
    }
  }

  // 更新 package.json
  delete packageJson.optionalDependencies
  packageJson.dependencies = newDeps
  packageJson.devDependencies = newDevDeps

  // 写回 package.json
  await writeFile(packageJsonPath, JSON.stringify(packageJson) + '\n', 'utf-8')

  console.log('package.json 已更新')
  console.log(`保留的 dependencies: ${Object.keys(newDeps).length} 个`)
  console.log(`保留的 devDependencies: ${Object.keys(newDevDeps).length} 个`)
}

main().catch((error: unknown) => {
  console.error('发生错误:', error)
  process.exit(1)
})
