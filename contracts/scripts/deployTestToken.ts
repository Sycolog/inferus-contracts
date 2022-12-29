import '@nomiclabs/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades'
import { ethers, upgrades } from 'hardhat'

async function deployTestTokenContract() {
  const factory = await ethers.getContractFactory('TestTokenWithPermit')

  // If we had constructor arguments, they would be passed into deploy()
  const contract = await upgrades.deployProxy(factory, [], {
    initializer: 'initialize',
  })

  // The address the Contract WILL have once mined
  console.log('Test Token Contract:', contract.address)

  // The transaction that was sent to the network to deploy the Contract
  console.log('Test Token Contract tx hash:', contract.deployTransaction.hash)

  // The contract is NOT deployed yet; we must wait until it is mined
  await contract.deployed()
}

async function main() {
  await deployTestTokenContract()
}

main().catch((error) => {
  console.error(error)
  throw error
})
