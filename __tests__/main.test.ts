import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals'
import type { ValidationResult } from '../src/validate'

describe('run', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  async function loadRun(validationResult: ValidationResult) {
    const core = await import('../__fixtures__/core')
    core.getInput.mockImplementation((name: string) => {
      if (name === 'rootPath') {
        return '/repo'
      }

      if (name === 'langFile') {
        return '/repo/lang/en_us.json'
      }

      return ''
    })

    const existsSync = jest.fn((filePath: string) =>
      String(filePath).endsWith('gradle.properties')
    )
    const readFileSync = jest.fn(() => 'mod_id=examplemod\n')
    const validateMinecraftLang = jest.fn(async () => validationResult)

    jest.unstable_mockModule('@actions/core', () => core)
    jest.unstable_mockModule('fs', () => ({
      existsSync,
      readFileSync
    }))
    jest.unstable_mockModule('../src/validate.js', () => ({
      validateMinecraftLang
    }))

    const { run } = await import('../src/main')
    return { core, existsSync, readFileSync, run, validateMinecraftLang }
  }

  it('does not fail the action when missing keys are warnings only', async () => {
    const { core, run, validateMinecraftLang } = await loadRun({
      success: true,
      missingErrorKeys: [],
      missingWarningKeys: ['shared.key']
    })

    await run()

    expect(validateMinecraftLang).toHaveBeenCalledWith(
      '/repo',
      '/repo/lang/en_us.json',
      'examplemod'
    )
    expect(core.setOutput).toHaveBeenCalledWith('success', true)
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('fails the action when mod-specific keys are missing', async () => {
    const { core, run } = await loadRun({
      success: false,
      missingErrorKeys: ['block.examplemod.board'],
      missingWarningKeys: []
    })

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('success', false)
    expect(core.setFailed).toHaveBeenCalledWith(
      'Validation failed: Some mod-specific translation keys are missing'
    )
  })
})
