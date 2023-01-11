/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
import { providers, Wallet } from 'ethers'
import { formatEther, parseUnits } from 'ethers/lib/utils'
import dotenv from 'dotenv'
import { InferusClient } from '../client'
import axios from 'axios'

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

async function loadGasPrice() {
  const gasPriceResponse = await axios('https://gasstation-mainnet.matic.network/v2')
  const maxFee = gasPriceResponse.data?.standard?.maxFee
  const maxPriorityFee = gasPriceResponse.data?.standard?.maxPriorityFee
  if (!maxFee || !maxPriorityFee) {
    throw Error('Failed to load gas price from gas station service')
  }

  return {
    maxFeePerGas: parseUnits(Math.ceil(maxFee).toString(), 'gwei'),
    maxPriorityFeePerGas: parseUnits(Math.ceil(maxPriorityFee).toString(), 'gwei'),
  }
}

async function main() {
  console.log('Starting Inferus Sample')
  const provider = new providers.InfuraProvider(
    { chainId: 137, name: 'matic' },
    process.env.INFURA_KEY
  )
  const wallet1Source = Wallet.fromMnemonic(process.env.MNEMONIC_A!).connect(provider)
  const wallet2Source = Wallet.fromMnemonic(process.env.MNEMONIC_B!).connect(provider)
  const wallet1 = Wallet.createRandom().connect(provider)
  const wallet2 = Wallet.createRandom().connect(provider)

  const { maxFeePerGas, maxPriorityFeePerGas } = await loadGasPrice()
  await wallet1Source.sendTransaction({
    to: wallet1.address,
    value: (await wallet1Source.getBalance()).div(100),
    maxFeePerGas,
    maxPriorityFeePerGas,
  })
  await wallet2Source.sendTransaction({
    to: wallet2.address,
    value: (await wallet2Source.getBalance()).div(100),
    maxFeePerGas,
    maxPriorityFeePerGas,
  })
  console.log('Wallet Address 1:', wallet1.address)
  console.log('Wallet Address 2:', wallet2.address)

  await Promise.all([waitForFunding(wallet1), waitForFunding(wallet2)])

  const grecaptcha = {
    execute: () => Promise.resolve('test-token'),
  }
  const wallet1Client = new InferusClient(wallet1, undefined, grecaptcha)
  const wallet2Client = new InferusClient(wallet2, undefined, grecaptcha)

  const name1 = `test${Math.floor(Math.random() * 100000)}`
  const name2 = `test${Math.floor(Math.random() * 100000)}`
  let price = await wallet1Client.getLinkingPrice()
  console.log('Registering', name1, 'for', formatEther(price))
  await wallet1Client.register(name1, {
    paymentLink: {
      evmFallbackAddress: wallet1.address,
      chains: {
        'evm:1': {
          isEVM: true,
          fallbackAddress: wallet1.address,
          tokens: {
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': [
              {
                address: wallet2.address,
                tag: '*',
              },
            ],
          },
        },
        'otc:bitcoin': {
          isEVM: false,
          fallbackAddress: '1KFzzGtDdnq5hrwxXGjwVnKzRbvf8WVxck',
          tokens: {
            coin: [
              {
                address: '1KFzzGtDdnq5hrwxXGjwVnKzRbvf8WVxck',
                tag: '*',
              },
            ],
          },
        },
      },
    },
  })

  price = await wallet1Client.getLinkingPrice()
  console.log('Registering', name2, 'for', formatEther(price))
  await wallet2Client.register(name2, {
    paymentLink: {
      evmFallbackAddress: wallet1.address,
      chains: {
        'evm:1': {
          isEVM: true,
          fallbackAddress: wallet1.address,
          tokens: {
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': [
              {
                address: wallet2.address,
                tag: '*',
              },
            ],
          },
        },
        'otc:bitcoin': {
          isEVM: false,
          fallbackAddress: '1KFzzGtDdnq5hrwxXGjwVnKzRbvf8WVxck',
          tokens: {
            coin: [
              {
                address: '1KFzzGtDdnq5hrwxXGjwVnKzRbvf8WVxck',
                tag: '*',
              },
            ],
          },
        },
      },
    },
  })

  /* price = await wallet1Client.getTransferPrice()
  console.log('Transferring', name2, 'for', formatEther(price))
  await wallet1Client.transfer(name2, wallet2.address)

  price = await wallet2Client.getLinkingPrice()
  console.log('Claiming', name2, 'for', formatEther(price))
  await wallet2Client.claim(name2)

  price = await wallet1Client.getTransferPrice()
  console.log('Transferring', name1, 'for', formatEther(price))
  await wallet1Client.transfer(name1, `@${name2}`) // send with name

  price = await wallet2Client.getLinkingPrice()
  console.log('Claiming', name1, 'for', formatEther(price))
  await wallet2Client.claim(name1) */

  const resolverClient = new InferusClient(
    wallet1.connect(new providers.JsonRpcProvider('https://matic-mumbai.chainstacklabs.com')), // different chain
    {}
  )
  // wait 1 minute for the name to get indexed
  await new Promise((resolve) => setTimeout(resolve, 60000))
  const bitcoinAddress = await resolverClient.resolveName(`@${name1}`, 'otc:bitcoin')
  console.log(`@${name1}'s bitcoin address is:`, bitcoinAddress)

  try {
    await resolverClient.resolveName('@sfkifjavdlkgak')
  } catch (e) {
    console.log(e)
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = -1
})
