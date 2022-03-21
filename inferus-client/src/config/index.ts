import defaultConfigs from './defaults.json'

export interface InferusConfig {
  contractAddress?: string
}

interface StrictInferusConfig extends InferusConfig {
  contractAddress: string
}

export function loadConfig(cfg?: InferusConfig): StrictInferusConfig {
  return {
    contractAddress: cfg?.contractAddress || defaultConfigs.CONTRACT_ADDRESS,
  }
}
