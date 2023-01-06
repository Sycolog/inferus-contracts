/**
 * Converts a valid name to a standard form including only lowercase letters, numbers and underscore.
 * @param name
 */
export function normalizeName(name: string): string {
  if (name[0] === '@') {
    name = name.substring(1)
  }

  if (!/^\w{2,32}$/.test(name)) {
    throw Error(
      'Valid inferus names have a minimum of 2 and a maximum of 32 characters including letters, numbers, and underscore.'
    )
  }

  return name.toLowerCase()
}

export function isNormalized(name: string): boolean {
  return /^[a-z0-9_]{2,32}$/.test(name)
}

export function convertToPresentationForm(name: string): string {
  const namePart = name[0] === '@' ? name.substring(1) : name
  return `@${normalizeName(namePart)}`
}

export function isPresentationForm(name: string): boolean {
  return name[0] === '@' && isNormalized(name.substring(1))
}

const ipfsUriRegex =
  /ipfs:\/\/(?:Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[A-Za-z2-7]{58,}|B[A-Z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]{48,}|F[0-9A-F]{50,})/
export function validateIpfsUri(uri: string): boolean {
  return ipfsUriRegex.test(uri)
}
