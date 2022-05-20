import { BigNumber, constants as ethersConstants, Contract, Signer } from 'ethers'
import { formatBytes32String } from 'ethers/lib/utils'
import { GraphQLClient } from 'graphql-request'
import { InferusNames } from '../types/InferusNames'
import { InferusConfig, loadConfig } from '../config'
import abi from '../abis/InferusNames.json'
import {
  LinkedNamesQueryResult,
  getLinkedNamesQuery,
  resolveNameQuery,
  ResolveNameQueryResult,
} from '../graphql'

export class InferusClient {
  signer: Signer
  contract: InferusNames
  graphClient: GraphQLClient
  static readonly CHAIN_ID = 4

  constructor(signer: Signer, config?: InferusConfig) {
    if (!signer.provider) {
      throw Error('signer must be connected to a provider')
    }

    this.signer = signer
    const strictCfg = loadConfig(config)
    this.contract = new Contract(strictCfg.contractAddress, abi, signer) as InferusNames
    this.graphClient = new GraphQLClient(strictCfg.subgraphUrl)
  }

  /**
   * Register `name` for current signer
   * @param name
   */
  async register(name: string): Promise<void> {
    await this.verifyChainId()
    name = this.normalizeName(name)
    const tx = await this.contract.register(formatBytes32String(name), {
      value: await this.getLinkingPrice(),
    })
    await tx.wait()
  }

  /**
   * Release name from current signer
   * @param name
   */
  async release(name: string): Promise<void> {
    await this.verifyChainId()
    name = this.normalizeName(name)
    const tx = await this.contract.release(formatBytes32String(name))
    await tx.wait()
  }

  /**
   * Initiate transfer of ownership of `name` to `recipient`
   * @param name
   * @param recipient
   */
  async transfer(name: string, recipient: string): Promise<void> {
    await this.verifyChainId()
    name = this.normalizeName(name)
    const recipientAddress = await this.getAddress(recipient)
    const tx = await this.contract.transfer(formatBytes32String(name), recipientAddress, {
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
    name = this.normalizeName(name)
    const tx = await this.contract.claim(formatBytes32String(name), {
      value: await this.getLinkingPrice(),
    })
    await tx.wait()
  }

  /**
   * Get the price required for the current account to link a name
   */
  async getLinkingPrice(): Promise<BigNumber> {
    await this.verifyChainId()
    return await this.contract.linkingPrices(await this.signer.getAddress())
  }

  /**
   * Get the price required for the current account to transfer a name
   */
  async getTransferPrice(): Promise<BigNumber> {
    await this.verifyChainId()
    return await this.contract.basePrice()
  }

  async getTransferOwner(name: string): Promise<string> {
    await this.verifyChainId()
    name = this.normalizeName(name)
    return await this.contract.transfers(formatBytes32String(name))
  }

  /**
   * Resolves the name from the best available network.
   * @param inferusName The name to be resolved
   */
  async resolveInferusName(inferusName: string): Promise<string> {
    if (inferusName[0] === '@') {
      inferusName = inferusName.substring(1)
    }
    inferusName = this.normalizeName(inferusName)

    const network = await this.contract.provider.getNetwork()
    let owner: string | null
    try {
      if (network.chainId === InferusClient.CHAIN_ID) {
        owner = await this.contract.names(formatBytes32String(inferusName))
      } else {
        owner = await this.resolveInferusNameFromGraphNetwork(inferusName)
      }
    } catch (e) {
      throw Error(`Invalid name: ${inferusName}\n${e}`)
    }

    if (!!owner && owner !== ethersConstants.AddressZero) {
      return owner
    }
    throw Error(`Invalid name: ${inferusName}\nName not linked with an address`)
  }

  async getLinkedNames(address: string): Promise<string[]> {
    const response = await this.graphClient.request<LinkedNamesQueryResult>(getLinkedNamesQuery, {
      address,
    })

    if (!response.nameOwnerEntity) {
      return []
    }
    return response.nameOwnerEntity.names.map((n) => n.name)
  }

  /**
   * Converts a valid name to a standard form including only lowercase letters, numbers and underscore.
   * @param name
   */
  public normalizeName(name: string): string {
    if (name[0] === '@') {
      name = name.substring(1)
    }

    if (!/^\w{2,32}$/.test(name)) {
      throw Error(
        'Valid inferus names have a minimum of 2 and a maximum of 32 characters including letters, numbers, and underscore.'
      )
    }

    return name.toLowerCase()
  }

  public isNormalized(name: string): boolean {
    return /^[a-z0-9_]{2,32}$/.test(name)
  }

  public convertToPresentationForm(name: string): string {
    const namePart = name[0] === '@' ? name.substring(1) : name
    return `@${this.normalizeName(namePart)}`
  }

  public isPresentationForm(name: string): boolean {
    return name[0] === '@' && this.isNormalized(name.substring(1))
  }

  private async resolveInferusNameFromGraphNetwork(inferusName: string): Promise<string | null> {
    const response = await this.graphClient.request<ResolveNameQueryResult>(resolveNameQuery, {
      name: inferusName,
    })

    if (response.nameEntities.length !== 1) {
      return null
    }

    return response.nameEntities[0].owner.address
  }

  private async getAddress(addressOrName: string) {
    if (addressOrName[0] === '@') {
      return this.resolveInferusName(addressOrName)
    }

    // fallback to ethers default handling (with ENS support)
    return addressOrName
  }

  private async verifyChainId() {
    const network = await this.contract.provider.getNetwork()
    if (network.chainId !== InferusClient.CHAIN_ID) {
      throw Error(`Invalid chain '${network.chainId}'. Switch to '${InferusClient.CHAIN_ID}'`)
    }
  }
}
