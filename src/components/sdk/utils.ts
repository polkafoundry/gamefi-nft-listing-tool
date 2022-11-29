/* eslint-disable @typescript-eslint/no-explicit-any */
// /* eslint-disable @typescript-eslint/await-thenable */

import { ECSignature, Order, OrderJSON } from 'opensea-js/lib/types'
import { GameFiOrderJSON, GameFiOrderWithSignature } from './types'
import { BigNumber } from '@0x/utils'
import { NULL_ADDRESS } from 'opensea-js/lib/constants'
import { assetBundleFromJSON, estimateCurrentPrice } from 'opensea-js/lib/utils/utils'
import { ethers } from 'ethers'
import Web3 from 'web3'
import * as ethUtil from "ethereumjs-util"
import * as _ from "lodash"
/**
 * Convert an order to JSON, hashing it as well if necessary
 * @param order order (hashed or unhashed)
 */

export const gamefiOrderToJSON = (order: GameFiOrderWithSignature): GameFiOrderJSON => {
  const asJSON: GameFiOrderJSON = {
    exchange: order.exchange.toLowerCase(),
    hash: order.hash,
    maker: order.maker.toLowerCase(),
    taker: order.taker.toLowerCase(),
    makerRelayerFee: order.makerRelayerFee.toString(),
    takerRelayerFee: order.takerRelayerFee.toString(),
    makerProtocolFee: order.makerProtocolFee.toString(),
    takerProtocolFee: order.takerProtocolFee.toString(),
    makerReferrerFee: order.makerReferrerFee.toString(),
    feeMethod: order.feeMethod,
    feeRecipient: order.feeRecipient.toLowerCase(),
    side: order.side,
    saleKind: order.saleKind,
    target: order.target.toLowerCase(),
    howToCall: order.howToCall,
    calldata: order.calldata,
    replacementPattern: order.replacementPattern,
    staticTarget: order.staticTarget.toLowerCase(),
    staticExtradata: order.staticExtradata,
    paymentToken: order.paymentToken.toLowerCase(),
    quantity: order.quantity.toString(),
    basePrice: order.basePrice.toString(),
    englishAuctionReservePrice: order.englishAuctionReservePrice
      ? order.englishAuctionReservePrice.toString()
      : undefined,
    extra: order.extra.toString(),
    createdTime: order.createdTime ? order.createdTime.toString() : undefined,
    listingTime: order.listingTime.toString(),
    expirationTime: order.expirationTime.toString(),
    salt: order.salt.toString(),

    metadata: order.metadata,

    v: order.v,
    r: order.r,
    s: order.s,

    nonce: order.nonce
  }
  return asJSON
}

export const gamefiSnakeOrderToJSON = (order: any): GameFiOrderJSON => {
  const asJSON: GameFiOrderJSON = {
    exchange: order.exchange?.toLowerCase(),
    maker: order.maker?.toLowerCase(),
    taker: order.taker?.toLowerCase(),
    makerRelayerFee: order.maker_relayer_fee?.toString(),
    takerRelayerFee: order.taker_relayer_fee?.toString(),
    makerProtocolFee: order.maker_protocol_fee?.toString(),
    takerProtocolFee: order.taker_protocol_fee?.toString(),
    makerReferrerFee: order.maker_referrer_fee?.toString(),
    feeMethod: order.fee_method,
    feeRecipient: order.fee_recipient?.toLowerCase(),
    side: order.side,
    saleKind: order.sale_kind,
    target: order.target?.toLowerCase(),
    howToCall: order.how_to_call,
    calldata: order.call_data,
    replacementPattern: order.replacement_pattern,
    staticTarget: order.static_target?.toLowerCase(),
    staticExtradata: order.static_extradata,
    paymentToken: order.payment_token?.toLowerCase(),
    quantity: order.quantity?.toString(),
    basePrice: order.base_price?.toString(),
    englishAuctionReservePrice: order.english_auction_reserve_price
      ? order.english_auction_reserve_price?.toString()
      : undefined,
    extra: order.extra?.toString(),
    createdTime: order.created_time ? order.created_time?.toString() : undefined,
    listingTime: order.listing_time?.toString(),
    expirationTime: order.expiration_time?.toString(),
    salt: order.salt?.toString(),

    metadata: order.metadata,

    v: order.v,
    r: order.r,
    s: order.s,

    nonce: order.nonce
  }
  return asJSON
}

