import {Address, Bytes, log} from "@graphprotocol/graph-ts"
import {
  NameRegistered,
  NameReleased,
  NameTransferCompleted,
  NameTransferInitiated,
} from "../generated/InferusNames/InferusNames"
import { NameEntity, NameOwnerEntity, NameTransferEntity } from "../generated/schema"

const validNameChars = 'abcdefghijklmnopqrstuvwxyz0123456789_'
function getTransferId(name: Bytes, from: Address, to: Address): Bytes {
  const idArray = new Bytes(name.length + from.length + to.length)
  idArray.set(name, 0)
  idArray.set(from, name.length)
  idArray.set(to, name.length + from.length)
  return idArray;
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

export function handleNameRegistered(event: NameRegistered): void {
  const name = String.UTF8.decode(event.params.name.buffer, true)
  if (!isNormalized(name)) {
    log.error('Skipping - Not normalized: {}', [name])
    return
  }

  let nameEntity = NameEntity.load(event.params.name.toHex())
  let nameOwnerEntity = NameOwnerEntity.load(event.params.registrant.toHex())

  if (!nameOwnerEntity) {
    // this is their first name
    nameOwnerEntity = new NameOwnerEntity(event.params.registrant.toHex())
    nameOwnerEntity.address = event.params.registrant
    log.info('Creating name owner: {}', [event.params.registrant.toHex()])
    nameOwnerEntity.save()
  }

  // if the name has not previously been registered
  if (!nameEntity) {
    nameEntity = new NameEntity(event.params.name.toHex())
  }

  nameEntity.name = name
  nameEntity.owner = nameOwnerEntity.id
  log.info('Creating name: {}', [name])
  nameEntity.save()
}

export function handleNameReleased(event: NameReleased): void {
  const name = String.UTF8.decode(event.params.name.buffer, true)
  if (!isNormalized(name)) {
    return
  }

  let nameEntity = NameEntity.load(event.params.name.toHex())!
  nameEntity.owner = null
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
  transferEntity.isCompleted = true
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
  transferEntity.name = String.UTF8.decode(event.params.name.buffer)
  transferEntity.from = event.params.from
  transferEntity.to = event.params.to
  transferEntity.isCompleted = false
  transferEntity.save()
}