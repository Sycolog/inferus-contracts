import {ByteArray, Bytes} from "@graphprotocol/graph-ts";

export function concatenateBytes(bytes: ByteArray[]): Bytes {
    let totalLength = 0
    for (let i = 0; i < bytes.length; i++) {
        totalLength += bytes[i].length
    }
    const result = new Bytes(totalLength)
    let position = 0
    for (let i = 0; i < bytes.length; i++) {
        result.set(bytes[i], position)
        position += bytes[i].length
    }
    return result
}