import { NameMetadata } from '../../types'
import { ValidationResult } from '../types'
import { ethers } from 'ethers'

const validators = new Map([
  ['allEVM', validateEVMAddress],
  // todo: add additional validators for each chain id
])

function validateEVMAddress(address: string, path: string, result: ValidationResult) {
  if (!ethers.utils.isAddress(address)) {
    if (!result.records[path]) {
      result.records[path] = []
    }
    result.records[path].push({
      validator: 'address-checker',
      type: 'error',
      message: `The address configured for ${path} is not a valid Ethereum-style address`,
    })
  }
}

export default function validate(metadata: NameMetadata, result: ValidationResult) {
  const evmValidator = validators.get('allEVM')!
  evmValidator(metadata.paymentLink.evmFallbackAddress, 'paymentLink.evmFallbackAddress', result)

  for (const chainCode of Object.keys(metadata.paymentLink.chains)) {
    const chainData = metadata.paymentLink.chains[chainCode]
    const validator = chainData.isEVM ? evmValidator : validators.get(chainCode)

    if (!validator) {
      continue
    }

    validator(chainData.fallbackAddress, `paymentLink.chains.${chainCode}.fallbackAddress`, result)
    // Special token codes: `coin` for coins, `*` for wildcard
    for (const tokenCode of Object.keys(chainData.tokens)) {
      const tokenData = chainData.tokens[tokenCode]
      for (const mapping of tokenData) {
        validator(
          mapping.address,
          `paymentLink.chains.${chainCode}.tokens.${tokenCode}:${mapping.address}@${mapping.tag}`,
          result
        )
      }
    }
  }
}
