import {Address, Bytes, log} from "@graphprotocol/graph-ts"
import {
  MetadataUpdated,
  NameRegistered,
  NameReleased,
  NameTransferCompleted,
  NameTransferInitiated,
} from "../generated/InferusNames/InferusNames"
import {NameEntity, NameTransferEntity} from "../generated/schema"
import {concatenateBytes, getAggregates} from "./utils";

const validNameChars = 'abcdefghijklmnopqrstuvwxyz0123456789_'
function getTransferId(name: Bytes, from: Address, to: Address): Bytes {
  return concatenateBytes([name, from, to])
}

function isNormalized(name: string): boolean {
  if (name.length < 2 || name.length > 32) {
    log.error('Invalid length for {}: {}', [name, name.length.toString()])
    return false
  }

  for (let i = 0; i < name.length; i++) {
    if (!validNameChars.includes(name.charAt(i))) {
      log.error('{} has an invalid character: {} at position {}', [name, name.charAt(i), i.toString()])
      return false
    }
  }

  log.info('{} is normalized', [name])
  return true
}

function isValidIpfsUri(uri: string): boolean {
  return !!uri.startsWith('ipfs://')
}

export function handleNameRegistered(event: NameRegistered): void {
  const name = String.UTF8.decode(event.params.name.buffer, true)
  if (!isNormalized(name)) {
    log.error('Skipping - Not normalized: {}', [name])
    return
  }

  const metadataURI = String.UTF8.decode(event.params.metadataURI.buffer, true)
  if (!isValidIpfsUri(metadataURI))
  {
    log.warning('Skipping - Invalid metadata: {}', [metadataURI])
    return
  }

  let nameEntity = NameEntity.load(event.params.name.toHex())
  // if the name has not previously been registered
  if (!nameEntity) {
    nameEntity = new NameEntity(event.params.name.toHex())
  }

  nameEntity.name = name
  nameEntity.owner = event.params.registrant
  nameEntity.metadataUri = metadataURI
  log.info('Creating name: {}', [name])

  const aggregates = getAggregates()
  aggregates.namesRegistered += 1

  nameEntity.save()
  aggregates.save()
}

export function handleNameReleased(event: NameReleased): void {
  const name = String.UTF8.decode(event.params.name.buffer, true)
  if (!isNormalized(name)) {
    return
  }

  let nameEntity = NameEntity.load(event.params.name.toHex())!
  const aggregates = getAggregates()

  nameEntity.owner = null
  aggregates.namesRegistered -= 1

  nameEntity.save()
  aggregates.save()
}

export function handleMetadataUpdated(event: MetadataUpdated): void {
  const name = String.UTF8.decode(event.params.name.buffer, true)
  if (!isNormalized(name)) {
    return
  }
  const metadataURI = String.UTF8.decode(event.params.metadataURI.buffer, true)
  if (!isValidIpfsUri(metadataURI))
  {
    log.error('Skipping - Invalid metadata: {}', [event.params.metadataURI.toHex()])
    return
  }

  let nameEntity = NameEntity.load(event.params.name.toHex())!
  nameEntity.metadataUri = metadataURI
  nameEntity.save()
}

export function handleNameTransferCompleted(
  event: NameTransferCompleted
): void {
  const name = String.UTF8.decode(event.params.name.buffer, true)
  if (!isNormalized(name)) {
    return
  }

  let transferEntity = NameTransferEntity.load(getTransferId(event.params.name, event.params.from, event.params.to).toHex())!
  let nameEntity = NameEntity.load(event.params.name.toHex())

  if (!nameEntity) {
    log.error('Name entity not found for transfer entity for name {}', [name])
    return;
  }


  nameEntity.owner = event.params.to
  transferEntity.isCompleted = true
  log.info('Transfer of name \'@{}\' from {} to {} is completed', [name, event.params.from.toHex(), event.params.to.toHex()])

  nameEntity.save()
  transferEntity.save()
}

export function handleNameTransferInitiated(
  event: NameTransferInitiated
): void {
  const name = String.UTF8.decode(event.params.name.buffer, true)
  if (!isNormalized(name)) {
    return
  }

  let transferEntity = new NameTransferEntity(getTransferId(event.params.name, event.params.from, event.params.to).toHex())
  transferEntity.name = name
  transferEntity.from = event.params.from
  transferEntity.to = event.params.to
  transferEntity.isCompleted = false
  transferEntity.save()
}