import axios, { AxiosInstance } from 'axios'

let httpClient: AxiosInstance | undefined
export function getHttpClient(): AxiosInstance {
  if (!httpClient) {
    httpClient = axios.create({
      baseURL: process.env.COINMARKETCAP_BASE_URI,
      headers: {
        'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_KEY,
      },
    })
  }

  return httpClient
}
