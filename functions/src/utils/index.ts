import { utils } from 'ethers'
import pino from 'pino'
const { arrayify } = utils

export interface RequestContext {
  logger: pino.Logger
  requestId: string
}

export async function verifyCaptchaToken(token: string, logger: pino.Logger): Promise<boolean> {
  logger.warn('Token not verified:', token)
  return Promise.resolve(true)
}

export function isNumber(data: unknown): boolean {
  // is valid hex-string or type is number
  if (typeof data === 'number') {
    return true
  }

  const validator = hexStringValidator()
  return validator(data)
}

export function hexStringValidator(bytesLength?: number) {
  return (data: unknown) => {
    if (typeof data !== 'string') {
      return false
    }

    try {
      const bytes = arrayify(data)
      return !bytesLength || bytes.length === bytesLength
    } catch {
      return false
    }
  }
}

export function createLogger(context: Record<string, any>): pino.Logger {
  return pino().child({
    context,
  })
}
