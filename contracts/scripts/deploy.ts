import '@nomiclabs/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades'
import { ethers, upgrades } from 'hardhat'

async function main() {
  const factory = await ethers.getContractFactory('InferusNames')

  const basePrice = ethers.utils.parseEther('0.5') // 0.5 MATIC <~0.2-0.8 USD>

  // If we had constructor arguments, they would be passed into deploy()
  const contract = await upgrades.deployProxy(factory, [basePrice], {
    initializer: 'initialize',
  })

  // The address the Contract WILL have once mined
  console.log(contract.address)

  // The transaction that was sent to the network to deploy the Contract
  console.log(contract.deployTransaction.hash)

  // The contract is NOT deployed yet; we must wait until it is mined
  await contract.deployed()
}

main().catch((error) => {
  console.error(error)
  throw error
})
