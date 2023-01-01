import { BigNumber, BigNumberish, constants, providers, utils, Wallet } from 'ethers'
import * as process from 'process'
import { isValidMnemonic } from 'ethers/lib/utils'
import { SubscriptionManager, TestTokenWithPermit } from '../abi'
const { defaultAbiCoder, FunctionFragment, hexConcat, hexDataSlice, id } = utils

export type TransactionDataPrimitive = string | boolean | BigNumberish | TransactionDataPrimitive[]

export interface TransactionDataCallSpec {
  signature: string
  arguments: TransactionDataPrimitive[]
}

export type TransactionDataSpec = string | TransactionDataCallSpec | undefined

export function parseTransactionData(data: TransactionDataSpec): string | undefined {
  if (!data || typeof data === 'string') {
    return data
  }

  const fn = FunctionFragment.fromString(data.signature)
  return hexConcat([
    hexDataSlice(id(fn.format()), 0, 4),
    defaultAbiCoder.encode(fn.inputs, data.arguments),
  ])
}

let provider: providers.Provider
export function getProvider(): providers.Provider {
  if (!provider) {
    provider = process.env.JSON_RPC_URL
      ? new providers.JsonRpcProvider(process.env.JSON_RPC_URL)
      : new providers.InfuraWebSocketProvider(
          {
            name: process.env.INFURA_NETWORK_NAME!,
            chainId: Number(process.env.CHAIN_ID),
          },
          process.env.INFURA_KEY!
        )
  }

  return provider
}

let executor: Wallet
export function getExecutor(): Wallet {
  if (!executor) {
    executor = isValidMnemonic(process.env.EXECUTOR_PRIVATE_KEY!)
      ? Wallet.fromMnemonic(process.env.EXECUTOR_PRIVATE_KEY!)
      : new Wallet(process.env.EXECUTOR_PRIVATE_KEY!)
    executor = executor.connect(getProvider())
  }

  return executor
}

export async function generatePermitSignature(
  subscriptionManager: SubscriptionManager,
  tokenWithPermit: TestTokenWithPermit,
  signer: Wallet,
  planId: BigNumber
): Promise<[string, string, string]> {
  const network = await tokenWithPermit.provider.getNetwork()
  const plan = await subscriptionManager.plans(planId)
  const nonce = await tokenWithPermit.nonces(signer.address)
  const signature = await signer._signTypedData(
    {
      name: await tokenWithPermit.name(),
      version: '1',
      chainId: network.chainId,
      verifyingContract: tokenWithPermit.address,
    },
    {
      Permit: [
        {
          name: 'owner',
          type: 'address',
        },
        {
          name: 'spender',
          type: 'address',
        },
        {
          name: 'value',
          type: 'uint256',
        },
        {
          name: 'nonce',
          type: 'uint256',
        },
        {
          name: 'deadline',
          type: 'uint256',
        },
      ],
    },
    {
      owner: signer.address,
      spender: subscriptionManager.address,
      value: plan.tokenAmount,
      nonce: nonce,
      deadline: constants.MaxUint256,
    }
  )
  return [`0x${signature.slice(130, 132)}`, signature.slice(0, 66), `0x${signature.slice(66, 130)}`]
}