export const gamefiResponseToOrderJSON = (order: any): OrderJSON => {
  console.log('vvvv', order.taker_relayer_fee)
  const json: OrderJSON = {
    exchange: order.exchange.toLowerCase(),
    maker: order.maker.toLowerCase(),
    taker: order.taker.toLowerCase(),
    makerRelayerFee: order.maker_relayer_fee,
    takerRelayerFee: order.taker_relayer_fee,
    makerProtocolFee: order.maker_protocol_fee,
    takerProtocolFee: order.taker_protocol_fee,
    makerReferrerFee: order.maker_referrer_fee,
    feeMethod: order.fee_method,
    feeRecipient: order.fee_recipient.toLowerCase(),
    side: order.side,
    saleKind: order.sale_kind,
    target: order.target.toLowerCase(),
    howToCall: order.how_to_call,
    calldata: order.calldata,
    replacementPattern: order.replacement_pattern,
    staticTarget: order.static_target.toLowerCase(),
    staticExtradata: order.static_extradata,
    paymentToken: order.payment_token.toLowerCase(),
    quantity: order.quantity.toString(),
    basePrice: order.base_price.toString(),
    englishAuctionReservePrice: order.english_auction_reserve_price
      ? order.english_auction_reserve_price.toString()
      : undefined,
    extra: order.extra.toString(),
    createdTime: order.created_time ? order.created_time.toString() : undefined,
    listingTime: order.listing_time.toString(),
    expirationTime: order.expiration_time.toString(),
    salt: order.salt.toString(),

    metadata: order.metadata,

    v: order.v,
    r: order.r,
    s: order.s,

    nonce: order.nonce
  }

  json.takerRelayerFee = order.taker_relayer_fee

  console.log('asJSON', JSON.stringify(json))
  return json
}

export const orderFromGameFiResponse = (order: any): Order => {
  const createdDate = new Date(`${order.created_at}Z`)

  const fromJSON: Order = {
    hash: order.order_hash || order.hash,
    cancelledOrFinalized: order.cancelled || order.finalized,
    markedInvalid: order.marked_invalid,
    metadata: order.metadata,
    quantity: new BigNumber(order.quantity || 1),
    exchange: order.exchange,
    makerAccount: order.maker,
    takerAccount: order.taker,
    // Use string address to conform to Wyvern Order schema
    maker: order.maker.address,
    taker: order.taker.address,
    makerRelayerFee: new BigNumber(order.maker_relayer_fee),
    takerRelayerFee: new BigNumber(order.taker_relayer_fee),
    makerProtocolFee: new BigNumber(order.maker_protocol_fee),
    takerProtocolFee: new BigNumber(order.taker_protocol_fee),
    makerReferrerFee: new BigNumber(order.maker_referrer_fee || 0),
    waitingForBestCounterOrder: order.fee_recipient.address === NULL_ADDRESS,
    feeMethod: order.fee_method,
    feeRecipientAccount: order.fee_recipient,
    feeRecipient: order.fee_recipient.address,
    side: order.side,
    saleKind: order.sale_kind,
    target: order.target,
    howToCall: order.how_to_call,
    calldata: order.calldata,
    replacementPattern: order.replacement_pattern,
    staticTarget: order.static_target,
    staticExtradata: order.static_extradata,
    paymentToken: order.payment_token,
    basePrice: new BigNumber(order.base_price),
    extra: new BigNumber(order.extra),
    currentBounty: new BigNumber(order.current_bounty || 0),
    currentPrice: new BigNumber(order.current_price || 0),

    createdTime: new BigNumber(Math.round(createdDate.getTime() / 1000)),
    listingTime: new BigNumber(order.listing_time),
    expirationTime: new BigNumber(order.expiration_time),

    salt: new BigNumber(order.salt),
    v: parseInt(order.v),
    r: order.r,
    s: order.s,

    paymentTokenContract: order.payment_token,
    asset: order.asset || undefined,
    assetBundle: order.asset_bundle
      ? assetBundleFromJSON(order.asset_bundle)
      : undefined
  }

  // Use client-side price calc, to account for buyer fee (not added by server) and latency
  fromJSON.currentPrice = estimateCurrentPrice(fromJSON)

  return fromJSON
}

export type Token = {
  name: string;
  symbol: string;
  decimals: number;
  address?: string;
  image: string;
}

export const ETH: Token = {
  name: 'Ether',
  symbol: 'ETH',
  decimals: 18,
  image: ''
}

