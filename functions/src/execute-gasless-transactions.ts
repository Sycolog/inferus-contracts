/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import { AWSLambdaHTTPEvent } from './types'
import { ApplicationError, createLogger, RequestContext, verifyCaptchaToken } from './utils'
import { executeGaslessTransaction } from './functions/execute-gasless-transactions'

async function validateRecaptchaToken(event: AWSLambdaHTTPEvent, context: RequestContext) {
  const token = event.headers?.['g-recaptcha-token']

  context.logger.trace('validateRecaptchaToken:started')
  if (!token) {
    throw new ApplicationError({
      context,
      message: 'validateRecaptchaToken:MISSING_RECAPTCHA_TOKEN',
      errorCode: 'MISSING_RECAPTCHA_TOKEN',
      userFriendlyMessage: 'The request could not be validated as the Recaptcha token is missing',
    })
  }

  context.logger.trace('validateRecaptchaToken:token found')
  const isValid = await verifyCaptchaToken(token, context.logger)
  if (!isValid) {
    throw new ApplicationError({
      context,
      message: 'validateRecaptchaToken:INVALID_RECAPTCHA_TOKEN',
      errorCode: 'INVALID_RECAPTCHA_TOKEN',
      userFriendlyMessage: 'The request could not be validated as the Recaptcha token is invalid',
    })
  }
}

export function loadEnvironmentVariables(context: RequestContext) {
  try {
    const envVars = JSON.parse(process.env.ENV_VARS!)
    for (const key of Object.keys(envVars)) {
      process.env[key] = envVars[key]
    }
    context.logger.info('handler:loaded env vars')
  } catch (e) {
    context.logger.error({
      msg: 'FAILED_TO_LOAD_AWS_ENV_VARS',
      error: e,
    })
  }
}

function parseBody(stringBody: string, context: RequestContext) {
  if (!stringBody) {
    throw new ApplicationError({
      context,
      message: 'handler:INVALID_BODY:empty body',
      errorCode: 'INVALID_BODY',
      userFriendlyMessage: 'The request body must not be empty',
    })
  }

  let body
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    body = JSON.parse(stringBody)
  } catch (e) {
    throw new ApplicationError({
      context,
      message: 'handler:INVALID_BODY:invalid json data',
      errorCode: 'INVALID_BODY',
      userFriendlyMessage: 'The request body must be a valid JSON',
      data: {
        error: e,
      },
    })
  }

  return body
}

function getErrorResponse(e: any) {
  const errorCode = e.errorCode || 'EXECUTION_ERROR'
  const errorMessage =
    e.userFriendlyMessage || 'Failed to execute transaction. Please try again later.'
  return {
    statusCode: 400,
    body: JSON.stringify({
      error: errorCode,
      message: errorMessage,
    }),
  }
}

export async function handler(
  event: AWSLambdaHTTPEvent
): Promise<{ statusCode: number; body: string }> {
  const context = {
    logger: createLogger({
      context: event.requestContext,
    }),
    requestId: event.requestContext.requestId,
  }
  context.logger.trace('handler:started')
  loadEnvironmentVariables(context)
  try {
    await validateRecaptchaToken(event, context)
    context.logger.info('handler:token validation successful')
    const body = parseBody(event.body, context)
    const result = await executeGaslessTransaction(body, context)
    return {
      statusCode: result.status ? 200 : 400,
      body: JSON.stringify(result),
    }
  } catch (e) {
    if (!(e instanceof ApplicationError)) {
      context.logger.error({
        msg: 'handler:executeGaslessTransaction:UNKNOWN_ERROR_OCCURRED',
        error: e,
      })
    }
    return getErrorResponse(e)
  }
}
