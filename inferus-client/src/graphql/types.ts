export interface ResolveNameQueryResult {
  nameEntities: Array<{
    name: string
    metadataUri: string
    owner: {
      address: string
    }
  }>
}
export interface LinkedNamesQueryResult {
  nameOwnerEntity: {
    address: string
    names: Array<{
      name: string
    }>
  } | null
}
