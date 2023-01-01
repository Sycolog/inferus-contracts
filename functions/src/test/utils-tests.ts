/* eslint-disable no-unused-expressions,node/no-unpublished-import */
import { describe } from 'mocha'
import { expect } from 'chai'
import { hexStringValidator, isNumber } from '../utils'

describe('utils tests', () => {
  describe('isNumber', () => {
    it('should return false when the data is not a javascript number and is not a valid hex number', () => {
      const data = '0x123'
      const result = isNumber(data)
      expect(result).to.be.false
    })

    it('should return true when the data is a javascript number', () => {
      const data = 4
      const result = isNumber(data)
      expect(result).to.be.true
    })

    it('should return true when the data is a valid hex number', () => {
      const data = '0x1234'
      const result = isNumber(data)
      expect(result).to.be.true
    })

    it('should return true when the data is the trivial hex number', () => {
      const data = '0x'
      const result = isNumber(data)
      expect(result).to.be.true
    })
  })

  describe('hexStringValidator', () => {
    it('should return true when the data is a valid hex with the correct length of bytes', () => {
      const data = '0x6162636400000000000000000000000000000000000000000000000000000000'
      const validator = hexStringValidator(32)
      const result = validator(data)
      expect(result).to.be.true
    })

    it('should return false when the data is not a valid hex', () => {
      const data = '3k43'
      const validator = hexStringValidator(2)
      const result = validator(data)
      expect(result).to.be.false
    })

    it('should return false when the data a valid hex but has the wrong length', () => {
      const data = '0x123456'
      const validator = hexStringValidator(2)
      const result = validator(data)
      expect(result).to.be.false
    })
  })
})
