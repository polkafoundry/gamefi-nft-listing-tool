import BigNumber from 'bignumber.js'
import { ECSignature, ExchangeMetadata, OpenSeaAccount, OpenSeaAssetBundle, OpenSeaFungibleToken, TokenStandardVersion, UnsignedOrder, WyvernConfig, WyvernSchemaName } from 'opensea-js/lib/types'

export enum Network {
  BSC = 'bsc',
  Polygon = 'matic',
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

export const proxyRegistryContractByChainId = (chainId) => {
  switch (chainId) {
    case 1:
      return '0xaE60460E0d93a8170Dbe155914e9970483BBFd3f'
    case 137:
      return '0x12Aa3eE78fE41a741Cb018181bb643bbBdBa2F1E'
    case 56:
      return '0x9daa2cFD70D1f92a2Cf560eF8078b680151D0977'
    case 80001:
      return '0x9E2D85240b742d3d19e01be4DaFF081078192d0d'
  }
}

export const CONTRACTS_137 = {
  wyvernExchangeContractAddress: '0x66740c8F4370AB9aeccB86E0d43AC7556D1752Cc',
  wyvernProxyRegistryContractAddress: '0x12Aa3eE78fE41a741Cb018181bb643bbBdBa2F1E',
  wyvernDAOContractAddress: '0x2DB294bc4BaB155521aE359D879Fa0ad9b74ee08',
  wyvernTokenContractAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
  wyvernTokenTransferProxyContractAddress: '0xd4B3b80698287F612B8f78822878fee8a298Af6c',
  wyvernAtomicizerContractAddress: '0x8704A455Df75618ADc7741AA0C01125e1c1BE048'
}

export const CONTRACTS_56 = {
  wyvernExchangeContractAddress: '0x31B72918D2ae4E37660a71fFC6Ecd9f9A05F85e8',
  wyvernProxyRegistryContractAddress: '0x9daa2cFD70D1f92a2Cf560eF8078b680151D0977',
  wyvernDAOContractAddress: '0xd4B3b80698287F612B8f78822878fee8a298Af6c',
  wyvernTokenContractAddress: '0x89Af13A10b32F1b2f8d1588f93027F69B6F4E27e',
  wyvernTokenTransferProxyContractAddress: '0x384A47e8A61C6D3eEdDae213c1C18398e3eceAc7',
  wyvernAtomicizerContractAddress: '0xaE60460E0d93a8170Dbe155914e9970483BBFd3f'
}

export const CONTRACTS_1 = {
  wyvernExchangeContractAddress: '0x384A47e8A61C6D3eEdDae213c1C18398e3eceAc7',
  wyvernProxyRegistryContractAddress: '0xaE60460E0d93a8170Dbe155914e9970483BBFd3f',
  wyvernDAOContractAddress: '0x12Aa3eE78fE41a741Cb018181bb643bbBdBa2F1E',
  wyvernTokenContractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  wyvernTokenTransferProxyContractAddress: '0x9daa2cFD70D1f92a2Cf560eF8078b680151D0977',
  wyvernAtomicizerContractAddress: '0x66740c8F4370AB9aeccB86E0d43AC7556D1752Cc'
}

export const CONTRACTS_43114 = {
  wyvernExchangeContractAddress: '0x2DB294bc4BaB155521aE359D879Fa0ad9b74ee08',
  wyvernProxyRegistryContractAddress: '0x5c83E1e454A6b86845e44e7520833cD50F04DE59',
  wyvernDAOContractAddress: '0x928466fC71a749930F079485fFdae5721D2b4C78',
  wyvernTokenContractAddress: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  wyvernTokenTransferProxyContractAddress: '0x2b820C3ae26d80b5c3E2efB58e40c79A39C8eEaB',
  wyvernAtomicizerContractAddress: '0xB54EC22d7784E62318b050Ab5b6Ba7f6506E5990'
}

export const CONTRACTS_80001 = {
  wyvernExchangeContractAddress: '0x9FF4e89E6eAf3CD982d28759b8Cab899F63F55aC',
  wyvernProxyRegistryContractAddress: '0x9E2D85240b742d3d19e01be4DaFF081078192d0d',
  wyvernDAOContractAddress: '0xDDeBF2B58a4b8006B6430416760c5c5073021491',
  wyvernTokenContractAddress: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  wyvernTokenTransferProxyContractAddress: '0xe15b2e1A446541A79e22BCA2960D3F4229116aC4',
  wyvernAtomicizerContractAddress: '0xAD3A1921238c6E22131f2f2EDbf3dEfA16d3b3F3'
}