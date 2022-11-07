import * as QueryString from 'query-string'
import {
  Network,
  OpenSeaAPIConfig,
  Order,
} from 'opensea-js/lib/types'
import {
  delay,
  orderFromJSON,
} from 'opensea-js/lib/utils/utils'
import { Token, getSupportedCurrencyByAddrress, fetcher, API_NFT_URL } from './utils'
import { GameFiOrderJSON } from './types'

export class API {
  /**
   * Host url
   */
  public readonly hostUrl: string
  /**
   * Base url for the API
   */
  public readonly apiBaseUrl: string
  /**
   * Page size to use for fetching orders
   */
  public pageSize = 20
  /**
   * Logger function to use when debugging
   */
  public logger: (arg: string) => void

  private apiKey: string | undefined
  private networkName: Network
  private retryDelay = 3000

  constructor (config: OpenSeaAPIConfig, logger?: (arg: string) => void) {
    this.apiKey = config.apiKey
    this.networkName = config.networkName ?? Network.Main

    switch (config.networkName) {
    case Network.Rinkeby:
      this.apiBaseUrl = API_NFT_URL
      this.hostUrl = API_NFT_URL
      break
    case Network.Main:
    default:
      this.apiBaseUrl = API_NFT_URL
      this.hostUrl = API_NFT_URL
      break
    }

    // Debugging: default to nothing
    this.logger = logger || ((arg: string) => arg)
  }

  /**
   * Send an order to the orderbook.
   * Throws when the order is invalid.
   * IN NEXT VERSION: change order input to Order type
   * @param order Order JSON to post to the orderbook
   * @param retries Number of times to retry if the service is unavailable for any reason
   */
  public async postOrderLegacyWyvern (
    order: GameFiOrderJSON,
    retries = 2,
    network: string
  ): Promise<Order> {
    let json
    try {
      json = (await this.post(
        `/order/post/${network}/`,
        {
          ...order,
          paymentToken: order?.paymentToken
        }
      ))
    } catch (error) {
      _throwOrContinue(error, retries)
      await delay(3000)
      return this.postOrderLegacyWyvern(order, retries - 1, network)
    }
    return orderFromJSON(json.data)
  }

  public async getGameFiPaymentTokens (address: string, network: string): Promise<Token | undefined> {
    const allowedToken = await fetcher(`${API_NFT_URL}/accepted-token/get?network=${network}&${!!address && `address=${address.toLowerCase()}`}`).catch(e => console.log('failed to get payment token', e))

    const networkAlias = allowedToken?.data[0]?.network
    if (allowedToken?.data?.length > 0 && !!getSupportedCurrencyByAddrress(allowedToken?.data[0]?.address, networkAlias)) {
      return getSupportedCurrencyByAddrress(allowedToken?.data[0]?.address, networkAlias)
    }

    return undefined
  }

  /**
   * POST JSON data to API, sending auth token in headers
   * @param apiPath Path to URL endpoint under API
   * @param body Data to send. Will be JSON.stringified
   * @param opts RequestInit opts, similar to Fetch API. If it contains
   *  a body, it won't be stringified.
   */
  public async post<T> (
    apiPath: string,
    body?: Record<string, unknown>,
    opts: RequestInit = {}
  ): Promise<T> {
    const fetchOpts = {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      ...opts
    }

    const response = await this._fetch(apiPath, fetchOpts)
    return response.json()
  }

  /**
   * Get from an API Endpoint, sending auth token in headers
   * @param apiPath Path to URL endpoint under API
   * @param opts RequestInit opts, similar to Fetch API
   */
  private async _fetch (apiPath: string, opts: RequestInit = {}) {
    const apiBase = this.apiBaseUrl
    const apiKey = this.apiKey
    const finalUrl = apiBase + apiPath
    const finalOpts = {
      ...opts,
      headers: {
        ...(apiKey ? { 'X-API-KEY': apiKey } : {}),
        ...(opts.headers || {})
      }
    }

    this.logger(
      `Sending request: ${finalUrl} ${JSON.stringify(finalOpts).substr(
        0,
        100
      )}...`
    )

    return fetch(finalUrl, finalOpts).then(async (res) =>
      this._handleApiResponse(res)
    )
  }

  private async _handleApiResponse (response: Response) {
    if (response.ok) {
      this.logger(`Got success: ${response.status}`)
      return response
    }

    let result
    let errorMessage
    try {
      result = await response.text()
      result = JSON.parse(result)
    } catch {
      // Result will be undefined or text
    }

    this.logger(`Got error ${response.status}: ${JSON.stringify(result)}`)

    switch (response.status) {
    case 400:
      errorMessage =
          result && result.errors
            ? result.errors.join(', ')
            : `Invalid request: ${JSON.stringify(result)}`
      break
    case 401:
    case 403:
      errorMessage = `Unauthorized. Full message was '${JSON.stringify(
        result
      )}'`
      break
    case 404:
      errorMessage = `Not found. Full message was '${JSON.stringify(
        result
      )}'`
      break
    case 500:
      errorMessage = `Internal server error. Full message was ${JSON.stringify(
        result
      )}`
      break
    case 503:
      errorMessage = `Service unavailable. Full message was ${JSON.stringify(
        result
      )}`
      break
    default:
      errorMessage = `Message: ${JSON.stringify(result)}`
      break
    }

    throw new Error(`API Error ${response.status}: ${errorMessage}`)
  }
}

function _throwOrContinue (error: unknown, retries: number) {
  const isUnavailable =
    error instanceof Error &&
    !!error.message &&
    (error.message.includes('503') || error.message.includes('429'))

  if (retries <= 0 || !isUnavailable) {
    throw error
  }
}
