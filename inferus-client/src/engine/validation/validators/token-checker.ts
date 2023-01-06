import { NameMetadata } from '../../types'
import { ValidationResult } from '../types'
import chains from '../../chains.json'
import { ethers } from 'ethers'

export default async function validate(metadata: NameMetadata, result: ValidationResult) {
  for (const chainCode of Object.keys(metadata.paymentLink.chains)) {
    const chainData = metadata.paymentLink.chains[chainCode]
    const indexInChains = chains.findIndex((c) =>
      chainData.isEVM ? chainCode === `evm:${c.chainId}` : chainCode === `otc:${c.coingeckoId}`
    )

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
      // todo: Implement token validation for non-EVM chains
      continue
    }

    // Special token codes: `coin` for coins, `*` for wildcard
    const specialTokenCodes = ['coin', '*']
    for (const tokenCode of Object.keys(chainData.tokens)) {
      if (specialTokenCodes.includes(tokenCode)) {
        continue
      }

      await validateERC20Token(indexInChains, chainCode, tokenCode, result)
    }
  }
}

async function validateERC20Token(
  indexInChains: number,
  chainCode: string,
  tokenCode: string,
  result: ValidationResult
) {
  const chain = chains[indexInChains]
  if (chain.rpc) {
    let logs = []
    try {
      const provider = new ethers.providers.JsonRpcProvider(chain.rpc)
      const blockNumber = await provider.getBlockNumber()
      logs = await provider.getLogs({
        address: tokenCode,
        topics: [ethers.utils.id('Transfer(address,address,uint256)')], // Transfer (indexed address from, indexed address to, uint256 value)
        fromBlock: blockNumber - 1000,
      })
    } catch (e) {}

    if (!logs?.length) {
      const path = `paymentLink.chains.${chainCode}.tokens.${tokenCode}`
      if (!result.records[path]) {
        result.records[path] = []
      }
      result.records[path].push({
        validator: 'token-checker',
        type: 'warning',
        message: `The token might not be valid. Please re-check the token address`,
      })
    }
  }
}
