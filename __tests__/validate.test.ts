import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach
} from '@jest/globals'
import type { SpiedFunction } from 'jest-mock'
import { validateMinecraftLang } from '../src/validate'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FIXTURES_DIR = path.join(__dirname, '..', '__fixtures__')

describe('validateMinecraftLang', () => {
  let consoleLogSpy: SpiedFunction<typeof console.log>
  let consoleErrorSpy: SpiedFunction<typeof console.error>
  let consoleWarnSpy: SpiedFunction<typeof console.warn>

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  function createFixtureProject(name: string): {
    rootDir: string
    langFile: string
    cleanup: () => void
  } {
    const rootDir = path.join(FIXTURES_DIR, name)
    fs.mkdirSync(path.join(rootDir, 'fabric', 'build', 'datagen'), {
      recursive: true
    })
    fs.mkdirSync(path.join(rootDir, 'src', 'main', 'java'), { recursive: true })
    fs.mkdirSync(path.join(rootDir, 'lang'), { recursive: true })

    return {
      rootDir,
      langFile: path.join(rootDir, 'lang', 'en_us.json'),
      cleanup: () => fs.rmSync(rootDir, { recursive: true, force: true })
    }
  }

  function writeExportFile(rootDir: string, keys: unknown): void {
    fs.writeFileSync(
      path.join(rootDir, 'fabric', 'build', 'datagen', 'i18n.export.json'),
      JSON.stringify(keys)
    )
  }

  function writeJavaFile(rootDir: string, name: string, content: string): void {
    fs.writeFileSync(path.join(rootDir, 'src', 'main', 'java', name), content)
  }

  function writeLangFile(
    langFile: string,
    entries: Record<string, string>
  ): void {
    fs.writeFileSync(langFile, JSON.stringify(entries))
  }

  it('returns true when export keys and Component.translatable keys exist in lang file', async () => {
    const fixture = createFixtureProject('temp_complete')
    writeExportFile(fixture.rootDir, ['export.only', 'shared.key'])
    writeJavaFile(
      fixture.rootDir,
      'Test.java',
      `
      public class Test {
        void test() {
          Component.translatable("java.only");
          Component.translatable("shared.key", arg);
        }
      }
      `
    )
    writeLangFile(fixture.langFile, {
      'export.only': 'Export only',
      'shared.key': 'Shared',
      'java.only': 'Java only'
    })

    try {
      const result = await validateMinecraftLang(
        fixture.rootDir,
        fixture.langFile,
        'examplemod'
      )
      expect(result).toEqual({
        success: true,
        missingErrorKeys: [],
        missingWarningKeys: []
      })
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 translation keys in')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 Component.translatable keys')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('All translation keys found')
      )
    } finally {
      fixture.cleanup()
    }
  })

  it('returns false when export file keys missing from lang file match the mod id segment', async () => {
    const fixture = createFixtureProject('temp_missing_export_keys')
    writeExportFile(fixture.rootDir, ['export.only', 'block.examplemod.board'])
    writeLangFile(fixture.langFile, {
      'export.only': 'Export only'
    })

    try {
      const result = await validateMinecraftLang(
        fixture.rootDir,
        fixture.langFile,
        'examplemod'
      )
      expect(result).toEqual({
        success: false,
        missingErrorKeys: ['block.examplemod.board'],
        missingWarningKeys: []
      })
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error-level missing translation keys')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('  - block.examplemod.board')
    } finally {
      fixture.cleanup()
    }
  })

  it('returns false when Component.translatable keys missing from lang file match the mod id segment', async () => {
    const fixture = createFixtureProject('temp_missing_java_keys')
    writeExportFile(fixture.rootDir, [])
    writeJavaFile(
      fixture.rootDir,
      'Test.java',
      `
      public class Test {
        void test() {
          Component.translatable("gui.examplemod.title");
        }
      }
      `
    )
    writeLangFile(fixture.langFile, {})

    try {
      const result = await validateMinecraftLang(
        fixture.rootDir,
        fixture.langFile,
        'examplemod'
      )
      expect(result).toEqual({
        success: false,
        missingErrorKeys: ['gui.examplemod.title'],
        missingWarningKeys: []
      })
      expect(consoleLogSpy).toHaveBeenCalledWith('  - gui.examplemod.title')
    } finally {
      fixture.cleanup()
    }
  })

  it('returns true when no Java files exist but export file matches lang file', async () => {
    const fixture = createFixtureProject('temp_no_java')
    writeExportFile(fixture.rootDir, ['export.only'])
    writeLangFile(fixture.langFile, {
      'export.only': 'Export only'
    })
    fs.rmSync(path.join(fixture.rootDir, 'src'), {
      recursive: true,
      force: true
    })

    try {
      const result = await validateMinecraftLang(
        fixture.rootDir,
        fixture.langFile,
        'examplemod'
      )
      expect(result.success).toBe(true)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Found 0 Component.translatable keys in 0 Java files'
        )
      )
    } finally {
      fixture.cleanup()
    }
  })

  it('logs a warning and continues when the export file is missing', async () => {
    const fixture = createFixtureProject('temp_missing_export_file')
    writeJavaFile(
      fixture.rootDir,
      'Test.java',
      `
      public class Test {
        void test() {
          Component.translatable("java.only");
        }
      }
      `
    )
    writeLangFile(fixture.langFile, {
      'java.only': 'Java only'
    })

    try {
      const result = await validateMinecraftLang(
        fixture.rootDir,
        fixture.langFile,
        'examplemod'
      )
      expect(result.success).toBe(true)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Export file not found, skipping exported keys')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 0 translation keys in')
      )
    } finally {
      fixture.cleanup()
    }
  })

  it('throws when the export file is not a JSON array of strings', async () => {
    const fixture = createFixtureProject('temp_invalid_export_shape')
    writeExportFile(fixture.rootDir, { exportedKeys: ['wrong.shape'] })
    writeLangFile(fixture.langFile, {})

    try {
      await expect(
        validateMinecraftLang(fixture.rootDir, fixture.langFile, 'examplemod')
      ).rejects.toThrow(
        'Export file must be a JSON array of translation key strings'
      )
    } finally {
      fixture.cleanup()
    }
  })

  it('throws when the language file does not exist', async () => {
    const fixture = createFixtureProject('temp_missing_lang')
    writeExportFile(fixture.rootDir, [])

    try {
      await expect(
        validateMinecraftLang(
          fixture.rootDir,
          path.join(fixture.rootDir, 'lang', 'missing.json'),
          'examplemod'
        )
      ).rejects.toThrow('Language file not found')
    } finally {
      fixture.cleanup()
    }
  })

  it('extracts simple Component.translatable patterns only', async () => {
    const fixture = createFixtureProject('temp_translatable_patterns')
    writeExportFile(fixture.rootDir, [])
    writeJavaFile(
      fixture.rootDir,
      'Test.java',
      `
      public class Test {
        void test() {
          Component.translatable("simple.key");
          Component.translatable(
            "multiline.key"
          );
          Component.translatable('single.quote.key');
          Component.translatable("with.args", arg1, arg2);
          Component.translatable(someVariable);
          Component.literal("literal.text");
        }
      }
      `
    )
    writeLangFile(fixture.langFile, {
      'simple.key': 'Simple',
      'multiline.key': 'Multiline',
      'single.quote.key': 'Single quote',
      'with.args': 'With args'
    })

    try {
      const result = await validateMinecraftLang(
        fixture.rootDir,
        fixture.langFile,
        'examplemod'
      )
      expect(result.success).toBe(true)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 4 Component.translatable keys')
      )
      expect(consoleLogSpy).not.toHaveBeenCalledWith('  - literal.text')
    } finally {
      fixture.cleanup()
    }
  })

  it('returns warnings without failing when missing keys do not match the mod id segment', async () => {
    const fixture = createFixtureProject('temp_missing_warning_keys')
    writeExportFile(fixture.rootDir, ['shared.key'])
    writeJavaFile(
      fixture.rootDir,
      'Test.java',
      `
      public class Test {
        void test() {
          Component.translatable("tooltip.library.entry");
        }
      }
      `
    )
    writeLangFile(fixture.langFile, {})

    try {
      const result = await validateMinecraftLang(
        fixture.rootDir,
        fixture.langFile,
        'examplemod'
      )
      expect(result).toEqual({
        success: true,
        missingErrorKeys: [],
        missingWarningKeys: ['shared.key', 'tooltip.library.entry']
      })
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning-level missing translation keys')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('  - shared.key')
      expect(consoleLogSpy).toHaveBeenCalledWith('  - tooltip.library.entry')
    } finally {
      fixture.cleanup()
    }
  })

  it('treats substring-only mod id matches as warnings', async () => {
    const fixture = createFixtureProject('temp_substring_only_keys')
    writeExportFile(fixture.rootDir, ['block.examplemodboard.name'])
    writeLangFile(fixture.langFile, {})

    try {
      const result = await validateMinecraftLang(
        fixture.rootDir,
        fixture.langFile,
        'examplemod'
      )
      expect(result).toEqual({
        success: true,
        missingErrorKeys: [],
        missingWarningKeys: ['block.examplemodboard.name']
      })
    } finally {
      fixture.cleanup()
    }
  })

  it('treats all missing keys as warnings when mod id is unavailable', async () => {
    const fixture = createFixtureProject('temp_missing_mod_id')
    writeExportFile(fixture.rootDir, ['block.examplemod.board'])
    writeLangFile(fixture.langFile, {})

    try {
      const result = await validateMinecraftLang(
        fixture.rootDir,
        fixture.langFile,
        null
      )
      expect(result).toEqual({
        success: true,
        missingErrorKeys: [],
        missingWarningKeys: ['block.examplemod.board']
      })
    } finally {
      fixture.cleanup()
    }
  })
})
