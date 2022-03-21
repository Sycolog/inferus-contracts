import { BigNumber, constants as ethersConstants, Contract, Signer } from 'ethers'
import { InferusNames } from '../types/InferusNames'
import { InferusConfig, loadConfig } from '../config'
import abi from '../abis/InferusNames.json'
import { formatBytes32String } from 'ethers/lib/utils'

export class InferusClient {
  signer: Signer
  contract: InferusNames

  constructor(signer: Signer, config?: InferusConfig) {
    if (!signer.provider) {
      throw Error('signer must be connected to a provider')
    }

    this.signer = signer
    const strictCfg = loadConfig(config)
    this.contract = new Contract(strictCfg.contractAddress, abi, signer) as InferusNames
  }

  /**
   * Register `name` for current signer
   * @param name
   */
  async register(name: string): Promise<void> {
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
    const tx = await this.contract.release(formatBytes32String(name))
    await tx.wait()
  }

  /**
   * Initiate transfer of ownership of `name` to `recipient`
   * @param name
   * @param recipient
   */
  async transfer(name: string, recipient: string): Promise<void> {
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
    const tx = await this.contract.claim(formatBytes32String(name), {
      value: await this.getLinkingPrice(),
    })
    await tx.wait()
  }

  /**
   * Get the price required for the current account to link a name
   */
  async getLinkingPrice(): Promise<BigNumber> {
    return await this.contract.linkingPrices(await this.signer.getAddress())
  }

  /**
   * Get the price required for the current account to transfer a name
   */
  async getTransferPrice(): Promise<BigNumber> {
    return await this.contract.basePrice()
  }

  async getOwner(name: string): Promise<string> {
    return await this.contract.names(formatBytes32String(name))
  }

  async getTransferOwner(name: string): Promise<string> {
    return await this.contract.transfers(formatBytes32String(name))
  }

  async resolveInferusName(inferusName: string): Promise<string> {
    if (inferusName[0] !== '@') {
      throw Error('Invalid name format. Inferus names must start with @')
    }

    try {
      const owner = await this.contract.names(formatBytes32String(inferusName.substring(1)))
      if (owner !== ethersConstants.AddressZero) {
        return owner
      }
    } catch (e) {
      throw Error(`Invalid name: ${inferusName}\n${e}`)
    }

    throw Error(`Invalid name: ${inferusName}\nName not linked with an address`)
  }

  private async getAddress(addressOrName: string) {
    if (addressOrName[0] === '@') {
      return this.resolveInferusName(addressOrName)
    }

    // fallback to ethers default handling (with ENS support)
    return addressOrName
  }
}
