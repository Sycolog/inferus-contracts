/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BigNumberish, providers, utils } from 'ethers'
const { hexConcat, hexDataSlice, defaultAbiCoder, id, FunctionFragment, arrayify } = utils

export type TransactionDataPrimitive = string | boolean | BigNumberish

export interface TransactionDataCallSpec {
  signature: string
  arguments: TransactionDataPrimitive[]
}

export type TransactionDataSpec = string | TransactionDataCallSpec | undefined

/**
 * Converts a valid name to a standard form including only lowercase letters, numbers and underscore.
 * @param name
 */
export function normalizeName(name: string): string {
  if (name[0] === '@') {
    name = name.substring(1)
  }

  if (!/^\w{2,32}$/.test(name)) {
    throw Error(
      'Valid inferus names have a minimum of 2 and a maximum of 32 characters including letters, numbers, and underscore.'
    )
  }

  return name.toLowerCase()
}

export function isNormalized(name: string): boolean {
  return /^[a-z0-9_]{2,32}$/.test(name)
}

export async function ethCall(
  provider: providers.Provider,
  to: string,
  callSpec: TransactionDataCallSpec,
  from?: string
): Promise<any | null> {
  try {
    const data = parseTransactionData(callSpec)
    const callResult = await provider.call({ from, to, data })
    return decodeFunctionResult(callSpec.signature, callResult)
  } catch (e) {
    console.error('CALL_FAILED. Signature:', callSpec.signature, 'Args:', callSpec.arguments)
    console.error(e)
  }
}

export function parseTransactionData(data: TransactionDataSpec): string | undefined {
  if (!data || typeof data === 'string') {
    return data
  }

  const fn = FunctionFragment.fromString(data.signature)
  return hexConcat([
    hexDataSlice(id(fn.format()), 0, 4),
    defaultAbiCoder.encode(fn.inputs, data.arguments),
  ])
}

export function decodeFunctionResult(signature: string, data: string): any | null {
  const functionFragment = FunctionFragment.fromString(signature)
  const bytes = arrayify(data)
  switch (bytes.length % defaultAbiCoder._getWordSize()) {
    case 0:
      try {
        return defaultAbiCoder.decode(functionFragment.outputs!, bytes)
      } catch (error) {}
      break
  }

  return null
}

export function convertToPresentationForm(name: string): string {
  const namePart = name[0] === '@' ? name.substring(1) : name
  return `@${normalizeName(namePart)}`
}

export function isPresentationForm(name: string): boolean {
  return name[0] === '@' && isNormalized(name.substring(1))
}

const ipfsUriRegex =
  /ipfs:\/\/(?:Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[A-Za-z2-7]{58,}|B[A-Z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]{48,}|F[0-9A-F]{50,})/
export function validateIpfsUri(uri: string): boolean {
  return ipfsUriRegex.test(uri)
}
