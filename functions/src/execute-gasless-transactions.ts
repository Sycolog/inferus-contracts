/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access */
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

  context.logger.trace('validateRecaptchaToken:token found')
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

function loadEnvironmentVariables(context: RequestContext) {
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
  const tokenValidationError = await validateRecaptchaToken(event, context)
  if (tokenValidationError) {
    return tokenValidationError
  }

  context.logger.info('handler:token validation successful')
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
  } catch (e) {
    context.logger.error({
      msg: 'handler:INVALID_BODY:INVALID_JSON_DATA',
      error: e,
    })
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'INVALID_BODY',
        message: 'The request body must be a valid JSON',
      }),
    }
  }

  try {
    const result = await executeGaslessTransaction(body, context)
    const response = result.status
      ? result
      : {
          error: 'EXECUTION_ERROR',
          message: result.message,
        }
    return {
      statusCode: result.status ? 200 : 400,
      body: JSON.stringify(response),
    }
  } catch (e) {
    context.logger.error({
      msg: 'handler:executeGaslessTransaction:UNKNOWN_ERROR_OCCURRED',
      error: e,
    })
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An internal error occurred. We are investigating the cause of the problem.',
      }),
    }
  }
}
