/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import { Contract, Signer } from 'ethers'
import { InferusConfig, loadConfig } from '../../config'
import { InferusNames } from '../../types/InferusNames'
import { GraphQLClient } from 'graphql-request'
import abi from '../../abis/InferusNames.json'
import { resolveNameQuery, ResolveNameQueryResult } from '../../graphql'
import { formatBytes32String, toUtf8String } from 'ethers/lib/utils'
import { constants as ethersConstants } from 'ethers/lib/ethers'
import { normalizeName, validateIpfsUri } from '../utils'
import axios, { AxiosInstance } from 'axios'
import { NameMetadata } from '../types'
import { validateNameMetadata } from '../validation'

export class NameResolver {
  signer: Signer
  namesContract: InferusNames
  graphClient: GraphQLClient
  ipfsGatewayClient: AxiosInstance
  ipfsGatewayUrlTemplate: string

  static readonly CHAIN_ID = 137

  constructor(signer: Signer, config?: InferusConfig) {
    if (!signer.provider) {
      throw Error('signer must be connected to a provider')
    }

    this.signer = signer
    const strictCfg = loadConfig(config)
    this.namesContract = new Contract(strictCfg.namesContractAddress, abi, signer) as InferusNames
    this.graphClient = new GraphQLClient(strictCfg.subgraphUrl)
    this.ipfsGatewayUrlTemplate = strictCfg.ipfsGateway
    this.ipfsGatewayClient = axios.create()
  }

  async getMetadata(name: string): Promise<NameMetadata> {
    const metadataUri = await this.resolveInferusNameToMetadataURI(name)
    if (!validateIpfsUri(metadataUri)) {
      console.error('Invalid IPFS URI:', metadataUri)
      throw Error('Invalid IPFS URI')
    }

    const cid = metadataUri.substring(7) // remove the leading ipfs://
    const response = await this.ipfsGatewayClient.get(
      this.ipfsGatewayUrlTemplate.replace('{{cid}}', cid)
    )
    return response.data
  }

  async resolve(name: string, chain?: string, token?: string, tag?: string): Promise<string> {
    const metadata = await this.getMetadata(name)
    if (!metadata?.paymentLink?.chains) {
      console.error('Invalid metadata:', metadata)
      throw Error('Invalid metadata content')
    }

    // ensure valid metadata
    await validateNameMetadata(metadata)

    // if chain and token are not found, use fallback address
    // if chain is found but token is not found,
    if (!chain) {
      if (!token) {
        return metadata.paymentLink.evmFallbackAddress
      } else {
        console.error('Chain must be specified for token specification to apply')
        throw Error('Chain must be specified to select token')
      }
    }

    const chainData = metadata.paymentLink.chains[chain]
    if (!chainData) {
      console.error('Chain not found in metadata:', chain)
      throw Error('No address is configured for the specified chain')
    }

    if (!token) {
      return chainData.fallbackAddress
    }
    const tokenData = chainData.tokens[token]
    if (!tokenData) {
      console.error('Token not found in metadata:', token)
      throw Error('No address is configured for the specified token on the chosen chain')
    }

    const mapping = tokenData.find((m) => m.tag === (tag || '*'))
    if (!mapping) {
      console.error('Tag not specified in metadata:', tag || '*')
      throw Error('The provided tag is not configured for the token')
    }

    return mapping.address
  }

  /**
   * Resolves the metadata URI for the name from the best available network.
   * @param inferusName The name to be resolved
   */
  private async resolveInferusNameToMetadataURI(inferusName: string): Promise<string> {
    inferusName = normalizeName(inferusName)

    const network = await this.namesContract.provider.getNetwork()
    let metadataUri: string | null
    try {
      if (network.chainId === NameResolver.CHAIN_ID) {
        metadataUri = await this.namesContract.metadataURIs(formatBytes32String(inferusName))
        metadataUri = toUtf8String(metadataUri)
      } else {
        metadataUri = await this.resolveMetadataFromGraphNetwork(inferusName)
      }
    } catch (e) {
      throw Error(`Invalid name: ${inferusName}\n${e}`)
    }

    if (metadataUri) {
      return metadataUri
    }
    throw Error(`Invalid name: ${inferusName}\nName not linked with an address`)
  }

  private async resolveMetadataFromGraphNetwork(inferusName: string): Promise<string | null> {
    const response = await this.graphClient.request<ResolveNameQueryResult>(resolveNameQuery, {
      name: inferusName,
    })

    if (response.nameEntities.length !== 1) {
      return null
    }

    return response.nameEntities[0].metadataUri
  }
}
