/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment */
import { coinmarketcap, writeFile } from './utils'
import dotenv from 'dotenv'
dotenv.config()

async function main() {
  // load coinmarket cap token information
  // this script will cost ~90 coinmarketcap credits
  let totalCreditsUsed = 0
  const http = coinmarketcap.getHttpClient()

  console.log('Loading token IDs')
  const tokenMap = await http.get('/v1/cryptocurrency/map')
  totalCreditsUsed += tokenMap.data.status.credit_count
  console.log('Loaded token IDs - cost:', tokenMap.data.status.credit_count)

  tokenMap.data.data.sort((a: { rank: number }, b: { rank: number }) => a.rank - b.rank)
  const tokenInfo: any[] = []

  console.log('Loading token info')
  const totalCount = tokenMap.data.data.length
  let i = 0
  const perRequest = 500
  while (i < totalCount) {
    const ids = encodeURIComponent(
      tokenMap.data.data
        .slice(i, i + perRequest)
        .map((t: { id: number }) => t.id)
        .join(',')
    )
    const tokenInfoResponse = await http.get(`/v1/cryptocurrency/info?id=${ids}`)
    totalCreditsUsed += tokenInfoResponse.data.status.credit_count
    for (const key of Object.keys(tokenInfoResponse.data.data)) {
      const crypto = tokenInfoResponse.data.data[key]
      tokenInfo.push({
        id: crypto.id,
        name: crypto.name,
        symbol: crypto.symbol,
        category: crypto.category,
        slug: crypto.slug,
        logo: crypto.logo,
        contract_address: crypto.contract_address,
      })
    }
    i += perRequest
  }

  console.log('Loaded token info - cost:', totalCreditsUsed - tokenMap.data.status.credit_count)
  await writeFile('coinmarketcap/all-cryptocurrencies.json', JSON.stringify(tokenInfo, null, 2))
  console.log('Total Credits Used:', totalCreditsUsed)
}

main().catch((e) => {
  console.error(e)
  throw e
})
