import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import { validateMinecraftLang } from './validate.js'

function getModIdFromGradleProperties(rootPath: string): string | null {
  const gradlePropertiesPath = path.join(rootPath, 'gradle.properties')
  if (!fs.existsSync(gradlePropertiesPath)) {
    return null
  }
  const content = fs.readFileSync(gradlePropertiesPath, 'utf-8')
  const match = content.match(/^mod_id\s*=\s*(.+)$/m)
  return match ? match[1].trim() : null
}

export async function run(): Promise<void> {
  try {
    // Get inputs from GitHub Action
    const rootPath = core.getInput('rootPath', { required: false }) || '.'
    const modId = getModIdFromGradleProperties(rootPath)
    let langFile = core.getInput('langFile', { required: false })
    if (!langFile) {
      if (modId) {
        langFile = path.join(
          rootPath,
          `common/src/main/resources/assets/${modId}/lang/en_us.json`
        )
      } else {
        core.setFailed(
          'No langFile provided and could not find mod_id in gradle.properties'
        )
        return
      }
    }

    console.log(
      `Checking for exported keys at: ${path.join(rootPath, 'fabric/build/datagen/i18n.export.json')}`
    )
    console.log(
      `Scanning Java files for Component.translatable(...) in: ${rootPath}`
    )
    console.log(`Validating language file at: ${langFile}`)
    console.log(`Using mod id for severity classification: ${modId ?? 'none'}`)

    const result = await validateMinecraftLang(rootPath, langFile, modId)
    core.setOutput('success', result.success)

    if (!result.success) {
      core.setFailed(
        'Validation failed: Some mod-specific translation keys are missing'
      )
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
