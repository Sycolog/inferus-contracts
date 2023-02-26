import { chainsList } from '../index'
import * as utils from './utils'
import { providers } from 'ethers'
let chainsMap: Map<string, typeof chainsList[number]>

export { utils }
export function getChainsMap(): Map<string, typeof chainsList[number]> {
  if (chainsMap) {
    return chainsMap
  }

  chainsMap = new Map<string, typeof chainsList[number]>()
  for (const chain of chainsList) {
    chainsMap.set(chain.id, chain)
  }
  return chainsMap
}

export function getProviderByChainId(config: { chainId?: number }): providers.Provider | undefined {
  if (!config.chainId) {
    config.chainId = 1
  }
  const chain = getChainsMap().get(`evm:${config.chainId}`)
  const rpcUrl = chain?.evmMeta?.rpc?.[0]
  if (!rpcUrl) {
    return undefined
  }

  return new providers.JsonRpcProvider(rpcUrl, {
    chainId: config.chainId,
    name: chain.name,
  })
}
