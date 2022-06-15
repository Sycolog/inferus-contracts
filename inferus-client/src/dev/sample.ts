import { providers, Wallet } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import dotenv from 'dotenv'
import { InferusClient } from '../client'

dotenv.config()

async function waitForFunding(wallet: Wallet) {
  let balance = await wallet.getBalance()

  if (balance.eq(0)) {
    console.log('Waiting for funding:', wallet.address)
  }

  while (balance.eq(0)) {
    await new Promise((resolve) => setTimeout(resolve, 5000))

    balance = await wallet.getBalance()
    if (balance.gt(0)) {
      console.log(`${wallet.address} Funded. New balance: ${formatEther(balance)}`)
    }
  }
}

async function main() {
  console.log('Starting Inferus Sample')
  const provider = new providers.InfuraProvider(
    { chainId: 1, name: 'polygon-mainnet' },
    process.env.INFURA_KEY
  )
  const wallet1 = Wallet.fromMnemonic(process.env.MNEMONIC_A!).connect(provider)
  const wallet2 = Wallet.fromMnemonic(process.env.MNEMONIC_B!).connect(provider)
  console.log('Wallet Address 1:', wallet1.address)
  console.log('Wallet Address 2:', wallet2.address)

  await Promise.all([waitForFunding(wallet1), waitForFunding(wallet2)])

  /* const wallet1Client = new InferusClient(wallet1)
  const wallet2Client = new InferusClient(wallet2)

  let price = await wallet1Client.getLinkingPrice()
  console.log('Registering staa0 for', formatEther(price))
  await wallet1Client.register('staa0')

  price = await wallet1Client.getLinkingPrice()
  console.log('Registering staa01 for', formatEther(price))
  await wallet1Client.register('staa01')

  price = await wallet1Client.getTransferPrice()
  console.log('Transferring staa01 for', formatEther(price))
  await wallet1Client.transfer('staa01', wallet2.address)

  price = await wallet2Client.getLinkingPrice()
  console.log('Claiming staa01 for', formatEther(price))
  await wallet2Client.claim('staa01')

  price = await wallet1Client.getTransferPrice()
  console.log('Transferring staa0 for', formatEther(price))
  await wallet1Client.transfer('staa0', '@staa01') // send with name

  price = await wallet2Client.getLinkingPrice()
  console.log('Claiming staa0 for', formatEther(price))
  await wallet2Client.claim('staa0')

  price = await wallet2Client.getLinkingPrice()
  console.log('Registering staa99 for', formatEther(price))
  await wallet2Client.register('staa99')

  price = await wallet2Client.getTransferPrice()
  console.log('Transferring staa99 for', formatEther(price))
  await wallet2Client.transfer('staa99', wallet1.address) // send with name

  price = await wallet1Client.getLinkingPrice()
  console.log('Claiming staa99 for', formatEther(price))
  await wallet1Client.claim('staa99') */

  const resolverClient = new InferusClient(
    wallet1.connect(new providers.JsonRpcProvider('https://polygon-rpc.com')),
    {}
  )
  const staa99 = await resolverClient.resolveInferusName('@staa99')
  console.log('@staa99 is owned by:', staa99)

  try {
    await resolverClient.resolveInferusName('@staa994')
  } catch (e) {
    console.log('@staa994 is owned by nobody:')
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = -1
})
