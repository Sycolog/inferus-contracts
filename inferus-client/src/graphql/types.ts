/* eslint-disable @typescript-eslint/no-empty-interface */
interface NameEntitiesResult {
  nameEntities: Array<{
    name: string
    metadataUri: string
    owner: string
  }>
}

export interface ResolveNameQueryResult extends NameEntitiesResult {}
export interface LinkedNamesQueryResult extends NameEntitiesResult {}
