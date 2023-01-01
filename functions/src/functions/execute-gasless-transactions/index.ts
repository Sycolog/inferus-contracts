import { hexStringValidator, isNumber, RequestContext } from '../../utils'
import {
  getExecutor,
  parseTransactionData,
  TransactionDataPrimitive,
} from '../../utils/transactions'
import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils'

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

function validateSpec(spec: ITransactionSpecification, context: RequestContext) {
  const type = spec.transactionType
  const validTypes = Object.keys(transactionTypes)
  if (!validTypes.includes(type)) {
    context.logger.error(
      `executeGaslessTransaction:validateSpec:invalid transaction type:found ${type}:expected any of ${validTypes}`
    )
    return {
      status: false,
      message: `Invalid transaction type: ${type}. Available options are: ${validTypes}`,
    }
  }

  const typeData = transactionTypes[type]
  if (!spec.arguments || spec.arguments.length !== typeData.parameters.length) {
    context.logger.error(
      `executeGaslessTransaction:validateSpec:incorrect parameter count:found ${spec.arguments?.length} but expected ${typeData.parameters.length}`
    )
    return {
      status: false,
      message: `Incorrect parameter count. Expected ${typeData.parameters.length}`,
    }
  }

  for (let i = 0; i < spec.arguments.length; i++) {
    const parameter = spec.arguments[i]
    const validator = typeData.parameters[i]

    if (!validator(parameter)) {
      context.logger.error(
        `executeGaslessTransaction:validateSpec:invalid parameter value at index ${i}`
      )
      return {
        status: false,
        message: `Invalid parameter value at index ${i}`,
      }
    }
  }
}

export async function executeGaslessTransaction(
  spec: ITransactionSpecification,
  context: RequestContext
): Promise<ITransactionResponse> {
  context.logger.info(`executeGaslessTransaction:started`)
  loadTransactionTypes()
  const validationErrorResponse = validateSpec(spec, context)

  if (validationErrorResponse) {
    return validationErrorResponse
  }

  context.logger.info(`executeGaslessTransaction:specValidatedSuccessfully`)
  const typeData = transactionTypes[spec.transactionType]
  const executor = getExecutor()
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
    context.logger.error({
      msg: 'executeGaslessTransaction:gas estimation failed',
      error: e,
      spec: spec,
      typeData: typeData,
    })
    return {
      status: false,
      message: 'The transaction could not be executed. Check the parameters and try again.',
    }
  }

  for (let i = 0; i < 30; i++) {
    const nonce = await executor.getTransactionCount('pending')
    try {
      context.logger.trace(
        `executeGaslessTransaction:sending transaction to mempool. Nonce: ${nonce}`
      )
      const tx = await executor.sendTransaction({
        ...transaction,
        gasLimit: gasEstimate,
        nonce: nonce,
      })
      await tx.wait()
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

  return Promise.resolve({
    status: false,
    message: 'Failed to execute transaction. Please try again later.',
  })
}
