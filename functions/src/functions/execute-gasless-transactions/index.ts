/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment */
import { ApplicationError, hexStringValidator, isNumber, RequestContext } from '../../utils'
import {
  getExecutor,
  getProvider,
  parseTransactionData,
  TransactionDataPrimitive,
} from '../../utils/transactions'
import { BigNumber, Signer } from 'ethers'
import { formatEther, formatUnits, parseUnits } from 'ethers/lib/utils'
import axios from 'axios'

type TransactionType = 'register' | 'subscribe'

type ITransactionTypeSpecification = {
  [key in TransactionType]: {
    contractAddress: string
    signature: string
    parameters: Array<(s: any) => boolean>
  }
}

export interface ITransactionSpecification {
  transactionType: TransactionType
  arguments: TransactionDataPrimitive[]
}

export interface ITransactionResponse {
  status: boolean
  message: string
}

let transactionTypes: ITransactionTypeSpecification
function loadTransactionTypes(): ITransactionTypeSpecification {
  if (transactionTypes) {
    return transactionTypes
  }

  transactionTypes = {
    register: {
      contractAddress: process.env.NAMES_CONTRACT_ADDRESS!,
      signature:
        'registerBySignature(bytes32 _name,address _owner,bytes _metadataURI,bytes _signature)',
      parameters: [
        hexStringValidator(32),
        hexStringValidator(20),
        hexStringValidator(),
        hexStringValidator(),
      ],
    },
    subscribe: {
      contractAddress: process.env.SUBSCRIPTIONS_CONTRACT_ADDRESS!,
      signature:
        'subscribeWithPermit(uint256 _planId,address _subscriber,uint8 v,bytes32 r,bytes32 s)',
      parameters: [
        isNumber,
        hexStringValidator(20),
        isNumber,
        hexStringValidator(32),
        hexStringValidator(32),
      ],
    },
  }
  return transactionTypes
}

function validateTransactionType(type: string, context: RequestContext) {
  const validTypes = Object.keys(transactionTypes)
  if (!validTypes.includes(type)) {
    throw new ApplicationError({
      context,
      message: `executeGaslessTransaction:validateSpec:INVALID_TRANSACTION_TYPE:found ${type}:expected any of ${validTypes}`,
      errorCode: 'INVALID_TRANSACTION_TYPE',
      userFriendlyMessage: `Invalid transaction type: ${type}. Available options are: ${validTypes}`,
    })
  }
}

function validateTransactionArguments(spec: ITransactionSpecification, context: RequestContext) {
  const typeData = transactionTypes[spec.transactionType]
  if (!spec.arguments || spec.arguments.length !== typeData.parameters.length) {
    throw new ApplicationError({
      context,
      message: `executeGaslessTransaction:validateSpec:INCORRECT_ARGUMENT_COUNT:found ${spec.arguments?.length} but expected ${typeData.parameters.length}`,
      errorCode: 'INCORRECT_ARGUMENT_COUNT',
      userFriendlyMessage: `Incorrect argument count. Expected ${typeData.parameters.length}`,
    })
  }

  for (let i = 0; i < spec.arguments.length; i++) {
    const argument = spec.arguments[i]
    const validator = typeData.parameters[i]

    if (!validator(argument)) {
      throw new ApplicationError({
        context,
        message: `executeGaslessTransaction:validateSpec:INVALID_ARGUMENT:value at index ${i} does not match the transaction spec`,
        errorCode: 'INVALID_ARGUMENT',
        userFriendlyMessage: `Invalid argument at index ${i}`,
      })
    }
  }
}

function validateSpec(spec: ITransactionSpecification, context: RequestContext) {
  const type = spec.transactionType
  validateTransactionType(type, context)
  validateTransactionArguments(spec, context)
}

async function estimateGas(
  executor: Signer,
  spec: ITransactionSpecification,
  context: RequestContext
) {
  const typeData = transactionTypes[spec.transactionType]
  let gasEstimate: BigNumber
  const transaction = {
    to: typeData.contractAddress,
    data: parseTransactionData({
      signature: typeData.signature,
      arguments: spec.arguments,
    }),
  }
  try {
    gasEstimate = await executor.estimateGas(transaction)
    context.logger.info({
      msg: 'executeGaslessTransaction:gas estimation completed',
      estimate: `${formatEther(gasEstimate)} MATIC`,
      spec: spec,
      typeData: typeData,
    })
  } catch (e) {
    throw new ApplicationError({
      context,
      message: 'executeGaslessTransaction:gas estimation failed',
      userFriendlyMessage:
        'The transaction could not be executed. Check the parameters and try again.',
      data: {
        error: e,
        spec: spec,
        typeData: typeData,
      },
    })
  }

  return { gasEstimate, transaction }
}

async function loadGasPriceFromGasStationService() {
  const gasPriceResponse = await axios('https://gasstation-mainnet.matic.network/v2')
  const maxFee = gasPriceResponse.data?.standard?.maxFee
  const maxPriorityFee = gasPriceResponse.data?.standard?.maxPriorityFee
  if (!maxFee || !maxPriorityFee) {
    throw Error('Failed to load gas price from gas station service')
  }

  return {
    maxFeePerGas: parseUnits(Math.ceil(maxFee).toString(), 'gwei'),
    maxPriorityFeePerGas: parseUnits(Math.ceil(maxPriorityFee``).toString(), 'gwei'),
  }
}

// fallback for when we can't send transactions
async function loadGasPriceFromRecentBlockTransactions() {
  throw Error('Not implemented yet')
  const lastBlock = await getProvider().getBlock('latest')
  return {
    maxFeePerGas: lastBlock.baseFeePerGas!.mul(125).div(100),
    maxPriorityFeePerGas: lastBlock.baseFeePerGas!.mul(12).div(10),
  }
}

async function loadGasPrice() {
  try {
    return await loadGasPriceFromGasStationService()
  } catch (e) {
    return await loadGasPriceFromRecentBlockTransactions()
  }
}

export async function executeGaslessTransaction(
  spec: ITransactionSpecification,
  context: RequestContext
): Promise<ITransactionResponse> {
  context.logger.info(`executeGaslessTransaction:started`)
  loadTransactionTypes()
  validateSpec(spec, context)
  const executor = getExecutor()
  const { gasEstimate, transaction } = await estimateGas(executor, spec, context)
  context.logger.info(`executeGaslessTransaction:specValidatedSuccessfully`)

  const { maxFeePerGas, maxPriorityFeePerGas } = await loadGasPrice()
  for (let i = 0; i < 30; i++) {
    const nonce = await executor.getTransactionCount('pending')
    context.logger.info({
      msg: `Executing transaction from ${executor.address}`,
      nonce: nonce,
      maxFeePerGas: `${formatUnits(maxFeePerGas, 'gwei')} gwei`,
      maxPriorityFeePerGas: `${formatUnits(maxPriorityFeePerGas, 'gwei')} gwei`,
    })
    context.logger.trace(
      `executeGaslessTransaction:sending transaction to mempool. Nonce: ${nonce}`
    )
    try {
      const tx = await executor.sendTransaction({
        ...transaction,
        gasLimit: gasEstimate,
        nonce: nonce,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
      })
      context.logger.info(
        `executeGaslessTransaction:transaction sent to mempool. tx hash: ${tx.hash}`
      )
      return {
        status: true,
        message: 'Transaction queued successfully',
      }
    } catch (e) {
      context.logger.error({
        msg: 'executeGaslessTransaction:failed to send to mempool',
        error: e,
        nonce: nonce,
      })
    }
  }

  return {
    status: false,
    message: 'Failed to execute transaction. Please try again later.',
  }
}
