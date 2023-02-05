import { chainsList } from '../index'
let chainsMap: Map<string, typeof chainsList[number]>

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
