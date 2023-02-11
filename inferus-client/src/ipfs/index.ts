/* eslint-disable @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access */
import { NFTStorage, File } from 'nft.storage'
import axios, { AxiosInstance } from 'axios'

export interface IpfsConfig {
  nftStorageApiKey: string
}

/**
 * A very simple implementation of a network based on IPFS that stores transaction data
 * publicly on the IPFS network. Actual transaction data is encrypted on the network, but
 * key information is stored in a manner that can be deterministically located by proxies.
 */
export class IPFS {
  private client: NFTStorage

  constructor(config: IpfsConfig) {
    this.client = new NFTStorage({ token: config.nftStorageApiKey })
  }

  async send(data: string): Promise<string> {
    // generate key and iv
    const cid = await this.client.storeBlob(new File([Buffer.from(data, 'utf-8')], ''))
    return `ipfs://${cid}`
  }
}

const ipfsGateways = [
  'https://dweb.link',
  'https://cf-ipfs.com',
  'https://cloudflare-ipfs.com',
  'https://hardbin.com',
  'https://gateway.ipfs.io',
]

let clients: AxiosInstance[]

function getClients(): AxiosInstance[] {
  if (!clients) {
    clients = ipfsGateways.map((gatewayUrl) =>
      axios.create({
        baseURL: gatewayUrl,
      })
    )
  }

  return clients
}

async function loadFromSingleClient(client: AxiosInstance, cid: string): Promise<any> {
  try {
    return await client.get(`/ipfs/${cid}`)
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return await loadFromSingleClient(client, cid)
  }
}

export async function loadFromIPFS(cid: string): Promise<any> {
  const promises = getClients().map((c) => loadFromSingleClient(c, cid))

  // timeout in 15 seconds - (internet may be bad)
  const timeoutSeconds = 15
  promises.push(new Promise((resolve) => setTimeout(resolve, timeoutSeconds * 1000)))
  const result = await Promise.race(promises)
  return result?.data
}
