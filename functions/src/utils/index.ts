import { utils } from 'ethers'
import pino from 'pino'
const { arrayify } = utils

export interface RequestContext {
  logger: pino.Logger
  requestId: string
}

export class ApplicationError {
  errorCode?: string
  userFriendlyMessage?: string
  constructor(args: {
    context: RequestContext
    message: string
    data?: Record<string, unknown>
    errorCode?: string
    userFriendlyMessage?: string
  }) {
    args.context.logger.error({
      msg: args.message,
      ...(args.data || {}),
    })
    this.errorCode = args.errorCode
    this.userFriendlyMessage = args.userFriendlyMessage
  }
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
  return pino({
    level: process.env.LOG_LEVEL?.trim().toLowerCase() || 'info',
  }).child({
    context,
  })
}
