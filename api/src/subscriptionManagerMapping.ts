import {Address, BigInt, Bytes, log} from "@graphprotocol/graph-ts"
import {
  SubscriberEntity, SubscriptionEntity,
  SubscriptionPlanEntity, WithdrawalEntity
} from "../generated/schema"
import {
  CreatePlan, CreateSubscription,
  TransferPlanOwnership,
  UpdatePlanProperties, Withdraw
} from "../generated/SubscriptionManager/SubscriptionManager";
import {concatenateBytes} from "./utils";

export function getSubscriptionId(subscriber: Address, planId: BigInt): Bytes {
  return concatenateBytes([subscriber, Bytes.fromBigInt(planId)])
}

export function handleCreatePlan(event: CreatePlan): void {
  const plan = new SubscriptionPlanEntity(event.params.id.toHex())
  plan.owner = event.params.owner
  plan.token = event.params.token
  plan.price = event.params.tokenAmount
  plan.duration = event.params.duration
  plan.active = event.params.status === 0
  plan.save()
}

export function handleUpdatePlanProperties(event: UpdatePlanProperties): void {
  const plan = SubscriptionPlanEntity.load(event.params.id.toHex())
  if (!plan) {
    log.error('Updated plan was not found in store: {}', [event.params.id.toHex()])
    return
  }
  plan.price = event.params.tokenAmount
  plan.duration = event.params.duration
  plan.active = event.params.status === 0
  plan.save()
}

export function handleTransferPlanOwnership(event: TransferPlanOwnership): void {
  const plan = SubscriptionPlanEntity.load(event.params.id.toHex())
  if (!plan) {
    log.error('Transferred plan was not found in store: {}', [event.params.id.toHex()])
    return
  }
  plan.owner = event.params.to
  plan.save()
}

export function handleCreateSubscription(event: CreateSubscription): void {
  const plan = SubscriptionPlanEntity.load(event.params.planId.toHex())
  if (!plan) {
    log.error('Subscribed plan was not found in store: {}', [event.params.planId.toHex()])
    return
  }

  let subscriber = SubscriberEntity.load(event.params.subscriber.toHex())
  if (!subscriber) {
    subscriber = new SubscriberEntity(event.params.subscriber.toHex())
    subscriber.address = event.params.subscriber
    subscriber.save()
  }

  const subscriptionId = getSubscriptionId(event.params.subscriber, event.params.planId)
  const subscription = new SubscriptionEntity(subscriptionId.toHex())
  subscription.plan = plan.id
  subscription.subscriber = subscriber.id
  subscription.expiry = event.params.expiry
  subscription.save()
}

export function handleWithdraw(event: Withdraw): void {
  const plan = SubscriptionPlanEntity.load(event.params.planId.toHex())
  if (!plan) {
    log.error('Subscribed plan was not found in store: {}', [event.params.planId.toHex()])
    return
  }

  const withdrawal = new WithdrawalEntity(event.transaction.hash.toHex())
  withdrawal.token = event.params.token
  withdrawal.amount = event.params.amount
  withdrawal.withdrawer = event.params.withdrawer
  withdrawal.receiver = event.params.withdrawnTo
  withdrawal.plan = plan.id
  withdrawal.save()
}