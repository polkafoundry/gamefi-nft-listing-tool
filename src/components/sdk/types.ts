import BigNumber from 'bignumber.js'
import { ECSignature, ExchangeMetadata, OpenSeaAccount, OpenSeaAssetBundle, OpenSeaFungibleToken, TokenStandardVersion, UnsignedOrder, WyvernConfig, WyvernSchemaName } from 'opensea-js/lib/types'

export enum Network {
  BSC = 'bsc',
  Polygon = 'polygon',
  Goerli = 'goerli',
}

/**
 * OpenSea API configuration object
 * @param apiKey Optional key to use for API
 * @param networkName `Network` type to use. Defaults to `Network.Main` (mainnet)
 * @param gasPrice Default gas price to send to the Wyvern Protocol
 * @param apiBaseUrl Optional base URL to use for the API
 */
export interface OpenSeaAPIConfig {
  networkName?: Network;
  apiKey?: string;
  apiBaseUrl?: string;
  useReadOnlyProvider?: boolean;
  gasPrice?: BigNumber;
  wyvernConfig?: WyvernConfig;
}

export interface Asset {
  tokenId: string | null;
  tokenAddress: string;
  schemaName?: WyvernSchemaName;
  version?: TokenStandardVersion;
  name?: string;
  decimals?: number;
  network?: string;
}

export interface GameFiAssetContract {
  address: string;
  network: string;
}

export interface GameFiCreator {
  logo: string;
  name: string;
  slug: string;
  verified: boolean;
}
export interface GameFiAsset {
  // Name of the NFT/Token
  name: string | null;
  // Token contract
  asset_contract: GameFiAssetContract;
  image_url?: string;
  image_url_thumbnail?: string;
  platform_fee: string;
  token_id: string;
  total_favorites?: number;
  creator?: GameFiCreator;
  metadata?: any;
  description?: any;
  order?: any;
  owner?: {
    address?: string;
  };
}

/**
 * Orders don't need to be signed if they're pre-approved
 * with a transaction on the contract to approveOrder_
 */
export interface GameFiOrderWithSignature extends UnsignedOrder, Partial<ECSignature> {
  createdTime?: BigNumber;
  currentPrice?: BigNumber;
  currentBounty?: BigNumber;
  makerAccount?: OpenSeaAccount;
  takerAccount?: OpenSeaAccount;
  paymentTokenContract?: OpenSeaFungibleToken;
  feeRecipientAccount?: OpenSeaAccount;
  cancelledOrFinalized?: boolean;
  markedInvalid?: boolean;
  asset?: GameFiAsset;
  assetBundle?: OpenSeaAssetBundle;
  nonce?: number;
}
/**
* Order attributes, including orderbook-specific query options
* See https://docs.opensea.io/reference#retrieving-orders for the full
* list of API query parameters and documentation.
*/
export interface GameFiOrderJSON extends Partial<ECSignature> {
  exchange: string;
  maker: string;
  taker: string;
  hash?: string;
  makerRelayerFee: string;
  takerRelayerFee: string;
  makerProtocolFee: string;
  takerProtocolFee: string;
  feeRecipient: string;
  feeMethod: number;
  side: number;
  saleKind: number;
  target: string;
  howToCall: number;
  calldata: string;
  replacementPattern: string;
  staticTarget: string;
  staticExtradata: string;
  paymentToken: string;
  basePrice: string;
  extra: string;
  listingTime: number | string;
  expirationTime: number | string;
  salt: string;
  makerReferrerFee: string;
  quantity: string;
  englishAuctionReservePrice: string | undefined;
  createdTime?: number | string;
  metadata: ExchangeMetadata;
  nonce?: number;
  network?: string;
}

export interface GameFiSDKConfig {
  networkName?: string;
  apiKey?: string;
  apiBaseUrl?: string;
  useReadOnlyProvider?: boolean;
  gasPrice?: BigNumber;
  wyvernConfig?: WyvernConfig;
}

// export const merkleValidatorByNetwork = {
//   // main: '0x19aa7be4018c87cb1174595057121e52006f4953',
//   // rinkeby: '0x19aa7be4018c87cb1174595057121e52006f4953'
//   main: '0xaf37c37e6435ed6b335716ea572dc77ea223c93a',
//   rinkeby: '0xaf37c37e6435ed6b335716ea572dc77ea223c93a'
// }

export const merkleValidatorByChainId = {
  1: '0x66EE1eEe26e99F820d4976f9a506d916D3bFF20f',
  5: '0xaf37c37e6435ed6b335716ea572dc77ea223c93a',
  56: '0x916312a2DEe9bd458e1c372862871AD05BD7d55d',
  97: '0x19aa7be4018c87cb1174595057121e52006f4953',
  137: '0x31B72918D2ae4E37660a71fFC6Ecd9f9A05F85e8',
  80001: '',
  43114: '0x8704A455Df75618ADc7741AA0C01125e1c1BE048'
}
