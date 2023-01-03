import '@nomiclabs/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades'
import { ethers } from 'hardhat'
import { SubscriptionManager__factory } from '../build/types'

async function main() {
  const factory = (await ethers.getContractFactory(
    'SubscriptionManager',
  )) as SubscriptionManager__factory
  const subscriptionManager = factory.attach(process.env.SUBSCRIPTIONS_CONTRACT_ADDRESS!)

  const duration = 30 * 24 * 60 * 60 // monthly - 30 days x 24 hours x 60 minutes x 60 seconds
  const tokenAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC on Polygon
  const amount = ethers.utils.parseUnits('5', 6) // USDC uses six decimals
  const tx = await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
  const rct = await tx.wait()
  const event = rct.events.find((e) => e.event === 'CreatePlan')
  console.log('Plan Created:', event.args.id)
}

main().catch((error) => {
  console.error(error)
  throw error
})
