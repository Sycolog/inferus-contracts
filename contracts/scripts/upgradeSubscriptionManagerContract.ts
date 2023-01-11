import '@nomiclabs/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades'
import { ethers, upgrades } from 'hardhat'

async function main() {
  const factory = await ethers.getContractFactory('SubscriptionManager')

  const contract = await upgrades.upgradeProxy(
    process.env.SUBSCRIPTIONS_CONTRACT_ADDRESS,
    factory,
  )

  console.log('Subscription Manager:', contract.address)
  console.log('Subscription Manager tx hash:', contract.deployTransaction.hash)
  await contract.deployed()
}

main().catch((error) => {
  console.error(error)
  throw error
})
