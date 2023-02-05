/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
import { BigNumber, providers, Signer } from 'ethers'
import { ethCall, parseTransactionData } from '../engine/utils'
import { NameResolver } from '../engine/resolution'
import { getChainsMap } from '../engine'
import { parseEther, parseUnits } from 'ethers/lib/utils'

export async function pay(
  signer: Signer,
  amount: string,
  name: string,
  chain: string,
  token: string,
  tag?: string
) {
  const rpcUrl = getChainRPCUrlForPayment(chain)
  const resolver = new NameResolver(signer.connect(new providers.JsonRpcProvider(rpcUrl)))
  const address = await resolver.resolve(name, chain, token, tag)
  const parsedAmount = await getAmount(amount, token, resolver.signer.provider!)

  if (token === 'coin') {
    await payCoin(address, parsedAmount, resolver.signer)
  } else {
    await payToken(address, token, parsedAmount, resolver.signer)
  }
}

async function getAmount(amount: string, token: string, provider: providers.Provider) {
  if (token === 'coin') {
    return parseEther(amount)
  }

  const [decimals] = await ethCall(provider, token, {
    signature: 'decimals() returns (uint256)',
    arguments: [],
  })

  if (!decimals) {
    throw Error(`Invalid token: ${token}`)
  }
  return parseUnits(amount, decimals)
}

function getChainRPCUrlForPayment(chainCode: string) {
  const chainsMap = getChainsMap()
  const chain = chainsMap.get(chainCode)
  if (!chain?.evmMeta?.rpc) {
    throw Error('Quick3Pay is not supported for the selected blockchain')
  }
  return chain.evmMeta.rpc[0]
}

async function payCoin(address: string, amount: BigNumber, signer: Signer) {
  const tx = await signer.sendTransaction({
    to: address,
    value: amount,
  })
  await tx.wait()
}

async function payToken(address: string, tokenAddress: string, amount: BigNumber, signer: Signer) {
  const tx = await signer.sendTransaction({
    to: tokenAddress,
    data: parseTransactionData({
      signature: 'transfer(address,uint256)',
      arguments: [address, amount],
    }),
  })
  await tx.wait()
}
