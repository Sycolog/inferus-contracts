/* eslint-disable @typescript-eslint/no-unsafe-call */
import { expect } from 'chai'
import { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { parseEther } from 'ethers/lib/utils'
import {
  SubscriptionManager,
  SubscriptionManager__factory,
  TestTokenWithPermit,
  TestTokenWithPermit__factory,
} from '../build/types'
import { addTime, generatePermitSignature } from '../utils'

const { getContractFactory, getSigners } = ethers

describe('SubscriptionManager', () => {
  let subscriptionManager: SubscriptionManager
  let testTokenWithPermit: TestTokenWithPermit
  let admin: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let signers: SignerWithAddress[]
  let tokenAddress: string

  before(async () => {
    signers = await getSigners()
    admin = signers[0]
    alice = signers[1]
    bob = signers[2]
    tokenAddress = signers[11].address
  })

  beforeEach(async () => {
    const subscriptionManagerFactory = (await getContractFactory(
      'SubscriptionManager',
      admin,
    )) as SubscriptionManager__factory
    const testTokenWithPermitFactory = (await getContractFactory(
      'TestTokenWithPermit',
      admin,
    )) as TestTokenWithPermit__factory
    subscriptionManager = await subscriptionManagerFactory.deploy()
    await subscriptionManager.deployed()
    testTokenWithPermit = await testTokenWithPermitFactory.deploy()
    await testTokenWithPermit.deployed()
    await subscriptionManager.initialize()
    await testTokenWithPermit.initialize()
    subscriptionManager = subscriptionManager.connect(alice)
    testTokenWithPermit = testTokenWithPermit.connect(alice)
  })

  describe('Plan Management', () => {
    describe('createPlan', () => {
      describe('validations', () => {
        it('should revert when duration is zero', async () => {
          await expect(
            subscriptionManager.createPlan(0, tokenAddress, parseEther('0.5'), false),
          ).to.be.revertedWith('INVALID_DURATION')
        })
        it('should revert when token is the zero address', async () => {
          await expect(
            subscriptionManager.createPlan(
              5,
              ethers.constants.AddressZero,
              parseEther('0.5'),
              false,
            ),
          ).to.be.revertedWith('INVALID_TOKEN')
        })
      })

      describe('effects', () => {
        it('should create a new plan with correct data and emit event', async () => {
          const amount = parseEther('0.8')
          const duration = 60
          const expectedId = (await subscriptionManager.lastId()).add(1)

          const tx = subscriptionManager.createPlan(duration, tokenAddress, amount, false)
          await expect(tx)
            .to.emit(subscriptionManager, 'CreatePlan')
            .withArgs(expectedId, alice.address, tokenAddress, amount, duration, 1)

          const storedPlan = await subscriptionManager.plans(expectedId)
          expect(storedPlan.id).to.eq(expectedId)
          expect(storedPlan.duration).to.eq(duration)
          expect(storedPlan.token).to.eq(tokenAddress)
          expect(storedPlan.tokenAmount).to.eq(amount)
          expect(storedPlan.status).to.eq(1)
        })

        it('should activate plan during creation when specified', async () => {
          const amount = parseEther('0.8')
          const duration = 60
          const expectedId = (await subscriptionManager.lastId()).add(1)

          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const storedPlan = await subscriptionManager.plans(expectedId)
          expect(storedPlan.status).to.eq(0)
        })

        it('should not activate plan when _activate is false', async () => {
          const amount = parseEther('0.8')
          const duration = 60
          const expectedId = (await subscriptionManager.lastId()).add(1)

          await subscriptionManager.createPlan(duration, tokenAddress, amount, false)
          const storedPlan = await subscriptionManager.plans(expectedId)
          expect(storedPlan.status).to.eq(1)
        })

        it('should update lastId', async () => {
          const previousId = await subscriptionManager.lastId()
          const amount = parseEther('0.8')
          const duration = 60

          await subscriptionManager.createPlan(duration, tokenAddress, amount, false)

          const currentId = await subscriptionManager.lastId()
          expect(currentId).to.eq(previousId.add(1))
        })
      })
    })

    describe('updatePlanProperties', () => {
      const amount = parseEther('0.8')
      const duration = 60

      describe('validations', () => {
        it('should revert when duration is zero', async () => {
          const createDuration = 60
          const updateDuration = 0

          await subscriptionManager
            .connect(alice)
            .createPlan(createDuration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()
          await expect(
            subscriptionManager
              .connect(alice)
              .updatePlanProperties(planId, updateDuration, amount, 1),
          ).to.be.revertedWith('INVALID_DURATION')
        })

        it('should revert when called on a plan that does not exist', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()
          await expect(
            subscriptionManager.updatePlanProperties(planId.add(1), duration, amount, 1),
          ).to.be.revertedWith('INVALID_PLAN')
        })

        it('should revert when called on a deactivated plan', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()
          // deactivate the plan
          await subscriptionManager.updatePlanProperties(planId, duration, amount, 2)

          await expect(
            subscriptionManager.updatePlanProperties(planId, duration, amount, 1),
          ).to.be.revertedWith('INVALID_PLAN')
        })

        it('should revert when called by a random user [permissions]', async () => {
          await subscriptionManager
            .connect(alice)
            .createPlan(duration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()
          await expect(
            subscriptionManager
              .connect(bob)
              .updatePlanProperties(planId, duration, amount, 1),
          ).to.be.revertedWith('UNAUTHORIZED')
        })
      })

      describe('effects', () => {
        it('should update the plan properties with correct data and emit event', async () => {
          const updatedAmount = parseEther('1.5')
          const updatedDuration = 30
          const updatedStatus = 1

          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          const tx = subscriptionManager.updatePlanProperties(
            planId,
            updatedDuration,
            updatedAmount,
            updatedStatus,
          )
          await expect(tx)
            .to.emit(subscriptionManager, 'UpdatePlanProperties')
            .withArgs(
              planId,
              alice.address,
              updatedAmount,
              updatedDuration,
              updatedStatus,
            )

          const storedPlan = await subscriptionManager.plans(planId)
          expect(storedPlan.id).to.eq(planId)
          expect(storedPlan.duration).to.eq(updatedDuration)
          expect(storedPlan.token).to.eq(tokenAddress)
          expect(storedPlan.tokenAmount).to.eq(updatedAmount)
          expect(storedPlan.status).to.eq(updatedStatus)
        })
      })
    })

    describe('transferPlanOwnership', () => {
      const amount = parseEther('0.8')
      const duration = 60
      let receiverAddress = ethers.constants.AddressZero

      before(() => {
        receiverAddress = bob.address
      })

      describe('validations', () => {
        it('should revert when the receiver is the zero address', async () => {
          const receiverAddress = ethers.constants.AddressZero

          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          await expect(
            subscriptionManager.transferPlanOwnership(planId, receiverAddress),
          ).to.be.revertedWith('INVALID_ADDRESS')
        })

        it('should revert when called on a plan that does not exist', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()
          await expect(
            subscriptionManager.transferPlanOwnership(planId.add(1), receiverAddress),
          ).to.be.revertedWith('INVALID_PLAN')
        })

        it('should revert when called on a deactivated plan', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()
          // deactivate the plan
          await subscriptionManager.updatePlanProperties(planId, duration, amount, 2)

          await expect(
            subscriptionManager.transferPlanOwnership(planId, receiverAddress),
          ).to.be.revertedWith('INVALID_PLAN')
        })

        it('should revert when called by a random user [permissions]', async () => {
          await subscriptionManager
            .connect(alice)
            .createPlan(duration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()
          await expect(
            subscriptionManager
              .connect(bob)
              .transferPlanOwnership(planId, receiverAddress),
          ).to.be.revertedWith('UNAUTHORIZED')
        })
      })

      describe('effects', () => {
        it('should change the plan owner and emit event', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()

          const tx = subscriptionManager.transferPlanOwnership(planId, receiverAddress)
          await expect(tx)
            .to.emit(subscriptionManager, 'TransferPlanOwnership')
            .withArgs(planId, alice.address, receiverAddress)

          const storedPlan = await subscriptionManager.plans(planId)
          expect(storedPlan.owner).to.eq(receiverAddress)
        })
      })
    })
  })

  describe('Subscriptions', () => {
    describe('subscribe - with token', () => {
      const amount = parseEther('0.8')
      const duration = 60

      beforeEach(() => {
        tokenAddress = testTokenWithPermit.address
      })

      describe('validations', () => {
        it('should revert when called on a plan that does not exist', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()
          await expect(subscriptionManager.subscribe(planId.add(1))).to.be.revertedWith(
            'INVALID_PLAN',
          )
        })

        it('should revert when called on a deactivated plan', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          // deactivate the plan
          await subscriptionManager.updatePlanProperties(planId, duration, amount, 2)

          await expect(subscriptionManager.subscribe(planId)).to.be.revertedWith(
            'INVALID_PLAN',
          )
        })

        it('should revert when called on a paused plan', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          // pause the plan
          await subscriptionManager.updatePlanProperties(planId, duration, amount, 1)

          await expect(subscriptionManager.subscribe(planId)).to.be.revertedWith(
            'INACTIVE_PLAN',
          )
        })

        it('should revert when token has not been approved', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          await expect(subscriptionManager.subscribe(planId)).to.be.revertedWith(
            'ERC20: insufficient allowance',
          )
        })
      })

      describe('effects', () => {
        it('should subscribe the user for the plan duration', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          const subscriptionId = planId.add(1)
          await testTokenWithPermit.connect(admin).mint(alice.address, amount)
          await testTokenWithPermit
            .connect(alice)
            .approve(subscriptionManager.address, amount)
          const tx = subscriptionManager.connect(alice).subscribe(planId)
          await expect(tx)
            .to.emit(subscriptionManager, 'CreateSubscription')
            .withArgs(planId, subscriptionId, alice.address, alice.address)

          const subscription = await subscriptionManager.subscriptions(
            alice.address,
            planId,
          )
          expect(subscription.id).to.eq(subscriptionId)
          expect(subscription.planId).to.eq(planId)
          expect(subscription.expiry.sub(subscription.subscribedOn)).to.eq(duration)
          expect(subscription.subscriber).to.eq(alice.address)
        })

        it('should increase the subscription expiry by the plan duration when already subscribed', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          const subscriptionId = planId.add(2) // 2 because it's the second subscription after creating the plan and no other transaction is sent
          await testTokenWithPermit.connect(admin).mint(alice.address, amount.mul(2))
          await testTokenWithPermit
            .connect(alice)
            .approve(subscriptionManager.address, amount.mul(2))
          await subscriptionManager.connect(alice).subscribe(planId)
          const tx = subscriptionManager.connect(alice).subscribe(planId)
          await expect(tx)
            .to.emit(subscriptionManager, 'CreateSubscription')
            .withArgs(planId, subscriptionId, alice.address, alice.address)

          const subscription = await subscriptionManager.subscriptions(
            alice.address,
            planId,
          )
          const totalDuration = subscription.expiry.sub(subscription.subscribedOn)
          expect(subscription.id).to.eq(subscriptionId)
          expect(subscription.planId).to.eq(planId)
          expect(totalDuration)
            .to.lte(duration * 2)
            .and.to.gte(duration * 2 - 1)
          expect(subscription.subscriber).to.eq(alice.address)
        })

        it('should set the subscription to original plan duration if it has already expired', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          const subscriptionId = planId.add(2) // 2 because it's the second subscription after creating the plan and no other transaction is sent
          await testTokenWithPermit.connect(admin).mint(alice.address, amount.mul(2))
          await testTokenWithPermit
            .connect(alice)
            .approve(subscriptionManager.address, amount.mul(2))
          await subscriptionManager.connect(alice).subscribe(planId)
          await addTime(subscriptionManager.provider, duration + 1)

          const tx = subscriptionManager.connect(alice).subscribe(planId)
          await expect(tx)
            .to.emit(subscriptionManager, 'CreateSubscription')
            .withArgs(planId, subscriptionId, alice.address, alice.address)

          const subscription = await subscriptionManager.subscriptions(
            alice.address,
            planId,
          )
          expect(subscription.id).to.eq(subscriptionId)
          expect(subscription.planId).to.eq(planId)
          expect(subscription.expiry.sub(subscription.subscribedOn)).to.eq(duration)
          expect(subscription.subscriber).to.eq(alice.address)
        })
      })
    })

    describe('subscribe - with eth', () => {
      const amount = parseEther('0.8')
      const duration = 60

      beforeEach(async () => {
        tokenAddress = await subscriptionManager.COIN_ADDRESS()
      })

      describe('validations', () => {
        it('should revert when called on a plan that does not exist', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()
          await expect(subscriptionManager.subscribe(planId.add(1))).to.be.revertedWith(
            'INVALID_PLAN',
          )
        })

        it('should revert when called on a deactivated plan', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          // deactivate the plan
          await subscriptionManager.updatePlanProperties(planId, duration, amount, 2)

          await expect(subscriptionManager.subscribe(planId)).to.be.revertedWith(
            'INVALID_PLAN',
          )
        })

        it('should revert when called on a paused plan', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          // pause the plan
          await subscriptionManager.updatePlanProperties(planId, duration, amount, 1)

          await expect(subscriptionManager.subscribe(planId)).to.be.revertedWith(
            'INACTIVE_PLAN',
          )
        })

        it('should revert when token has not been approved', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          await expect(subscriptionManager.subscribe(planId)).to.be.revertedWith(
            'INCORRECT_AMOUNT_PAID',
          )
        })
      })

      describe('effects', () => {
        it('should subscribe the user for the plan duration', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          const subscriptionId = planId.add(1)
          const tx = subscriptionManager.connect(alice).subscribe(planId, {
            value: amount,
          })
          await expect(tx)
            .to.emit(subscriptionManager, 'CreateSubscription')
            .withArgs(planId, subscriptionId, alice.address, alice.address)

          const subscription = await subscriptionManager.subscriptions(
            alice.address,
            planId,
          )
          expect(subscription.id).to.eq(subscriptionId)
          expect(subscription.planId).to.eq(planId)
          expect(subscription.expiry.sub(subscription.subscribedOn)).to.eq(duration)
          expect(subscription.subscriber).to.eq(alice.address)
        })
      })
    })

    describe('subscribeWithPermit', () => {
      const amount = parseEther('0.8')
      const duration = 60

      beforeEach(() => {
        tokenAddress = testTokenWithPermit.address
      })

      describe('validations', () => {
        it('should revert when called on a plan that does not exist', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, false)
          const planId = await subscriptionManager.lastId()
          const [v, r, s] = await generatePermitSignature(
            subscriptionManager,
            testTokenWithPermit,
            alice,
            planId,
          )
          await expect(
            subscriptionManager
              .connect(bob)
              .subscribeWithPermit(planId.add(1), alice.address, v, r, s),
          ).to.be.revertedWith('INVALID_PLAN')
        })

        it('should revert when called on a deactivated plan', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()

          const [v, r, s] = await generatePermitSignature(
            subscriptionManager,
            testTokenWithPermit,
            alice,
            planId,
          )

          // deactivate the plan
          await subscriptionManager.updatePlanProperties(planId, duration, amount, 2)

          await expect(
            subscriptionManager
              .connect(bob)
              .subscribeWithPermit(planId, alice.address, v, r, s),
          ).to.be.revertedWith('INVALID_PLAN')
        })

        it('should revert when called on a paused plan', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          // pause the plan
          await subscriptionManager.updatePlanProperties(planId, duration, amount, 1)

          const [v, r, s] = await generatePermitSignature(
            subscriptionManager,
            testTokenWithPermit,
            alice,
            planId,
          )
          await expect(
            subscriptionManager
              .connect(bob)
              .subscribeWithPermit(planId, alice.address, v, r, s),
          ).to.be.revertedWith('INACTIVE_PLAN')
        })
      })

      describe('effects', () => {
        it('should subscribe the user for the plan duration', async () => {
          await subscriptionManager.createPlan(duration, tokenAddress, amount, true)
          const planId = await subscriptionManager.lastId()
          const subscriptionId = planId.add(1)
          await testTokenWithPermit.connect(admin).mint(alice.address, amount)
          const [v, r, s] = await generatePermitSignature(
            subscriptionManager,
            testTokenWithPermit,
            alice,
            planId,
          )

          const tx = subscriptionManager
            .connect(bob)
            .subscribeWithPermit(planId, alice.address, v, r, s)
          await expect(tx)
            .to.emit(subscriptionManager, 'CreateSubscription')
            .withArgs(planId, subscriptionId, alice.address, bob.address)

          const subscription = await subscriptionManager.subscriptions(
            alice.address,
            planId,
          )
          expect(subscription.id).to.eq(subscriptionId)
          expect(subscription.planId).to.eq(planId)
          expect(subscription.expiry.sub(subscription.subscribedOn)).to.eq(duration)
          expect(subscription.subscriber).to.eq(alice.address)
        })
      })
    })
  })
})
