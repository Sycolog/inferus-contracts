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
let count = 0

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
  return await Promise.race([
    client.get(`/ipfs/${cid}`),
    new Promise((resolve, reject) => setTimeout(reject, 1000)),
  ])
}

export async function loadFromIPFS(cid: string): Promise<any> {
  count++
  const i = count % getClients().length

  try {
    const result = await loadFromSingleClient(getClients()[i], cid)
    return result?.data
  } catch (e) {
    return await loadFromIPFS(cid)
  }
}
