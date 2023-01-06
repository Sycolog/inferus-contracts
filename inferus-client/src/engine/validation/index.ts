// run a series of validators to ensure the data provided is safe - to the extent to which we can determine
// validators to be implemented include:
// - address check: must match chain format
// - token check: token must exist on chain when specified
// - address platform check: validate that the platform that owns an address can receive the specified token - where applicable
// - duplicate check: token/chain/tag must be unique within the metadata

import { NameMetadata } from '../types'
import addressChecker from './validators/address-checker'
import tokenChecker from './validators/token-checker'
import duplicateChecker from './validators/duplicate-checker'
import { ValidationResult } from './types'

export async function validateNameMetadata(metadata: NameMetadata): Promise<ValidationResult> {
  const result: ValidationResult = {
    records: {},
  }

  addressChecker(metadata, result)
  await tokenChecker(metadata, result)
  duplicateChecker(metadata, result)

  return result
}
