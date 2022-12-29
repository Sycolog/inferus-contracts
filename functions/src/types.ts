export interface HTTP {
  method: string
  path: string
  protocol: string
  sourceIp: string
  userAgent: string
}

export interface RequestContext {
  accountId: string
  apiId: string
  domainName: string
  domainPrefix: string
  http: HTTP
  requestId: string
  routeKey: string
  stage: string
  time: string
  timeEpoch: number
}

export interface AWSLambdaHTTPEvent {
  version: string
  routeKey: string
  rawPath: string
  rawQueryString: string
  headers: Record<string, string>
  queryStringParameters: Record<string, string>
  requestContext: RequestContext
  body: string
  isBase64Encoded: boolean
}
