import { NameMetadata } from '../../types'
import { ValidationResult } from '../types'

export default function validate(metadata: NameMetadata, result: ValidationResult) {
  const mappings = new Set<string>()
  for (const chainCode of Object.keys(metadata.paymentLink.chains)) {
    const chainData = metadata.paymentLink.chains[chainCode]

    // Special token codes: `coin` for coins, `*` for wildcard
    for (const tokenCode of Object.keys(chainData.tokens)) {
      const tokenData = chainData.tokens[tokenCode]
      for (const mapping of tokenData) {
        const hash = `${mapping.address}@${mapping.tag}`
        const path = `paymentLink.chains:${chainCode}.tokens:${tokenCode}.${mapping.address}@${mapping.tag}`
        if (!mapping.tag || mappings.has(hash)) {
          if (!result.records[path]) {
            result.records[path] = []
          }
          result.records[path].push({
            validator: 'duplicate-checker',
            type: 'error',
            message: mapping.tag
              ? `A mapping matching ${hash} was found`
              : "All tags must be specified. Use '*' for wildcards (default).",
          })
        }
      }
    }
  }
}
