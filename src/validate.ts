import * as fs from 'fs'
import * as path from 'path'
import { glob } from 'glob'

const EXPORT_FILE_PATH = path.join(
  'fabric',
  'build',
  'datagen',
  'i18n.export.json'
)

export async function validateMinecraftLang(
  rootPath: string,
  langFile: string
): Promise<boolean> {
  try {
    const exportFile = path.join(rootPath, EXPORT_FILE_PATH)
    const exportedKeys = readExportedKeys(exportFile)

    const javaFiles = await glob(`${rootPath}/**/*.java`, {
      ignore: ['**/build/**', '**/out/**', '**/bin/**']
    })

    const javaKeys = new Set<string>()
    for (const javaFile of javaFiles) {
      const content = fs.readFileSync(javaFile, 'utf-8')
      extractTranslatableKeys(content).forEach((key) => javaKeys.add(key))
    }

    if (!fs.existsSync(langFile)) {
      throw new Error(`Language file not found: ${langFile}`)
    }

    const langContent = fs.readFileSync(langFile, 'utf-8')
    const langData: Record<string, string> = JSON.parse(langContent)
    const availableKeys = new Set(Object.keys(langData))
    const requiredKeys = new Set<string>([...exportedKeys, ...javaKeys])
    const missingKeys = Array.from(requiredKeys).filter(
      (key) => !availableKeys.has(key)
    )

    console.log(`Found ${exportedKeys.size} translation keys in ${exportFile}`)
    console.log(
      `Found ${javaKeys.size} Component.translatable keys in ${javaFiles.length} Java files`
    )
    console.log(`Found ${requiredKeys.size} total required translation keys`)
    console.log(`Found ${availableKeys.size} keys in ${langFile}`)

    if (missingKeys.length > 0) {
      console.log('\nMissing translation keys:')
      missingKeys.forEach((key) => console.log(`  - ${key}`))
      return false
    }

    console.log('\nAll translation keys found!')
    return true
  } catch (error) {
    console.error('Error during validation:', error)
    throw error
  }
}

function readExportedKeys(exportFile: string): Set<string> {
  if (!fs.existsSync(exportFile)) {
    throw new Error(`Export file not found: ${exportFile}`)
  }

  const exportContent = fs.readFileSync(exportFile, 'utf-8')
  const exportData: unknown = JSON.parse(exportContent)

  if (
    !Array.isArray(exportData) ||
    exportData.some((entry) => typeof entry !== 'string')
  ) {
    throw new Error(
      `Export file must be a JSON array of translation key strings: ${exportFile}`
    )
  }

  return new Set(exportData)
}

function extractTranslatableKeys(content: string): string[] {
  const keys: string[] = []
  const patterns = [
    /Component\.translatable\s*\(\s*["']([^"']+)["']\s*\)/g,
    /Component\.translatable\s*\(\s*["']([^"']+)["']\s*,/g
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      keys.push(match[1])
    }
  }

  return keys
}
