/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-assignment */
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'

export class RecaptchaHandler {
  // recaptcha object from script
  private readonly grecaptcha: any
  private readonly key: string

  constructor(grecaptcha: any, key: string) {
    this.grecaptcha = grecaptcha
    this.key = key
  }

  async executeChallenge(action: string): Promise<string> {
    return await this.grecaptcha.execute(this.key, { action })
  }
}

export class GaslessTransactionExecutor {
  private gaslessTxClient: AxiosInstance
  private recaptchaHandler: RecaptchaHandler

  constructor(url: string, recaptchaHandler: RecaptchaHandler) {
    this.recaptchaHandler = recaptchaHandler
    this.gaslessTxClient = axios.create({
      baseURL: url,
    })
  }

  async queueGaslessTransaction(spec: { transactionType: string; arguments: string[] }) {
    let response: AxiosResponse
    try {
      const token = await this.recaptchaHandler.executeChallenge('execute-gasless-transaction')
      response = await this.gaslessTxClient.post('/', spec, {
        headers: {
          'g-recaptcha-token': token,
        },
      })
    } catch (e) {
      if (e instanceof AxiosError && e.response) {
        response = e.response
      } else {
        throw Error('Failed to queue gasless transaction')
      }
    }

    if (!response.data.status) {
      throw Error(`${response.data.error}: ${response.data.message}`)
    }
  }
}
