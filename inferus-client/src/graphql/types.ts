export interface ResolveNameQueryResult {
  nameEntities: Array<{
    name: string
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
