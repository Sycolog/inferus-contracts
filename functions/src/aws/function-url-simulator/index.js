/* eslint-disable node/no-unpublished-require,@typescript-eslint/no-var-requires,node/no-missing-require,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-misused-promises */
const express = require('express')
const {
  handler: executeGaslessTransactionsHandler,
} = require('../../../dist/execute-gasless-transactions')

const app = express()
app.use(express.raw({ type: '*/*' }))
const port = 3000

const eventBodyTemplate = {
  version: '2.0',
  routeKey: '$default',
  rawPath: '/',
  rawQueryString: '',
  cookies: [],
  headers: {},
  queryStringParameters: {},
  requestContext: {
    accountId: '123456789012',
    apiId: 'api-id',
    authentication: {
      clientCert: {
        clientCertPem: 'CERT_CONTENT',
        subjectDN: 'www.example.com',
        issuerDN: 'Example issuer',
        serialNumber: 'a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1',
        validity: {
          notBefore: 'May 28 12:30:02 2019 GMT',
          notAfter: 'Aug  5 09:36:04 2021 GMT',
        },
      },
    },
    authorizer: {
      jwt: {
        claims: {
          claim1: 'value1',
          claim2: 'value2',
        },
        scopes: ['scope1', 'scope2'],
      },
    },
    domainName: 'id.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'id',
    http: {
      method: 'POST',
      path: '/',
      protocol: 'HTTP/1.1',
      sourceIp: '192.168.0.1/32',
      userAgent: 'agent',
    },
    requestId: 'id',
    routeKey: '$default',
    stage: '$default',
    time: '12/Mar/2020:19:03:58 +0000',
    timeEpoch: 1583348638390,
  },
  body: '',
  pathParameters: {},
  isBase64Encoded: true,
  stageVariables: {},
}

app.post('/execute-gasless-transactions', async (req, res) => {
  const response = await executeGaslessTransactionsHandler({
    ...eventBodyTemplate,
    headers: req.headers,
    body: req.body.toString(),
  })
  res.status(response.statusCode).send(response.body)
})

app.listen(port, () => {
  console.log(`Lambda Simulator on port ${port}`)
})
