/* eslint-disable no-unused-expressions,node/no-unpublished-import */
import { before, describe } from 'mocha'
import { expect } from 'chai'
import pino from 'pino'
import dotenv from 'dotenv'
import { Contract, Wallet, utils as ethersUtils } from 'ethers'
import { generatePermitSignature, getExecutor, getProvider } from '../../utils/transactions'
import { executeGaslessTransaction } from '../../functions/execute-gasless-transactions'
import {
  InferusNames,
  InferusNamesABI,
  SubscriptionManager,
  SubscriptionManagerABI,
  TestTokenWithPermit,
  TestTokenWithPermitABI,
} from '../../abi'

const { arrayify, hexlify, parseEther, randomBytes } = ethersUtils
const logger = pino()
dotenv.config()

describe('execute-gasless-transactions tests', () => {
  let inferusNames: InferusNames
  let subscriptionManager: SubscriptionManager
  let testTokenWithPermit: TestTokenWithPermit
  const alice = Wallet.createRandom()

  before(() => {
    inferusNames = new Contract(
      process.env.NAMES_CONTRACT_ADDRESS!,
      InferusNamesABI,
      getProvider()
    ) as InferusNames

    subscriptionManager = new Contract(
      process.env.SUBSCRIPTIONS_CONTRACT_ADDRESS!,
      SubscriptionManagerABI,
      getExecutor()
    ) as SubscriptionManager

    testTokenWithPermit = new Contract(
      process.env.TEST_TOKEN_CONTRACT_ADDRESS!,
      TestTokenWithPermitABI,
      getProvider()
    ) as TestTokenWithPermit
  })

  describe('executeGaslessTransaction', () => {
    it('should register name successfully', async () => {
      const name = randomBytes(32)
      const metadataUri = randomBytes(50)
      const hash = await inferusNames.getHashForRegisterBySignature(
        name,
        alice.address,
        metadataUri
      )
      const signature = await alice.signMessage(arrayify(hash))
      const result = await executeGaslessTransaction(
        {
          transactionType: 'register',
          arguments: [hexlify(name), alice.address, hexlify(metadataUri), signature],
        },
        {
          logger,
          requestId: hexlify(randomBytes(40)),
        }
      )
      expect(result.status).to.be.true
    })

    it('should subscribe successfully', async () => {
      const amount = parseEther('0.8')
      const duration = 60

      await subscriptionManager.createPlan(duration, testTokenWithPermit.address, amount, true)
      const planId = await subscriptionManager.lastId()
      await testTokenWithPermit.connect(getExecutor()).mint(alice.address, amount)
      const [v, r, s] = await generatePermitSignature(
        subscriptionManager,
        testTokenWithPermit,
        alice,
        planId
      )
      const result = await executeGaslessTransaction(
        {
          transactionType: 'subscribe',
          arguments: [planId.toHexString(), alice.address, v, r, s],
        },
        {
          logger,
          requestId: hexlify(randomBytes(40)),
        }
      )
      expect(result.status).to.be.true
    })
  })
})
