import '@nomiclabs/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades'
import { ethers, upgrades } from 'hardhat'

async function main() {
  const factory = await ethers.getContractFactory('InferusNames')

  const contract = await upgrades.upgradeProxy(
    process.env.NAMES_CONTRACT_ADDRESS,
    factory,
  )

  console.log('Names Contract:', contract.address)
  console.log('Names Contract tx hash:', contract.deployTransaction.hash)
  await contract.deployed()
}

main().catch((error) => {
  console.error(error)
  throw error
})
