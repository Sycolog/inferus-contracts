/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import defaultConfigs from './defaults.json'

export interface InferusConfig {
  contractAddress?: string
  subgraphUrl?: string
}

interface StrictInferusConfig extends InferusConfig {
  contractAddress: string
  subgraphUrl: string
}

export function loadConfig(cfg?: InferusConfig): StrictInferusConfig {
  return {
    contractAddress: cfg?.contractAddress || defaultConfigs.CONTRACT_ADDRESS,
    subgraphUrl: cfg?.subgraphUrl || defaultConfigs.SUBGRAPH_URL,
  }
}