export const MATIC: Token = {
  name: 'Matic',
  symbol: 'MATIC',
  decimals: 18,
  image: ''
}

export const BNB: Token = {
  name: 'Binance Coin',
  symbol: 'BNB',
  decimals: 18,
  image: ''
}

export const AVAX: Token = {
  name: 'Avalanche',
  symbol: 'AVAX',
  decimals: 18,
  image: ''
}

export const FTM: Token = {
  name: 'Fantom',
  symbol: 'FTM',
  decimals: 18,
  image: ''
}

export const GAFI: Token = {
  name: 'GameFi',
  symbol: 'GAFI',
  decimals: 18,
  image: '',
  address: '0x89af13a10b32f1b2f8d1588f93027f69b6f4e27e'
}

export const BUSD_BSC: Token = {
  name: 'BUSD',
  symbol: 'BUSD',
  decimals: 18,
  image: '',
  address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
}

export const BUSD_TESTNET: Token = {
  name: 'BUSD',
  symbol: 'BUSD',
  decimals: 18,
  image: '',
  address: '0x79c86934be686b28b9aeeafc42202907b06e3d7a'
}

export const USDT_ERC: Token = {
  name: 'USDT',
  symbol: 'USDT',
  decimals: 6,
  image: '',
  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
}

export const USDT_POLYGON: Token = {
  name: 'USDT',
  symbol: 'USDT',
  decimals: 6,
  image: '',
  address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
}

export const USDT_MUMBAI: Token = {
  name: 'USDT',
  symbol: 'USDT',
  decimals: 6,
  image: '',
  address: '0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e'
}

export const supportedCurrencies = {
  eth: [ETH, USDT_ERC],
  bsc: [BNB, BUSD_BSC, GAFI, BUSD_TESTNET],
  polygon: [MATIC, USDT_POLYGON, USDT_MUMBAI]
}

export const getSupportedCurrencyByAddrress = (address: string, network: string) => {
  if (!address || !network) return null

  switch (network.toLowerCase()) {
  case 'bsc':
  case 'bsc_testnet':
    return address === ethers.constants.AddressZero ? BNB : supportedCurrencies.bsc.find(item => item.address?.toLowerCase() === address.toLowerCase())
  case 'goerli':
  case 'eth':
    return address === ethers.constants.AddressZero ? ETH : supportedCurrencies.eth.find(item => item.address?.toLowerCase() === address.toLowerCase())
  case 'mumbai':
  case 'matic':
    return address === ethers.constants.AddressZero ? MATIC : supportedCurrencies.polygon.find(item => item.address?.toLowerCase() === address.toLowerCase())
  default:
    return null
  }
}

export const fetcher = (url, ...args) => fetch(url, ...args).then(res => res.json())

export const API_NFT_URL = 'https://nft.gamefi.org/api/v1/nft'

export const MARKET_PLACE_FEE_RECIPIENT = '0x5D73Df30D4506A724a17a2158a3645f0C02501eF'

export const MIN_EXPIRATION_MINUTES = 1
export const ORDER_MATCHING_LATENCY_SECONDS = 0

function parseSignatureHex(signature: string): ECSignature {
  const validVParamValues = [27, 28];

  const ecSignatureRSV = _parseSignatureHexAsRSV(signature);
  if (_.includes(validVParamValues, ecSignatureRSV.v)) {
    return ecSignatureRSV;
  }

  const ecSignatureVRS = _parseSignatureHexAsVRS(signature);
  if (_.includes(validVParamValues, ecSignatureVRS.v)) {
    return ecSignatureVRS;
  }

  throw new Error("Invalid signature");

  function _parseSignatureHexAsVRS(signatureHex: string) {
    const signatureBuffer: any = ethUtil.toBuffer(signatureHex);
    let v = signatureBuffer[0];
    if (v < 27) {
      v += 27;
    }
    const r = signatureBuffer.slice(1, 33);
    const s = signatureBuffer.slice(33, 65);
    const ecSignature = {
      v,
      r: ethUtil.bufferToHex(r),
      s: ethUtil.bufferToHex(s),
    };
    return ecSignature;
  }

  function _parseSignatureHexAsRSV(signatureHex: string) {
    const { v, r, s } = ethUtil.fromRpcSig(signatureHex);
    const ecSignature = {
      v,
      r: ethUtil.bufferToHex(r),
      s: ethUtil.bufferToHex(s),
    };
    return ecSignature;
  }
}

export interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: string;
}

export interface JsonRpcPayload {
  jsonrpc: string;
  method: string;
  params: any[];
  id?: string | number;
}


export interface AbstractProvider {
  sendAsync(payload: JsonRpcPayload, callback: (error: Error | null, result?: JsonRpcResponse) => void): void;
  send?(payload: JsonRpcPayload, callback: (error: Error | null, result?: JsonRpcResponse) => void): void;
  request?(args: RequestArguments): Promise<any>;
  connected?: boolean;
}

export interface RequestArguments {
  method: string;
  params?: any;
  [key: string]: any;
}

export type Web3Callback<T> = (err: Error | null, result: T) => void;

/**
 * Promisify a callback-syntax web3 function
 * @param inner callback function that accepts a Web3 callback function and passes
 * it to the Web3 function
 */
 async function promisify<T>(inner: (fn: Web3Callback<T>) => void) {
  return new Promise<T>((resolve, reject) =>
    inner((err, res) => {
      if (err) {
        reject(err);
      }
      resolve(res);
    })
  );
}

/**
 * Sign messages using web3 signTypedData signatures
 * @param web3 Web3 instance
 * @param message message to sign
 * @param signerAddress web3 address signing the message
 * @returns A signature if provider can sign, otherwise null
 */
 export async function signTypedDataAsync(
  web3: Web3,
  message: Record<string, any>,
  signerAddress: string,
  signer: ethers.Wallet
): Promise<ECSignature> {
  let signature: string | undefined;
  // try {
  //   await signer.call({
  //     method: "eth_signTypedData",
  //     params: [signerAddress, message],
  //     from: signerAddress,
  //     id: new Date().getTime(),
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } as any).then(res => console.log('res', res))
  // } catch (e) {
  //   console.log(e)
  // }
  try {
    await signer._signTypedData(message.domain, {
      Order: [
        { name: "exchange", type: "address" },
        { name: "maker", type: "address" },
        { name: "taker", type: "address" },
        { name: "makerRelayerFee", type: "uint256" },
        { name: "takerRelayerFee", type: "uint256" },
        { name: "makerProtocolFee", type: "uint256" },
        { name: "takerProtocolFee", type: "uint256" },
        { name: "feeRecipient", type: "address" },
        { name: "feeMethod", type: "uint8" },
        { name: "side", type: "uint8" },
        { name: "saleKind", type: "uint8" },
        { name: "target", type: "address" },
        { name: "howToCall", type: "uint8" },
        { name: "calldata", type: "bytes" },
        { name: "replacementPattern", type: "bytes" },
        { name: "staticTarget", type: "address" },
        { name: "staticExtradata", type: "bytes" },
        { name: "paymentToken", type: "address" },
        { name: "basePrice", type: "uint256" },
        { name: "extra", type: "uint256" },
        { name: "listingTime", type: "uint256" },
        { name: "expirationTime", type: "uint256" },
        { name: "salt", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    }, message.message).then(res => (signature = res?.toString()))
  } catch (e) {
    throw new Error(e)
  }

  // let signature: JsonRpcResponse | undefined;
  // try {
  //   // Using sign typed data V4 works with a stringified message, used by browser providers i.e. Metamask
  //   signature = await promisify<JsonRpcResponse | undefined>((c) =>
  //     (web3.currentProvider as AbstractProvider).sendAsync(
  //       {
  //         method: "eth_signTypedData_v4",
  //         params: [signerAddress, JSON.stringify(message)],
  //         from: signerAddress,
  //         id: new Date().getTime(),
  //         // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //       } as any,
  //       c
  //     )
  //   );
  // } catch {
  //   // Fallback to normal sign typed data for node providers, without using stringified message
  //   // https://github.com/coinbase/coinbase-wallet-sdk/issues/60
  //   signature = await promisify<JsonRpcResponse | undefined>((c) =>
  //     (web3.currentProvider as AbstractProvider).sendAsync(
  //       {
  //         method: "eth_signTypedData",
  //         params: [signerAddress, message],
  //         from: signerAddress,
  //         id: new Date().getTime(),
  //         // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //       } as any,
  //       c
  //     )
  //   );
  // }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // const error = (signature as any).error;
  // if (error) {
  //   throw new Error(error);
  // }

  return parseSignatureHex(signature);
}