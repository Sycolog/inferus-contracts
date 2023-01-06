import { NFTStorage, File } from 'nft.storage'

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
