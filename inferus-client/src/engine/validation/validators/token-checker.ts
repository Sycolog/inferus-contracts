/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
import { NameMetadata } from '../../types'
import { ValidationResult } from '../types'
import chains from '../../chains.json'
import { ethers } from 'ethers'
import { ethCall } from '../../utils'

export default async function validate(
  metadata: NameMetadata,
  result: ValidationResult
): Promise<void> {
  const promises = []
  for (const chainCode of Object.keys(metadata.paymentLink.chains)) {
    const chainData = metadata.paymentLink.chains[chainCode]
    const indexInChains = chains.findIndex((c) => c.id === chainCode)

    if (indexInChains < 0) {
      const path = `paymentLink.chains.${chainCode}`
      if (!result.records[path]) {
        result.records[path] = []
      }
      result.records[path].push({
        validator: 'token-checker',
        type: 'error',
        message: `The chain was not found`,
      })
    }

    if (!chainData.isEVM) {
      // todo: Implement token validation for some non-EVM chains
      continue
    }

    // token code is the token address on the chain
    // Special token codes: `coin` for coins, `*` for wildcard
    const specialTokenCodes = ['coin', '*']
    for (const tokenCode of Object.keys(chainData.tokens)) {
      if (specialTokenCodes.includes(tokenCode)) {
        continue
      }

      promises.push(validateERC20Token(indexInChains, chainCode, tokenCode, result))
    }
  }

  await Promise.all(promises)
}

async function validateERC20Token(
  indexInChains: number,
  chainCode: string,
  tokenCode: string,
  result: ValidationResult
) {
  const chain = chains[indexInChains]
  if (chain.evmMeta?.rpc) {
    const props = []
    try {
      const provider = new ethers.providers.JsonRpcProvider(chain.evmMeta?.rpc[0])
      const [[symbol], [name], [decimals]] = await Promise.all([
        ethCall(provider, tokenCode, {
          signature: 'symbol() returns (string)',
          arguments: [],
        }),
        ethCall(provider, tokenCode, {
          signature: 'name() returns (string)',
          arguments: [],
        }),
        ethCall(provider, tokenCode, {
          signature: 'decimals() returns (uint256)',
          arguments: [],
        }),
      ])
      props.push(symbol, name, decimals)
    } catch (e) {}

    if (!props.length || props.findIndex((p) => !p) >= 0) {
      const path = `paymentLink.chains:${chainCode}.tokens:${tokenCode}`
      if (!result.records[path]) {
        result.records[path] = []
      }
      result.records[path].push({
        validator: 'token-checker',
        type: 'error',
        message: `The token might not be valid. Please re-check the token address`,
      })
    }
  }
}
