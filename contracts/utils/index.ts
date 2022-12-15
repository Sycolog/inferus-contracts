import { BigNumber, providers, constants } from 'ethers'
import { SubscriptionManager, TestTokenWithPermit } from '../build/types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

export async function addTime(provider: providers.Provider, seconds: number) {
  const hardhatProvider = provider as providers.JsonRpcProvider
  await hardhatProvider.send('evm_increaseTime', [seconds])
}

export async function generatePermitSignature(
  subscriptionManager: SubscriptionManager,
  tokenWithPermit: TestTokenWithPermit,
  signer: SignerWithAddress,
  planId: BigNumber,
) {
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
    },
  )
  return [
    `0x${signature.slice(130, 132)}`,
    signature.slice(0, 66),
    `0x${signature.slice(66, 130)}`,
  ]
}
