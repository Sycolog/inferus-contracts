/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment */
import evmChains from '../output/evm-chains.json'
import cryptocurrencies from '../output/coinmarketcap/all-cryptocurrencies.json'
import evmSlugMappings from '../output/coinmarketcap/evm-slug-mappings.json'
import dotenv from 'dotenv'
import { writeFile } from './utils'
dotenv.config()

function getConflictCurrencies() {
  console.log('Checking for currency conflicts')
  const conflictCurrencies = new Set<string>()
  const currencyUsage = new Map<string, number>()
  for (const chain of evmChains) {
    const symbol = chain.evmMeta?.nativeCurrency?.symbol?.toLowerCase()
    if (!symbol) {
      continue
    }

    if (!currencyUsage.has(symbol)) {
      currencyUsage.set(symbol, 0)
    }

    currencyUsage.set(symbol, currencyUsage.get(symbol)! + 1)
  }

  for (const [key, value] of currencyUsage) {
    if (value > 1) {
      conflictCurrencies.add(key)
    }
  }
  console.log('Done identifying currency conflicts')
  return conflictCurrencies
}

function getRefinedCryptocurrencies(
  conflictCurrencies: Set<string>,
  slugMappings: Map<string, string>
) {
  const idMap = new Map<string, string>()
  const refinedCryptocurrencies = []
  const firstChain = evmChains[0]
  const slugMappedChains = new Map<string, typeof firstChain>()
  for (const chain of evmChains) {
    const symbol = chain.evmMeta?.nativeCurrency?.symbol?.toLowerCase()
    if (!symbol) {
      continue
    }

    if (!conflictCurrencies.has(symbol)) {
      idMap.set(symbol, chain.id)
    } else if (chain.evmMeta.chainSlug) {
      slugMappedChains.set(chain.evmMeta.chainSlug, chain)
    }
  }

  for (const crypto of cryptocurrencies) {
    refinedCryptocurrencies.push({
      id: crypto.id,
      internalId:
        idMap.get(crypto.symbol.toLowerCase()) ||
        slugMappedChains.get(slugMappings.get(crypto.slug)!)?.id,
      name: crypto.name,
      symbol: crypto.symbol,
      category: crypto.category,
      slug: crypto.slug,
      logo: crypto.logo,
      contractAddress: crypto.contract_address?.map((addrInfo) => ({
        address: addrInfo.contract_address,
        platform: {
          ...addrInfo.platform,
          internalId:
            idMap.get(addrInfo.platform.coin.symbol.toLowerCase()) ||
            slugMappedChains.get(slugMappings.get(addrInfo.platform.coin.slug)!)?.id,
        },
      })),
    })
  }
  return refinedCryptocurrencies
}

function getSlugMappings() {
  const slugMappings = new Map<string, string>()
  for (const chain of evmChains) {
    if (!chain.evmMeta?.chainSlug) {
      continue
    }
    slugMappings.set(chain.evmMeta.chainSlug, chain.evmMeta.chainSlug)
  }
  for (const key of Object.keys(evmSlugMappings) as Array<keyof typeof evmSlugMappings>) {
    slugMappings.set(key, evmSlugMappings[key])
  }
  return slugMappings
}

async function main() {
  // conflict networks are the evm chain that use the same currency symbol like Ethereum and Optimism (ETH)
  // for non-conflict networks, the chain currency is enough
  // for conflict networks, we match with the chain slug. We use evm-slug mappings to guide our matching.

  const slugMappings = getSlugMappings()
  const conflictCurrencies = getConflictCurrencies()
  const refinedCryptocurrencies = getRefinedCryptocurrencies(conflictCurrencies, slugMappings)
  const evmChainIdMap = new Map(evmChains.map((c) => [c.id, c]))
  const allChains = []

  for (const crypto of refinedCryptocurrencies) {
    if (!crypto.internalId) {
      crypto.internalId = `otc:cmc-${crypto.id}`
    }

    if (crypto.category === 'coin' && crypto.internalId.startsWith('otc:cmc-')) {
      allChains.push({
        id: crypto.internalId,
        name: crypto.name,
        logo: crypto.logo,
      })
    } else if (evmChainIdMap.has(crypto.internalId)) {
      allChains.push(evmChainIdMap.get(crypto.internalId))
    }
  }

  await writeFile('coinmarketcap/cryptocurrencies.json', JSON.stringify(refinedCryptocurrencies))
  await writeFile('chains.json', JSON.stringify(allChains, null, 2))
}

main().catch((e) => {
  console.error(e)
  throw e
})
