/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import defaultConfigs from './defaults.json'

export interface InferusConfig {
  namesContractAddress?: string
  subscriptionsContractAddress?: string
  subgraphUrl?: string
  gaslessTransactionsUrl?: string
  defaultNFTStorageKey?: string
  recaptchaKey?: string
  ipfsGateway?: string
}

interface StrictInferusConfig extends InferusConfig {
  namesContractAddress: string
  subscriptionsContractAddress: string
  subgraphUrl: string
  gaslessTransactionsUrl: string
  defaultNFTStorageKey: string
  recaptchaKey: string
  ipfsGateway: string
}

export function loadConfig(cfg?: InferusConfig): StrictInferusConfig {
  return {
    namesContractAddress: cfg?.namesContractAddress || defaultConfigs.NAMES_CONTRACT_ADDRESS,
    subscriptionsContractAddress:
      cfg?.subscriptionsContractAddress || defaultConfigs.SUBSCRIPTIONS_CONTRACT_ADDRESS,
    subgraphUrl: cfg?.subgraphUrl || defaultConfigs.SUBGRAPH_URL,
    gaslessTransactionsUrl: cfg?.gaslessTransactionsUrl || defaultConfigs.GASLESS_TRANSACTIONS_URL,
    defaultNFTStorageKey: cfg?.defaultNFTStorageKey || defaultConfigs['DEFAULT_NFT.STORAGE_KEY'],
    recaptchaKey: cfg?.recaptchaKey || defaultConfigs.RECAPTCHA_KEY,
    ipfsGateway: cfg?.ipfsGateway || defaultConfigs.IPFS_GATEWAY,
  }
}
