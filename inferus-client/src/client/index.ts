/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access */
import { BigNumber, Contract, Signer } from 'ethers'
import { arrayify, formatBytes32String, hexlify } from 'ethers/lib/utils'
import { GraphQLClient } from 'graphql-request'
import { InferusNames } from '../types/InferusNames'
import { InferusConfig, loadConfig } from '../config'
import abi from '../abis/InferusNames.json'
import { LinkedNamesQueryResult, getLinkedNamesQuery } from '../graphql'
import { IPFS } from '../ipfs'
import { NameMetadata } from '../engine/types'
import { validateNameMetadata } from '../engine/validation'
import { GaslessTransactionExecutor, RecaptchaHandler } from '../engine/gasless'
import { NameResolver } from '../engine/resolution'
import { normalizeName } from '../engine/utils'
import { pay } from '../payment'

export class InferusClient {
  signer: Signer
  namesContract: InferusNames
  graphClient: GraphQLClient
  nameResolver: NameResolver
  gaslessTransactionsExecutor?: GaslessTransactionExecutor
  ipfs: IPFS

  constructor(signer: Signer, config?: InferusConfig, grecaptcha?: any) {
    if (!signer.provider) {
      throw Error('signer must be connected to a provider')
    }

    this.signer = signer
    const strictCfg = loadConfig(config)
    this.namesContract = new Contract(strictCfg.namesContractAddress, abi, signer) as InferusNames
    this.graphClient = new GraphQLClient(strictCfg.subgraphUrl)
    this.nameResolver = new NameResolver(signer, config)
    this.ipfs = new IPFS({ nftStorageApiKey: strictCfg.defaultNFTStorageKey })
    if (grecaptcha) {
      this.gaslessTransactionsExecutor = new GaslessTransactionExecutor(
        strictCfg.gaslessTransactionsUrl,
        new RecaptchaHandler(grecaptcha, strictCfg.recaptchaKey)
      )
    }
  }

  /**
   * Register `name` for current signer
   * @param name
   * @param metadata
   */
  async register(name: string, metadata: NameMetadata): Promise<void> {
    name = formatBytes32String(normalizeName(name))
    const metadataUri = await this.getMetadataUri(metadata)
    const signerAddress = await this.signer.getAddress()

    const network = await this.namesContract.provider.getNetwork()
    let linkingPrice: BigNumber | undefined
    if (network.chainId === NameResolver.CHAIN_ID) {
      linkingPrice = await this.getLinkingPrice()
    }
    if (this.gaslessTransactionsExecutor && (!linkingPrice || linkingPrice.eq(0))) {
      const hash = await this.namesContract.getHashForRegisterBySignature(
        name,
        signerAddress,
        metadataUri
      )
      const signature = await this.signer.signMessage(arrayify(hash))
      await this.gaslessTransactionsExecutor.queueGaslessTransaction({
        transactionType: 'register',
        arguments: [name, signerAddress, metadataUri, signature],
      })
      return
    }

    await this.verifyChainId()
    const tx = await this.namesContract.register(name, metadataUri, {
      value: linkingPrice,
    })
    await tx.wait()
  }

  /**
   * Update the metadata overriding existing data with new metadata.
   * @param name The name for which the metadata should be updated
   * @param metadata The new metadata to be set. Will override any existing data
   */
  async updateMetadata(name: string, metadata: NameMetadata): Promise<void> {
    await this.verifyChainId()
    name = normalizeName(name)
    const metadataUri = await this.getMetadataUri(metadata)
    const tx = await this.namesContract.setMetadataURI(formatBytes32String(name), metadataUri)
    await tx.wait()
  }

  /**
   * Resolve the address for the name given the optional parameters
   * @param name The name to be resolved
   * @param chain The chain for which the address should be resolved. Format is evm:<chainId> for evm chains and otc:<coingeckoId> for non-evm chains.
   * @param token The token address to be resolved. `coin` to resolve the address mapped to the network coin.
   * @param tag   A tag to distinguish between multiple addresses for the same token on the same chain
   */
  async resolveName(name: string, chain?: string, token?: string, tag?: string): Promise<string> {
    return await this.nameResolver.resolve(name, chain, token, tag)
  }

