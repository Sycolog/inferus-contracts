/* eslint-disable @typescript-eslint/no-unsafe-call */
import { expect } from 'chai'
import { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  arrayify,
  formatBytes32String,
  hexlify,
  parseEther,
  randomBytes,
  toUtf8Bytes,
  zeroPad,
} from 'ethers/lib/utils'
import { InferusNames, InferusNames__factory } from '../build/types'
const { getContractFactory, getSigners } = ethers

describe('InferusNames', () => {
  let inferusNames: InferusNames
  let admin: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let signers: SignerWithAddress[]
  const basePrice = parseEther('1')

  before(async () => {
    signers = await getSigners()
    admin = signers[0]
    alice = signers[1]
    bob = signers[2]
  })

  beforeEach(async () => {
    const inferusNamesFactory = (await getContractFactory(
      'InferusNames',
      admin,
    )) as InferusNames__factory
    inferusNames = await inferusNamesFactory.deploy()
    await inferusNames.deployed()
    await inferusNames.initialize(basePrice)
    inferusNames = inferusNames.connect(alice)
  })

  describe('Inferus Names', () => {
    it('inferus should be registered to the contract name', async () => {
      const name = formatBytes32String('inferus')
      expect(await inferusNames.names(name)).to.eq(inferusNames.address)
    })

    describe('register', () => {
      describe('validations', () => {
        it('should revert when name is 0', async () => {
          const name = zeroPad('0x', 32)
          const metadataUri = randomBytes(50)
          await expect(inferusNames.register(name, metadataUri)).to.be.revertedWith(
            'INVALID_NAME',
          )
        })

        it('should revert when name is taken', async () => {
          const name = randomBytes(32)
          const metadataUri = randomBytes(50)
          await inferusNames.connect(alice).register(name, metadataUri)
          await expect(
            inferusNames.connect(bob).register(name, metadataUri),
          ).to.be.revertedWith('NAME_NOT_AVAILABLE')
        })

        it('should revert when price is not paid', async () => {
          const name = randomBytes(32)
          const name2 = randomBytes(32)
          const metadataUri = randomBytes(50)
          const metadataUri2 = randomBytes(50)
          await inferusNames.connect(alice).register(name, metadataUri)
          await expect(
            inferusNames.connect(alice).register(name2, metadataUri2),
          ).to.be.revertedWith('REGISTRATION_FEES_REQUIRED')
        })
      })

      describe('effects', () => {
        it('should register name with metadata uri and emit event', async () => {
          const name = randomBytes(32)
          const metadataUri = randomBytes(50)
          const tx = inferusNames.connect(alice).register(name, metadataUri)
          await expect(tx)
            .to.emit(inferusNames, 'NameRegistered')
            .withArgs(alice.address, hexlify(name), hexlify(metadataUri))

          const nameOwner = await inferusNames.names(name)
          const storedMetadataUri = await inferusNames.metadataURIs(name)
          const newRegistrationPrice = await inferusNames.linkingPrices(alice.address)
          expect(nameOwner).to.eq(alice.address)
          expect(storedMetadataUri).to.eq(hexlify(metadataUri))
          expect(newRegistrationPrice).to.eq(basePrice)
        })

        it('should increment linking price by number of names owned', async () => {
          const name = randomBytes(32)
          const name2 = randomBytes(32)
          const metadataUri = randomBytes(50)
          const metadataUri2 = randomBytes(50)
          await inferusNames.connect(alice).register(name, metadataUri)
          await inferusNames.connect(alice).register(name2, metadataUri2, {
            value: await inferusNames.linkingPrices(alice.address),
          })

          const newRegistrationPrice = await inferusNames.linkingPrices(alice.address)
          expect(newRegistrationPrice).to.eq(basePrice.mul(2))
        })
      })
    })

    describe('registerBySignature', () => {
      describe('validations', () => {
        it('should revert when signature is invalid', async () => {
          const name = randomBytes(32)
          const metadataUri = randomBytes(50)
          const hash = await inferusNames.getHashForRegisterBySignature(
            name,
            alice.address,
            metadataUri,
          )
          const signature = await bob.signMessage(toUtf8Bytes(hash))
          await expect(
            inferusNames
              .connect(bob)
              .registerBySignature(name, alice.address, metadataUri, signature),
          ).to.be.revertedWith('INVALID_SIGNATURE')
        })
      })

      describe('effects', () => {
        it('should register name with metadata uri and emit event', async () => {
          const name = randomBytes(32)
          const metadataUri = randomBytes(50)
          const hash = await inferusNames.getHashForRegisterBySignature(
            name,
            alice.address,
            metadataUri,
          )
          const signature = await alice.signMessage(arrayify(hash))
          const tx = inferusNames
            .connect(bob)
            .registerBySignature(name, alice.address, metadataUri, signature)
          await expect(tx)
            .to.emit(inferusNames, 'NameRegistered')
            .withArgs(alice.address, hexlify(name), hexlify(metadataUri))

          const nameOwner = await inferusNames.names(name)
          const storedMetadataUri = await inferusNames.metadataURIs(name)
          const newRegistrationPrice = await inferusNames.linkingPrices(alice.address)
          expect(nameOwner).to.eq(alice.address)
          expect(storedMetadataUri).to.eq(hexlify(metadataUri))
          expect(newRegistrationPrice).to.eq(basePrice)
        })

        it('should increment linking price by number of names owned', async () => {
          const name = randomBytes(32)
          const name2 = randomBytes(32)
          const metadataUri = randomBytes(50)
          const metadataUri2 = randomBytes(50)
          const hash = await inferusNames.getHashForRegisterBySignature(
            name,
            alice.address,
            metadataUri,
          )
          const hash2 = await inferusNames.getHashForRegisterBySignature(
            name2,
            alice.address,
            metadataUri2,
          )
          const signature = await alice.signMessage(arrayify(hash))
          const signature2 = await alice.signMessage(arrayify(hash2))
          await inferusNames
            .connect(bob)
            .registerBySignature(name, alice.address, metadataUri, signature)
          await inferusNames
            .connect(bob)
            .registerBySignature(name2, alice.address, metadataUri2, signature2, {
              value: await inferusNames.linkingPrices(alice.address),
            })

          const newRegistrationPrice = await inferusNames.linkingPrices(alice.address)
          expect(newRegistrationPrice).to.eq(basePrice.mul(2))
        })
      })
    })
  })
})
