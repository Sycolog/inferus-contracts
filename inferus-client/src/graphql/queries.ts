import { gql } from 'graphql-request'

export const resolveNameQuery = gql`
  query resolveName($name: String!) {
    nameEntities(where: { name: $name }) {
      name
      owner {
        address
      }
    }
  }
`

export const getLinkedNamesQuery = gql`
  query getLinkedNames($address: ID!) {
    nameOwnerEntity(id: $address) {
      address
      names {
        name
      }
    }
  }
`
