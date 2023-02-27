import { gql } from 'graphql-request'

export const resolveNameQuery = gql`
  query resolveName($name: String!) {
    nameEntities(where: { name: $name }) {
      name
      metadataUri
      owner
    }
  }
`

export const getLinkedNamesQuery = gql`
  query getLinkedNames($address: ID!) {
    nameEntities(where: { owner: $address }) {
      name
      metadataUri
      owner
    }
  }
`
