import { jest } from '@jest/globals'

export const validateMinecraftLang =
  jest.fn<typeof import('../src/validate.js').validateMinecraftLang>()