  /**
   * Quick3Pay - pay with a single button click. Currently only supports tokens on EVM chains
   * @param amount
   * @param name
   * @param chain
   * @param token
   * @param tag
   */
  async pay(
    amount: string,
    name: string,
    chain: string,
    token: string,
    tag?: string
  ): Promise<void> {
    await pay(this.signer, amount, name, chain, token, tag)
  }

  async getMetadata(name: string): Promise<NameMetadata> {
    return await this.nameResolver.getMetadata(name)
  }

  /**
   * Release name from current signer
   * @param name
   */
  async release(name: string): Promise<void> {
    await this.verifyChainId()
    name = normalizeName(name)
    const tx = await this.namesContract.release(formatBytes32String(name))
    await tx.wait()
  }

  /**
   * Initiate transfer of ownership of `name` to `recipient`
   * @param name
   * @param recipient
   */
  async transfer(name: string, recipient: string): Promise<void> {
    await this.verifyChainId()
    name = normalizeName(name)
    const recipientAddress = await this.getAddress(recipient)
    const tx = await this.namesContract.transfer(formatBytes32String(name), recipientAddress, {
      value: await this.getTransferPrice(),
    })
    await tx.wait()
  }

  /**
   * Claim ownership of a name that has been transferred to the current signer
   * @param name
   */
  async claim(name: string): Promise<void> {
    await this.verifyChainId()
    name = normalizeName(name)
    const tx = await this.namesContract.claim(formatBytes32String(name), {
      value: await this.getLinkingPrice(),
    })
    await tx.wait()
  }

  /**
   * Get the price required for the current account to link a name
   */
  async getLinkingPrice(): Promise<BigNumber> {
    await this.verifyChainId()
    return await this.namesContract.linkingPrices(await this.signer.getAddress())
  }

  /**
   * Get the price required for the current account to transfer a name
   */
  async getTransferPrice(): Promise<BigNumber> {
    await this.verifyChainId()
    return await this.namesContract.basePrice()
  }

  async getTransferOwner(name: string): Promise<string> {
    await this.verifyChainId()
    name = normalizeName(name)
    return await this.namesContract.transfers(formatBytes32String(name))
  }

  async getLinkedNames(address: string): Promise<string[]> {
    const response = await this.graphClient.request<LinkedNamesQueryResult>(getLinkedNamesQuery, {
      address: address.toLowerCase(), // The subgraph always indexes lower case addresses
    })

    if (!response.nameEntities.length) {
      return []
    }
    return response.nameEntities.map((n) => n.name)
  }

  async validateMetadata(metadata: NameMetadata) {
    const validationResult = await validateNameMetadata(metadata)
    const keys = Object.keys(validationResult.records)
    const errors = []
    const warnings = []
    for (const key of keys) {
      for (const record of validationResult.records[key]) {
        const message = `${key}: ${record.message}`
        if (record.type === 'error') {
          errors.push(message)
        } else if (record.type === 'warning') {
          warnings.push(message)
        }
      }
    }
    console.log(errors)
    console.log(warnings)

    if (errors.length) {
      throw Error(errors.join('\n'))
    }
  }

  private async getAddress(addressOrName: string) {
    if (addressOrName[0] === '@') {
      return this.nameResolver.resolve(addressOrName)
    }

    // fallback to ethers default handling (with ENS support)
    return addressOrName
  }

  private async getMetadataUri(metadata: NameMetadata) {
    await this.validateMetadata(metadata)
    const utf8MetadataUri = await this.ipfs.send(JSON.stringify(metadata))
    return hexlify(Buffer.from(utf8MetadataUri))
  }

  private async verifyChainId() {
    const network = await this.namesContract.provider.getNetwork()
    if (network.chainId !== NameResolver.CHAIN_ID) {
      throw Error(`Invalid chain '${network.chainId}'. Switch to '${NameResolver.CHAIN_ID}'`)
    }
  }
}
