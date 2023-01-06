export interface TokenData {
  tag: string
  address: string
}

export interface ChainData {
  isEVM: boolean
  fallbackAddress: string
  tokens: Record<string, TokenData[]> // tokenAddress => TokenData
}

export interface PaymentLinkData {
  evmFallbackAddress: string
  chains: Record<string, ChainData> // chainCode => chainData
}

export interface NameMetadata {
  paymentLink: PaymentLinkData
}
