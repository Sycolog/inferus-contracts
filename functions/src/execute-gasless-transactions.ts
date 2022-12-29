import { AWSLambdaHTTPEvent } from './types'
import { createLogger, RequestContext, verifyCaptchaToken } from './utils'
import { executeGaslessTransaction } from './functions/execute-gasless-transactions'

async function validateRecaptchaToken(event: AWSLambdaHTTPEvent, context: RequestContext) {
  const token = event.headers?.['g-recaptcha-token']

  context.logger.trace('validateRecaptchaToken:started')
  if (!token) {
    context.logger.error('validateRecaptchaToken:MISSING_RECAPTCHA_TOKEN')
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'MISSING_RECAPTCHA_TOKEN',
        message: 'The request could not be validated as the Recaptcha token is missing',
      }),
    }
  }

  context.logger.trace('validateRecaptchaToken:tokenFound')
  const isValid = await verifyCaptchaToken(token, context.logger)
  if (!isValid) {
    context.logger.error('validateRecaptchaToken:INVALID_RECAPTCHA_TOKEN')
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'INVALID_RECAPTCHA_TOKEN',
        message: 'The request could not be validated as the Recaptcha token is invalid',
      }),
    }
  }
}

export async function handler(event: AWSLambdaHTTPEvent) {
  const context = {
    logger: createLogger({
      context: event.requestContext,
    }),
    requestId: event.requestContext.requestId,
  }

  context.logger.trace('handler:started')
  const tokenValidationError = await validateRecaptchaToken(event, context)
  if (tokenValidationError) {
    return tokenValidationError
  }

  context.logger.info('handler:tokenValidationSuccessful')
  if (!event.body) {
    context.logger.error('handler:INVALID_BODY:EMPTY_BODY')
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'INVALID_BODY',
        message: 'The request body must not be empty',
      }),
    }
  }

  let body
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    body = JSON.parse(event.body)
  } catch {
    context.logger.error('handler:INVALID_BODY:INVALID_JSON_DATA')
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'INVALID_BODY',
        message: 'The request body must be a valid JSON',
      }),
    }
  }

  const result = await executeGaslessTransaction(body, context)
  return {
    statusCode: result.status ? 200 : 400,
    body: result.status
      ? result
      : {
          error: 'EXECUTIION_ERROR',
          message: result.message,
        },
  }
}
