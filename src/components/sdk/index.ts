import { Seaport } from '@opensea/seaport-js'
import { CROSS_CHAIN_SEAPORT_ADDRESS } from '@opensea/seaport-js/lib/constants'
import { BigNumber } from '@0x/utils'
import { Web3JsProvider } from 'ethereum-types'
import { isValidAddress } from 'ethereumjs-util'
import { ethers, providers } from 'ethers'
import { EventEmitter, EventSubscription } from 'fbemitter'
import * as _ from 'lodash'
import Web3 from 'web3'
import ProxyRegistryABI from '../../abi/proxyRegistry.json'
import { WyvernProtocol } from 'wyvern-js'
import * as WyvernSchemas from 'wyvern-schemas'
import { Schema } from 'wyvern-schemas/dist/types'
import { API } from './api'
import {
  CK_ADDRESS,
  CK_RINKEBY_ADDRESS,
  CONDUIT_KEYS_TO_CONDUIT,
  DEFAULT_BUYER_FEE_BASIS_POINTS,
  DEFAULT_GAS_INCREASE_FACTOR,
  DEFAULT_MAX_BOUNTY,
  DEFAULT_SELLER_FEE_BASIS_POINTS,
  EIP_712_ORDER_TYPES,
  EIP_712_WYVERN_DOMAIN_NAME,
  EIP_712_WYVERN_DOMAIN_VERSION,
  ENJIN_COIN_ADDRESS,
  INVERSE_BASIS_POINT,
  MANA_ADDRESS,
  NULL_ADDRESS,
  NULL_BLOCK_HASH,
  CROSS_CHAIN_DEFAULT_CONDUIT_KEY,
  OPENSEA_SELLER_BOUNTY_BASIS_POINTS,
  UNISWAP_FACTORY_ADDRESS_MAINNET,
  UNISWAP_FACTORY_ADDRESS_RINKEBY,
  WRAPPED_NFT_FACTORY_ADDRESS_MAINNET,
  WRAPPED_NFT_FACTORY_ADDRESS_RINKEBY,
  WRAPPED_NFT_LIQUIDATION_PROXY_ADDRESS_MAINNET,
  WRAPPED_NFT_LIQUIDATION_PROXY_ADDRESS_RINKEBY
} from 'opensea-js/lib/constants'
import {
  CanonicalWETH,
  ERC20,
  ERC721,
  getMethod,
  WrappedNFTLiquidationProxy
} from 'opensea-js/lib/contracts'
import {
  MAX_ERROR_LENGTH,
  requireOrderCalldataCanMatch,
  requireOrdersCanMatch
} from 'opensea-js/lib/debugging'
import { OrderV2 } from 'opensea-js/lib/orders/types'
import { ERC1155Abi } from 'opensea-js/lib/typechain/contracts/ERC1155Abi'
import { ERC721v3Abi } from 'opensea-js/lib/typechain/contracts/ERC721v3Abi'
import {
  ComputedFees,
  ECSignature,
  EventData,
  EventType,
  FeeMethod,
  HowToCall,
  Network,
  OpenSeaAPIConfig as APIConfig,
  OpenSeaAsset,
  OpenSeaFungibleToken,
  Order,
  OrderSide,
  PartialReadonlyContractAbi,
  RawWyvernOrderJSON,
  SaleKind,
  TokenStandardVersion,
  UnhashedOrder,
  UnsignedOrder,
  WyvernAsset,
  WyvernAtomicMatchParameters,
  WyvernFTAsset,
  WyvernNFTAsset,
  WyvernSchemaName
} from 'opensea-js/lib/types'
import {
  encodeAtomicizedBuy,
  encodeAtomicizedSell,
  encodeAtomicizedTransfer,
  encodeBuy,
  encodeCall,
  encodeProxyCall,
  encodeSell,
  encodeTransferCall
} from 'opensea-js/lib/utils/schema'
import {
  annotateERC20TransferABI,
  annotateERC721TransferABI,
  assignOrdersToSides,
  confirmTransaction,
  delay,
  estimateCurrentPrice,
  estimateGas,
  getCurrentGasPrice,
  getNonCompliantApprovalAddress,
  getOrderHash,
  getTransferFeeSettings,
  getWyvernAsset,
  makeBigNumber,
  rawCall,
  sendRawTransaction,
  validateAndFormatWalletAddress,
  getMaxOrderExpirationTimestamp,
  hasErrorCode,
  getAssetItemType,
  BigNumberInput
} from 'opensea-js/lib/utils/utils'
import { Asset, GameFiAsset, GameFiOrderWithSignature, merkleValidatorByChainId, proxyRegistryContractByChainId } from './types'
import { gamefiOrderToJSON, signTypedDataAsync, API_NFT_URL, MARKET_PLACE_FEE_RECIPIENT, MIN_EXPIRATION_MINUTES, ORDER_MATCHING_LATENCY_SECONDS } from './utils'

export class SDK {
  // Web3 instance to use
  public web3: Web3
  public web3ReadOnly: Web3
  // Ethers provider
  public ethersProvider: providers.Web3Provider
  // Seaport client
  public seaport: Seaport
  // Logger function to use when debugging
  public logger: (arg: string) => void
  // API instance on this seaport
  public readonly api: API
  // Extra gwei to add to the mean gas price when making transactions
  public gasPriceAddition = new BigNumber(3)
  // Multiply gas estimate by this factor when making transactions
  public gasIncreaseFactor = DEFAULT_GAS_INCREASE_FACTOR

  private _networkName: Network
  private _wyvernProtocol: WyvernProtocol
  private _wyvernProtocolReadOnly: WyvernProtocol
  private _wyvernConfigOverride?: APIConfig['wyvernConfig']
  private _emitter: EventEmitter
  private _wrappedNFTFactoryAddress: string
  private _wrappedNFTLiquidationProxyAddress: string
  private _uniswapFactoryAddress: string
  private _network_chain_id: number

  public signer: ethers.Wallet

  /**
   * Your very own seaport.
   * Create a new instance of OpenSeaJS.
   * @param provider Web3 Provider to use for transactions. For example:
   *  `const provider = new Web3.providers.HttpProvider('https://mainnet.infura.io')`
   * @param apiConfig configuration options, including `networkName`
   * @param logger logger, optional, a function that will be called with debugging
   *  information
   */
  constructor (
    provider: Web3['currentProvider'],
    signer: ethers.Wallet,
    apiConfig: APIConfig = {},
    chainId: number,
    logger?: (arg: string) => void
  ) {
    // API config
    apiConfig.networkName = apiConfig.networkName || Network.Main
    apiConfig.apiBaseUrl = API_NFT_URL
    this.api = new API(apiConfig)
    this._wyvernConfigOverride = apiConfig.wyvernConfig
    this._network_chain_id = chainId
    this.signer = signer

    this._networkName = apiConfig.networkName

    const readonlyProvider = provider

    const useReadOnlyProvider = apiConfig.useReadOnlyProvider ?? true

    // Web3 Config
    this.web3 = new Web3(provider)
    this.web3ReadOnly = useReadOnlyProvider
      ? new Web3(readonlyProvider)
      : this.web3

    // Ethers Config
    this.ethersProvider = new providers.Web3Provider(
      provider as providers.ExternalProvider
    )

    this.seaport = new Seaport(this.ethersProvider, {
      conduitKeyToConduit: CONDUIT_KEYS_TO_CONDUIT,
      overrides: {
        defaultConduitKey: CROSS_CHAIN_DEFAULT_CONDUIT_KEY
      }
    })

    // WyvernJS config
    this._wyvernProtocol = new WyvernProtocol(provider as unknown as Web3JsProvider, {
      network: this._networkName,
      ...apiConfig.wyvernConfig
    })

    // WyvernJS config for readonly (optimization for infura calls)
    this._wyvernProtocolReadOnly = useReadOnlyProvider
      ? new WyvernProtocol(readonlyProvider as unknown as Web3JsProvider, {
        network: this._networkName,
        ...apiConfig.wyvernConfig
      })
      : this._wyvernProtocol

    // WrappedNFTLiquidationProxy Config
    this._wrappedNFTFactoryAddress =
      this._networkName === Network.Main
        ? WRAPPED_NFT_FACTORY_ADDRESS_MAINNET
        : WRAPPED_NFT_FACTORY_ADDRESS_RINKEBY
    this._wrappedNFTLiquidationProxyAddress =
      this._networkName === Network.Main
        ? WRAPPED_NFT_LIQUIDATION_PROXY_ADDRESS_MAINNET
        : WRAPPED_NFT_LIQUIDATION_PROXY_ADDRESS_RINKEBY
    this._uniswapFactoryAddress =
      this._networkName === Network.Main
        ? UNISWAP_FACTORY_ADDRESS_MAINNET
        : UNISWAP_FACTORY_ADDRESS_RINKEBY

    // Emit events
    this._emitter = new EventEmitter()

    // Debugging: default to nothing
    this.logger = logger || ((arg: string) => arg)
  }

  /**
   * Add a listener to a marketplace event
   * @param event An event to listen for
   * @param listener A callback that will accept an object with event data
   * @param once Whether the listener should only be called once
   */
  public addListener (
    event: EventType,
    listener: (data: EventData) => void,
    once = false
  ): EventSubscription {
    const subscription = once
      ? this._emitter.once(event, listener)
      : this._emitter.addListener(event, listener)
    return subscription
  }

  /**
   * Remove an event listener, included here for completeness.
   * Simply calls `.remove()` on a subscription
   * @param subscription The event subscription returned from `addListener`
   */
  public removeListener (subscription: EventSubscription) {
    subscription.remove()
  }

  /**
   * Remove all event listeners. Good idea to call this when you're unmounting
   * a component that listens to events to make UI updates
   * @param event Optional EventType to remove listeners for
   */
  public removeAllListeners (event?: EventType) {
    this._emitter.removeAllListeners(event)
  }

  /**
   * Wraps an arbitrary group of NFTs into their corresponding WrappedNFT ERC20 tokens.
   * Emits the `WrapAssets` event when the transaction is prompted.
   * @param param0 __namedParameters Object
   * @param assets An array of objects with the tokenId and tokenAddress of each of the assets to bundle together.
   * @param accountAddress Address of the user's wallet
   */
  public async wrapAssets ({
    assets,
    accountAddress
  }: {
    assets: Asset[];
    accountAddress: string;
  }) {
    const schema = this._getSchema(WyvernSchemaName.ERC721)
    const wyAssets = assets.map((a) => getWyvernAsset(schema, a))

    // Separate assets out into two arrays of tokenIds and tokenAddresses
    const tokenIds = wyAssets.map((a) => a.id)
    const tokenAddresses = wyAssets.map((a) => a.address)

    // Check if all tokenAddresses match. If not, then we have a mixedBatch of
    // NFTs from different NFT core contracts
    const isMixedBatchOfAssets = !tokenAddresses.every(
      (val, _i, arr) => val === arr[0]
    )

    this._dispatch(EventType.WrapAssets, { assets: wyAssets, accountAddress })

    const txHash = await sendRawTransaction(
      this.web3,
      {
        from: accountAddress,
        to: this._wrappedNFTLiquidationProxyAddress,
        value: 0,
        data: encodeCall(getMethod(WrappedNFTLiquidationProxy, 'wrapNFTs'), [
          tokenIds,
          tokenAddresses,
          isMixedBatchOfAssets
        ])
      },
      (error) => {
        this._dispatch(EventType.TransactionDenied, { error, accountAddress })
      }
    )

    await this._confirmTransaction(
      txHash,
      EventType.WrapAssets,
      'Wrapping Assets'
    )
  }

  /**
   * Unwraps an arbitrary group of NFTs from their corresponding WrappedNFT ERC20 tokens back into ERC721 tokens.
   * Emits the `UnwrapAssets` event when the transaction is prompted.
   * @param param0 __namedParameters Object
   * @param assets An array of objects with the tokenId and tokenAddress of each of the assets to bundle together.
   * @param destinationAddresses Addresses that each resulting ERC721 token will be sent to. Must be the same length as `tokenIds`. Each address corresponds with its respective token ID in the `tokenIds` array.
   * @param accountAddress Address of the user's wallet
   */
  public async unwrapAssets ({
    assets,
    destinationAddresses,
    accountAddress
  }: {
    assets: Asset[];
    destinationAddresses: string[];
    accountAddress: string;
  }) {
    if (
      !assets ||
      !destinationAddresses ||
      assets.length !== destinationAddresses.length
    ) {
      throw new Error(
        "The 'assets' and 'destinationAddresses' arrays must exist and have the same length."
      )
    }

    const schema = this._getSchema(WyvernSchemaName.ERC721)
    const wyAssets = assets.map((a) => getWyvernAsset(schema, a))

    // Separate assets out into two arrays of tokenIds and tokenAddresses
    const tokenIds = wyAssets.map((a) => a.id)
    const tokenAddresses = wyAssets.map((a) => a.address)

    // Check if all tokenAddresses match. If not, then we have a mixedBatch of
    // NFTs from different NFT core contracts
    const isMixedBatchOfAssets = !tokenAddresses.every(
      (val, _i, arr) => val === arr[0]
    )

    this._dispatch(EventType.UnwrapAssets, {
      assets: wyAssets,
      accountAddress
    })

    const txHash = await sendRawTransaction(
      this.web3,
      {
        from: accountAddress,
        to: this._wrappedNFTLiquidationProxyAddress,
        value: 0,
        data: encodeCall(getMethod(WrappedNFTLiquidationProxy, 'unwrapNFTs'), [
          tokenIds,
          tokenAddresses,
          destinationAddresses,
          isMixedBatchOfAssets
        ])
      },
      (error) => {
        this._dispatch(EventType.TransactionDenied, { error, accountAddress })
      }
    )

    await this._confirmTransaction(
      txHash,
      EventType.UnwrapAssets,
      'Unwrapping Assets'
    )
  }

  /**
   * Wrap ETH into W-ETH.
   * W-ETH is needed for placing buy orders (making offers).
   * Emits the `WrapEth` event when the transaction is prompted.
   * @param param0 __namedParameters Object
   * @param amountInEth How much ether to wrap
   * @param accountAddress Address of the user's wallet containing the ether
   */
  public async wrapEth ({
    amountInEth,
    accountAddress
  }: {
    amountInEth: number;
    accountAddress: string;
  }) {
    const token = WyvernSchemas.tokens[this._networkName].canonicalWrappedEther

    const amount = WyvernProtocol.toBaseUnitAmount(
      makeBigNumber(amountInEth),
      token.decimals
    )

    this._dispatch(EventType.WrapEth, { accountAddress, amount })

    const txHash = await sendRawTransaction(
      this.web3,
      {
        from: accountAddress,
        to: token.address,
        value: amount,
        data: encodeCall(getMethod(CanonicalWETH, 'deposit'), [])
      },
      (error) => {
        this._dispatch(EventType.TransactionDenied, { error, accountAddress })
      }
    )

    await this._confirmTransaction(txHash, EventType.WrapEth, 'Wrapping ETH')
  }

  /**
   * Unwrap W-ETH into ETH.
   * Emits the `UnwrapWeth` event when the transaction is prompted.
   * @param param0 __namedParameters Object
   * @param amountInEth How much W-ETH to unwrap
   * @param accountAddress Address of the user's wallet containing the W-ETH
   */
  public async unwrapWeth ({
    amountInEth,
    accountAddress
  }: {
    amountInEth: number;
    accountAddress: string;
  }) {
    const token = WyvernSchemas.tokens[this._networkName].canonicalWrappedEther

    const amount = WyvernProtocol.toBaseUnitAmount(
      makeBigNumber(amountInEth),
      token.decimals
    )

    this._dispatch(EventType.UnwrapWeth, { accountAddress, amount })

    const txHash = await sendRawTransaction(
      this.web3,
      {
        from: accountAddress,
        to: token.address,
        value: 0,
        data: encodeCall(getMethod(CanonicalWETH, 'withdraw'), [
          amount.toString()
        ])
      },
      (error) => {
        this._dispatch(EventType.TransactionDenied, { error, accountAddress })
      }
    )

    await this._confirmTransaction(
      txHash,
      EventType.UnwrapWeth,
      'Unwrapping W-ETH'
    )
  }

  /**
   * Create a buy order to make an offer on an asset.
   * If the user hasn't approved W-ETH access yet, this will emit `ApproveCurrency` before asking for approval.
   * @param param0 __namedParameters Object
   * @param asset The asset to trade
   * @param accountAddress Address of the maker's wallet
   * @param startAmount Value of the offer, in units of the payment token (or wrapped ETH if no payment token address specified)
   * @param quantity The number of assets to bid for (if fungible or semi-fungible). Defaults to 1. In units, not base units, e.g. not wei.
   * @param expirationTime Expiration time for the order, in seconds.
   * @param paymentTokenAddress Optional address for using an ERC-20 token in the order. If unspecified, defaults to W-ETH
   * @param sellOrder Optional sell order (like an English auction) to ensure fee and schema compatibility
   * @param referrerAddress The optional address that referred the order
   */
  public async createBuyOrderLegacyWyvern ({
    asset,
    gamefiAsset,
    accountAddress,
    startAmount,
    quantity = 1,
    expirationTime = getMaxOrderExpirationTimestamp(),
    paymentTokenAddress,
    sellOrder,
    referrerAddress,
    network
  }: {
    asset: Asset;
    gamefiAsset: GameFiAsset;
    accountAddress: string;
    startAmount: number;
    quantity?: number;
    expirationTime?: number;
    paymentTokenAddress?: string;
    sellOrder?: Order;
    referrerAddress?: string;
    network: string;
  }): Promise<GameFiOrderWithSignature> {
    paymentTokenAddress =
      paymentTokenAddress ||
      WyvernSchemas.tokens[this._networkName].canonicalWrappedEther.address
    if (!paymentTokenAddress) {
      throw new Error('Payment token required')
    }

    const order = await this._makeBuyOrder({
      asset,
      gamefiAsset,
      quantity,
      accountAddress,
      startAmount,
      expirationTime,
      paymentTokenAddress,
      extraBountyBasisPoints: 0,
      sellOrder,
      referrerAddress
    })

    // NOTE not in Wyvern exchange code:
    // frontend checks to make sure
    // token is approved and sufficiently available
    await this._buyOrderValidationAndApprovals({ order, accountAddress })
    const hashedOrder = {
      ...order,
      hash: getOrderHash(order)
    }

    let signature
    try {
      signature = await this.authorizeOrder(hashedOrder)
    } catch (error) {
      console.error('authorize error', error)
      throw new Error('You declined to authorize your offer')
    }

    const orderWithSignature = {
      ...hashedOrder,
      ...signature
    }
    return this.validateAndPostOrder(orderWithSignature, network)
  }

  /**
   * Create a sell order to auction an asset.
   * Will throw a 'You do not own enough of this asset' error if the maker doesn't have the asset or not enough of it to sell the specific `quantity`.
   * If the user hasn't approved access to the token yet, this will emit `ApproveAllAssets` (or `ApproveAsset` if the contract doesn't support approve-all) before asking for approval.
   * @param param0 __namedParameters Object
   * @param tokenId DEPRECATED: Token ID. Use `asset` instead.
   * @param tokenAddress DEPRECATED: Address of the token's contract. Use `asset` instead.
   * @param asset The asset to trade
   * @param accountAddress Address of the maker's wallet
   * @param startAmount Price of the asset at the start of the auction. Units are in the amount of a token above the token's decimal places (integer part). For example, for ether, expected units are in ETH, not wei.
   * @param endAmount Optional price of the asset at the end of its expiration time. Units are in the amount of a token above the token's decimal places (integer part). For example, for ether, expected units are in ETH, not wei.
   * @param quantity The number of assets to sell (if fungible or semi-fungible). Defaults to 1. In units, not base units, e.g. not wei.
   * @param listingTime Optional time when the order will become fulfillable, in UTC seconds. Undefined means it will start now.
   * @param expirationTime Expiration time for the order, in UTC seconds.
   * @param waitForHighestBid If set to true, this becomes an English auction that increases in price for every bid. The highest bid wins when the auction expires, as long as it's at least `startAmount`. `expirationTime` must be > 0.
   * @param englishAuctionReservePrice Optional price level, below which orders may be placed but will not be matched.  Orders below the reserve can be manually accepted but will not be automatically matched.
   * @param paymentTokenAddress Address of the ERC-20 token to accept in return. If undefined or null, uses Ether.
   * @param extraBountyBasisPoints Optional basis points (1/100th of a percent) to reward someone for referring the fulfillment of this order
   * @param buyerAddress Optional address that's allowed to purchase this item. If specified, no other address will be able to take the order, unless its value is the null address.
   * @param buyerEmail Optional email of the user that's allowed to purchase this item. If specified, a user will have to verify this email before being able to take the order.
   */
  public async createSellOrderLegacyWyvern ({
    asset,
    gamefiAsset,
    accountAddress,
    startAmount,
    endAmount,
    quantity = 1,
    listingTime,
    expirationTime = getMaxOrderExpirationTimestamp(),
    waitForHighestBid = false,
    englishAuctionReservePrice,
    paymentTokenAddress,
    extraBountyBasisPoints = 0,
    buyerAddress,
    buyerEmail,
    network
  }: {
    asset: Asset;
    gamefiAsset: GameFiAsset;
    accountAddress: string;
    startAmount: number;
    endAmount?: number;
    quantity?: number;
    listingTime?: number;
    expirationTime?: number;
    waitForHighestBid?: boolean;
    englishAuctionReservePrice?: number;
    paymentTokenAddress?: string;
    extraBountyBasisPoints?: number;
    buyerAddress?: string;
    buyerEmail?: string;
    network: string;
  }): Promise<GameFiOrderWithSignature> {
    const order = await this._makeSellOrder({
      asset,
      gamefiAsset,
      quantity,
      accountAddress,
      startAmount,
      endAmount,
      listingTime,
      expirationTime,
      waitForHighestBid,
      englishAuctionReservePrice,
      paymentTokenAddress: paymentTokenAddress || NULL_ADDRESS,
      extraBountyBasisPoints,
      buyerAddress: buyerAddress || NULL_ADDRESS
    })
    await this._sellOrderValidationAndApprovals({ order, accountAddress })

    const hashedOrder = {
      ...order,
      hash: getOrderHash(order)
    }
    console.log('_sellOrderValidationAndApprovals done')

    let signature
    try {
      signature = await this.authorizeOrder(hashedOrder)
    } catch (error) {
      console.error(error)
      throw new Error('You declined to authorize your auction')
    }

    console.log('authorize order done')

    const orderWithSignature = {
      ...hashedOrder,
      ...signature
    }

    console.log('orderWithSignature', orderWithSignature)

    return this.validateAndPostOrder(orderWithSignature, network)
  }

  /**
   * Fullfill or "take" an order for an asset, either a buy or sell order
   * @param param0 __namedParamaters Object
   * @param order The order to fulfill, a.k.a. "take"
   * @param accountAddress The taker's wallet address
   * @param recipientAddress The optional address to receive the order's item(s) or curriencies. If not specified, defaults to accountAddress.
   * @param referrerAddress The optional address that referred the order
   * @returns Transaction hash for fulfilling the order
   */
  public async fulfillOrderLegacyWyvern ({
    order,
    accountAddress,
    recipientAddress,
    referrerAddress
  }: {
    order: Order;
    accountAddress: string;
    recipientAddress?: string;
    referrerAddress?: string;
  }): Promise<string> {
    const matchingOrder = this._makeMatchingOrder({
      order,
      accountAddress,
      recipientAddress: recipientAddress || accountAddress
    })

    const { buy, sell } = assignOrdersToSides(order, matchingOrder)

    const metadata = this._getMetadata(order, referrerAddress)
    const transactionHash = await this._atomicMatch({
      buy,
      sell,
      accountAddress,
      metadata
    })

    await this._confirmTransaction(
      transactionHash,
      EventType.MatchOrders,
      'Fulfilling order',
      async () => {
        const isOpen = await this._validateOrder(order)
        return !isOpen
      }
    )
    return transactionHash
  }

  /**
   * Cancel an order on-chain, preventing it from ever being fulfilled.
   * @param param0 __namedParameters Object
   * @param order The order to cancel
   * @param accountAddress The order maker's wallet address
   */
  public async cancelOrderLegacyWyvern ({
    order,
    accountAddress
  }: {
    order: Order;
    accountAddress: string;
  }) {
    this._dispatch(EventType.CancelOrder, { order, accountAddress })

    const transactionHash = await this._wyvernProtocol.wyvernExchange
      .cancelOrder_(
        [
          order.exchange,
          order.maker,
          order.taker,
          order.feeRecipient,
          order.target,
          order.staticTarget,
          order.paymentToken
        ],
        [
          order.makerRelayerFee,
          order.takerRelayerFee,
          order.makerProtocolFee,
          order.takerProtocolFee,
          order.basePrice,
          order.extra,
          order.listingTime,
          order.expirationTime,
          order.salt
        ],
        order.feeMethod,
        order.side,
        order.saleKind,
        order.howToCall,
        order.calldata,
        order.replacementPattern,
        order.staticExtradata,
        order.v || 0,
        order.r || NULL_BLOCK_HASH,
        order.s || NULL_BLOCK_HASH
      )
      .sendTransactionAsync({ from: accountAddress })

    await this._confirmTransaction(
      transactionHash,
      EventType.CancelOrder,
      'Cancelling order',
      async () => {
        const isOpen = await this._validateOrder(order)
        return !isOpen
      }
    )
  }

  /**
   * Cancel all existing orders with a lower nonce on-chain, preventing them from ever being fulfilled.
   * @param param0 __namedParameters Object
   * @param accountAddress The order maker's wallet address
   */
  public async bulkCancelExistingOrders ({
    accountAddress
  }: {
    accountAddress: string;
  }) {
    this._dispatch(EventType.BulkCancelExistingOrders, { accountAddress })

    const transactionHash = await this._wyvernProtocol.wyvernExchange
      .incrementNonce()
      .sendTransactionAsync({ from: accountAddress })

    await this._confirmTransaction(
      transactionHash.toString(),
      EventType.BulkCancelExistingOrders,
      'Bulk cancelling existing orders'
    )
  }

  /**
   * Approve a non-fungible token for use in trades.
   * Requires an account to be initialized first.
   * Called internally, but exposed for dev flexibility.
   * Checks to see if already approved, first. Then tries different approval methods from best to worst.
   * @param param0 __namedParameters Object
   * @param tokenId Token id to approve, but only used if approve-all isn't
   *  supported by the token contract
   * @param tokenAddress The contract address of the token being approved
   * @param accountAddress The user's wallet address
   * @param proxyAddress Address of the user's proxy contract. If not provided,
   *  will attempt to fetch it from Wyvern.
   * @param tokenAbi ABI of the token's contract. Defaults to a flexible ERC-721
   *  contract.
   * @param skipApproveAllIfTokenAddressIn an optional list of token addresses that, if a token is approve-all type, will skip approval
   * @param schemaName The Wyvern schema name corresponding to the asset type
   * @returns Transaction hash if a new transaction was created, otherwise null
   */
  public async approveSemiOrNonFungibleToken ({
    tokenId,
    tokenAddress,
    accountAddress,
    proxyAddress,
    tokenAbi = ERC721,
    skipApproveAllIfTokenAddressIn = new Set(),
    schemaName = WyvernSchemaName.ERC721
  }: {
    tokenId: string;
    tokenAddress: string;
    accountAddress: string;
    proxyAddress?: string;
    tokenAbi?: PartialReadonlyContractAbi;
    skipApproveAllIfTokenAddressIn?: Set<string>;
    schemaName?: WyvernSchemaName;
  }): Promise<string | null> {
    const schema = this._getSchema(schemaName)
    const tokenContract = new this.web3.eth.Contract(
      tokenAbi,
      tokenAddress
    ) as unknown as ERC721v3Abi | ERC1155Abi

    console.log('token contract', tokenContract, tokenAddress)

    if (!proxyAddress) {
      proxyAddress = (await this._getProxy(accountAddress)) || undefined
      if (!proxyAddress) {
        throw new Error('Uninitialized account')
      }
    }

    const approvalAllCheck = async () => {
      // NOTE:
      // Use this long way of calling so we can check for method existence on a bool-returning method.
      const isApprovedForAllRaw = await rawCall(this.web3ReadOnly, {
        from: accountAddress,
        to: tokenContract.options.address,
        data: tokenContract.methods
          .isApprovedForAll(accountAddress, proxyAddress)
          .encodeABI()
      })
      console.log('approve all check', parseInt(isApprovedForAllRaw))
      return parseInt(isApprovedForAllRaw)
    }

    const isApprovedForAll = await approvalAllCheck()

    if (isApprovedForAll === 1) {
      // Supports ApproveAll
      this.logger('Already approved proxy for all tokens')
      return null
    }

    if (isApprovedForAll === 0) {
      // Supports ApproveAll
      //  not approved for all yet

      if (skipApproveAllIfTokenAddressIn.has(tokenAddress)) {
        this.logger(
          'Already approving proxy for all tokens in another transaction'
        )
        return null
      }
      skipApproveAllIfTokenAddressIn.add(tokenAddress)

      try {
        this._dispatch(EventType.ApproveAllAssets, {
          accountAddress,
          proxyAddress,
          contractAddress: tokenAddress
        })

        console.log('start approve', {
          from: accountAddress,
          to: tokenContract.options.address,
          data: tokenContract.methods
            .setApprovalForAll(proxyAddress, true)
            .encodeABI()
        })
        const feeData = await this.signer.getFeeData()
        const txHash = await this.signer.sendTransaction(
          {
            from: accountAddress,
            to: tokenContract.options.address,
            data: tokenContract.methods
              .setApprovalForAll(proxyAddress, true)
              .encodeABI(),
            gasPrice: feeData?.gasPrice
          }
        )
        await this._confirmTransaction(
          txHash?.hash,
          EventType.ApproveAllAssets,
          'Approving all tokens of this type for trading',
          async () => {
            const result = await approvalAllCheck()
            return result === 1
          }
        )
        return txHash?.hash
      } catch (error) {
        console.error(error)
        throw new Error(
          "Couldn't get permission to approve these tokens for trading. Their contract might not be implemented correctly. Please contact the developer!"
        )
      }
    }

    // Does not support ApproveAll (ERC721 v1 or v2)
    this.logger('Contract does not support Approve All')

    const approvalOneCheck = async () => {
      // Note: approvedAddr will be 'undefined' if not supported
      let approvedAddr: string | undefined
      try {
        approvedAddr = await (tokenContract as ERC721v3Abi).methods
          .getApproved(tokenId)
          .call()
        if (typeof approvedAddr === 'string' && approvedAddr === '0x') {
          // Geth compatibility
          approvedAddr = undefined
        }
      } catch (error) {
        console.error(error)
      }

      if (approvedAddr === proxyAddress) {
        this.logger('Already approved proxy for this token')
        return true
      }
      this.logger(`Approve response: ${approvedAddr}`)

      // SPECIAL CASING non-compliant contracts
      if (!approvedAddr) {
        approvedAddr = await getNonCompliantApprovalAddress(
          // @ts-expect-error This is an actual contract instance
          tokenContract,
          tokenId,
          accountAddress
        )
        if (approvedAddr === proxyAddress) {
          this.logger('Already approved proxy for this item')
          return true
        }
        this.logger(`Special-case approve response: ${approvedAddr}`)
      }
      return false
    }

    const isApprovedForOne = await approvalOneCheck()
    if (isApprovedForOne) {
      return null
    }

    // Call `approve`

    try {
      this._dispatch(EventType.ApproveAsset, {
        accountAddress,
        proxyAddress,
        asset: getWyvernAsset(schema, { tokenId, tokenAddress })
      })

      const txHash = await this.signer.sendTransaction(
        {
          from: accountAddress,
          to: tokenContract.options.address,
          data: (tokenContract as ERC721v3Abi).methods
            .approve(proxyAddress, tokenId)
            .encodeABI()
        }
      )

      await this._confirmTransaction(
        txHash?.hash,
        EventType.ApproveAsset,
        'Approving single token for trading',
        approvalOneCheck
      )
      return txHash?.hash
    } catch (error) {
      console.error(error)
      throw new Error(
        "Couldn't get permission to approve this token for trading. Its contract might not be implemented correctly. Please contact the developer!"
      )
    }
  }

  /**
   * Approve a fungible token (e.g. W-ETH) for use in trades.
   * Called internally, but exposed for dev flexibility.
   * Checks to see if the minimum amount is already approved, first.
   * @param param0 __namedParameters Object
   * @param accountAddress The user's wallet address
   * @param tokenAddress The contract address of the token being approved
   * @param proxyAddress The user's proxy address. If unspecified, uses the Wyvern token transfer proxy address.
   * @param minimumAmount The minimum amount needed to skip a transaction. Defaults to the max-integer.
   * @returns Transaction hash if a new transaction occurred, otherwise null
   */
  public async approveFungibleToken ({
    accountAddress,
    tokenAddress,
    proxyAddress,
    minimumAmount = WyvernProtocol.MAX_UINT_256
  }: {
    accountAddress: string;
    tokenAddress: string;
    proxyAddress?: string;
    minimumAmount?: BigNumber;
  }): Promise<string | null> {
    proxyAddress =
      proxyAddress ||
      this._wyvernConfigOverride?.wyvernTokenTransferProxyContractAddress ||
      WyvernProtocol.getTokenTransferProxyAddress(this._networkName)

    const approvedAmount = await this._getApprovedTokenCount({
      accountAddress,
      tokenAddress,
      proxyAddress
    })

    if (approvedAmount.isGreaterThanOrEqualTo(minimumAmount)) {
      this.logger('Already approved enough currency for trading')
      return null
    }

    this.logger(
      `Not enough token approved for trade: ${approvedAmount} approved to transfer ${tokenAddress}`
    )

    this._dispatch(EventType.ApproveCurrency, {
      accountAddress,
      contractAddress: tokenAddress,
      proxyAddress
    })

    const hasOldApproveMethod = [ENJIN_COIN_ADDRESS, MANA_ADDRESS].includes(
      tokenAddress.toLowerCase()
    )

    if (minimumAmount.isGreaterThan(0) && hasOldApproveMethod) {
      // Older erc20s require initial approval to be 0
      await this.unapproveFungibleToken({
        accountAddress,
        tokenAddress,
        proxyAddress
      })
    }

    const txHash = await this.signer.sendTransaction(
      {
        from: accountAddress,
        to: tokenAddress,
        data: encodeCall(
          getMethod(ERC20, 'approve'),
          // Always approve maximum amount, to prevent the need for followup
          // transactions (and because old ERC20s like MANA/ENJ are non-compliant)
          [proxyAddress, WyvernProtocol.MAX_UINT_256.toString()]
        )
      }
    )

    await this._confirmTransaction(
      txHash?.hash,
      EventType.ApproveCurrency,
      'Approving currency for trading',
      async () => {
        const newlyApprovedAmount = await this._getApprovedTokenCount({
          accountAddress,
          tokenAddress,
          proxyAddress
        })
        return newlyApprovedAmount.isGreaterThanOrEqualTo(minimumAmount)
      }
    )
    return txHash?.hash
  }

  /**
   * Un-approve a fungible token (e.g. W-ETH) for use in trades.
   * Called internally, but exposed for dev flexibility.
   * Useful for old ERC20s that require a 0 approval count before
   * changing the count
   * @param param0 __namedParameters Object
   * @param accountAddress The user's wallet address
   * @param tokenAddress The contract address of the token being approved
   * @param proxyAddress The user's proxy address. If unspecified, uses the Wyvern token transfer proxy address.
   * @returns Transaction hash
   */
  public async unapproveFungibleToken ({
    accountAddress,
    tokenAddress,
    proxyAddress
  }: {
    accountAddress: string;
    tokenAddress: string;
    proxyAddress?: string;
  }): Promise<string> {
    proxyAddress =
      proxyAddress ||
      this._wyvernConfigOverride?.wyvernTokenTransferProxyContractAddress ||
      WyvernProtocol.getTokenTransferProxyAddress(this._networkName)

    const txHash = await sendRawTransaction(
      this.web3,
      {
        from: accountAddress,
        to: tokenAddress,
        data: encodeCall(getMethod(ERC20, 'approve'), [proxyAddress, 0])
      },
      (error) => {
        this._dispatch(EventType.TransactionDenied, { error, accountAddress })
      }
    )

    await this._confirmTransaction(
      txHash,
      EventType.UnapproveCurrency,
      'Resetting Currency Approval',
      async () => {
        const newlyApprovedAmount = await this._getApprovedTokenCount({
          accountAddress,
          tokenAddress,
          proxyAddress
        })
        return newlyApprovedAmount.isZero()
      }
    )
    return txHash
  }

  /**
   * Gets the current price for the order.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async getCurrentPrice ({
    order
  }: {
    order: OrderV2;
  }): Promise<BigNumber> {
    return new BigNumber(order.currentPrice)
  }

  /**
   * Gets the price for the order using the contract
   * @param order The order to calculate the price for
   */
  public async getCurrentPriceLegacyWyvern (order: Order) {
    const currentPrice = await this._wyvernProtocolReadOnly.wyvernExchange
      .calculateCurrentPrice_(
        [
          order.exchange,
          order.maker,
          order.taker,
          order.feeRecipient,
          order.target,
          order.staticTarget,
          order.paymentToken
        ],
        [
          order.makerRelayerFee,
          order.takerRelayerFee,
          order.makerProtocolFee,
          order.takerProtocolFee,
          order.basePrice,
          order.extra,
          order.listingTime,
          order.expirationTime,
          order.salt
        ],
        order.feeMethod,
        order.side,
        order.saleKind,
        order.howToCall,
        order.calldata,
        order.replacementPattern,
        order.staticExtradata
      )
      .callAsync()

    return currentPrice
  }

  /**
   * Returns whether an order is fulfillable.
   * An order may not be fulfillable if a target item's transfer function
   * is locked for some reason, e.g. an item is being rented within a game
   * or trading has been locked for an item type.
   * @param param0 __namedParameters Object
   * @param order Order to check
   * @param accountAddress The account address that will be fulfilling the order
   * @param recipientAddress The optional address to receive the order's item(s) or curriencies. If not specified, defaults to accountAddress.
   * @param referrerAddress The optional address that referred the order
   */
  public async isOrderFulfillable ({
    order,
    accountAddress
  }: {
    order: OrderV2;
    accountAddress: string;
  }): Promise<boolean> {
    switch (order.protocolAddress) {
    case CROSS_CHAIN_SEAPORT_ADDRESS: {
      try {
        const isValid = await this.seaport
          .validate([order.protocolData], accountAddress)
          .callStatic()
        return !!isValid
      } catch (error) {
        if (hasErrorCode(error) && error.code === 'CALL_EXCEPTION') {
          return false
        }
        throw error
      }
    }
    default:
      throw new Error('Unsupported protocol')
    }
  }

  /**
   * Returns whether an order is fulfillable.
   * An order may not be fulfillable if a target item's transfer function
   * is locked for some reason, e.g. an item is being rented within a game
   * or trading has been locked for an item type.
   * @param param0 __namedParameters Object
   * @param order Order to check
   * @param accountAddress The account address that will be fulfilling the order
   * @param recipientAddress The optional address to receive the order's item(s) or curriencies. If not specified, defaults to accountAddress.
   * @param referrerAddress The optional address that referred the order
   */
  public async isOrderFulfillableLegacyWyvern ({
    order,
    accountAddress,
    recipientAddress,
    referrerAddress
  }: {
    order: Order;
    accountAddress: string;
    recipientAddress?: string;
    referrerAddress?: string;
  }): Promise<boolean> {
    const matchingOrder = this._makeMatchingOrder({
      order,
      accountAddress,
      recipientAddress: recipientAddress || accountAddress
    })

    const { buy, sell } = assignOrdersToSides(order, matchingOrder)

    const metadata = this._getMetadata(order, referrerAddress)
    const gas = await this._estimateGasForMatch({
      buy,
      sell,
      accountAddress,
      metadata
    })

    this.logger(
      `Gas estimate for ${
        order.side === OrderSide.Sell ? 'sell' : 'buy'
      } order: ${gas}`
    )

    return gas !== null && gas > 0
  }

  /**
   * Returns whether an asset is transferrable.
   * An asset may not be transferrable if its transfer function
   * is locked for some reason, e.g. an item is being rented within a game
   * or trading has been locked for an item type.
   * @param param0 __namedParameters Object
   * @param tokenId DEPRECATED: Token ID. Use `asset` instead.
   * @param tokenAddress DEPRECATED: Address of the token's contract. Use `asset` instead.
   * @param asset The asset to trade
   * @param fromAddress The account address that currently owns the asset
   * @param toAddress The account address that will be acquiring the asset
   * @param quantity The amount of the asset to transfer, if it's fungible (optional). In units (not base units), e.g. not wei.
   * @param useProxy Use the `fromAddress`'s proxy contract only if the `fromAddress` has already approved the asset for sale. Required if checking an ERC-721 v1 asset (like CryptoKitties) that doesn't check if the transferFrom caller is the owner of the asset (only allowing it if it's an approved address).
   * @param retries How many times to retry if false
   */
  public async isAssetTransferrable (
    {
      asset,
      fromAddress,
      toAddress,
      quantity,
      useProxy = false
    }: {
      asset: Asset;
      fromAddress: string;
      toAddress: string;
      quantity?: BigNumberInput;
      useProxy?: boolean;
    },
    retries = 1
  ): Promise<boolean> {
    const schema = this._getSchema(this._getSchemaName(asset))
    const quantityBN = quantity
      ? WyvernProtocol.toBaseUnitAmount(
        makeBigNumber(quantity),
        asset.decimals || 0
      )
      : makeBigNumber(1)
    const wyAsset = getWyvernAsset(schema, asset, quantityBN)
    const abi = schema.functions.transfer(wyAsset)

    let from = fromAddress
    if (useProxy) {
      const proxyAddress = await this._getProxy(fromAddress)
      if (!proxyAddress) {
        console.error(
          `This asset's owner (${fromAddress}) does not have a proxy!`
        )
        return false
      }
      from = proxyAddress
    }

    const data = encodeTransferCall(abi, fromAddress, toAddress)

    try {
      const gas = await estimateGas(this._getClientsForRead({ retries }).web3, {
        from,
        to: abi.target,
        data
      })
      return gas > 0
    } catch (error) {
      if (retries <= 0) {
        console.error(error)
        console.error(from, abi.target, data)
        return false
      }
      await delay(500)
      return await this.isAssetTransferrable(
        { asset, fromAddress, toAddress, quantity, useProxy },
        retries - 1
      )
    }
  }

  /**
   * Transfer a fungible or non-fungible asset to another address
   * @param param0 __namedParamaters Object
   * @param fromAddress The owner's wallet address
   * @param toAddress The recipient's wallet address
   * @param asset The fungible or non-fungible asset to transfer
   * @param quantity The amount of the asset to transfer, if it's fungible (optional). In units (not base units), e.g. not wei.
   * @returns Transaction hash
   */
  public async transfer ({
    fromAddress,
    toAddress,
    asset,
    quantity = 1
  }: {
    fromAddress: string;
    toAddress: string;
    asset: Asset;
    quantity?: number | BigNumber;
  }): Promise<string> {
    const schema = this._getSchema(this._getSchemaName(asset))
    const quantityBN = WyvernProtocol.toBaseUnitAmount(
      makeBigNumber(quantity),
      asset.decimals || 0
    )
    const wyAsset = getWyvernAsset(schema, asset, quantityBN)
    const isCryptoKitties = [CK_ADDRESS, CK_RINKEBY_ADDRESS].includes(
      wyAsset.address
    )
    // Since CK is common, infer isOldNFT from it in case user
    // didn't pass in `version`
    const isOldNFT =
      isCryptoKitties ||
      (!!asset.version &&
        [TokenStandardVersion.ERC721v1, TokenStandardVersion.ERC721v2].includes(
          asset.version
        ))

    const abi =
      this._getSchemaName(asset) === WyvernSchemaName.ERC20
        ? annotateERC20TransferABI(wyAsset as WyvernFTAsset)
        : isOldNFT
          ? annotateERC721TransferABI(wyAsset as WyvernNFTAsset)
          : schema.functions.transfer(wyAsset)

    this._dispatch(EventType.TransferOne, {
      accountAddress: fromAddress,
      toAddress,
      asset: wyAsset
    })

    const data = encodeTransferCall(abi, fromAddress, toAddress)
    const txHash = await this.signer.sendTransaction(
      {
        from: fromAddress,
        to: abi.target,
        data
      }
    )

    await this._confirmTransaction(
      txHash?.hash,
      EventType.TransferOne,
      'Transferring asset'
    )
    return txHash?.hash
  }

  /**
   * Transfer one or more assets to another address.
   * ERC-721 and ERC-1155 assets are supported
   * @param param0 __namedParamaters Object
   * @param assets An array of objects with the tokenId and tokenAddress of each of the assets to transfer.
   * @param fromAddress The owner's wallet address
   * @param toAddress The recipient's wallet address
   * @param schemaName The Wyvern schema name corresponding to the asset type, if not in each Asset definition
   * @returns Transaction hash
   */
  public async transferAll ({
    assets,
    fromAddress,
    toAddress,
    schemaName = WyvernSchemaName.ERC721
  }: {
    assets: Asset[];
    fromAddress: string;
    toAddress: string;
    schemaName?: WyvernSchemaName;
  }): Promise<string> {
    toAddress = validateAndFormatWalletAddress(this.web3, toAddress)

    const schemaNames = assets.map(
      (asset) => this._getSchemaName(asset) || schemaName
    )
    const wyAssets = assets.map((asset) =>
      getWyvernAsset(this._getSchema(this._getSchemaName(asset)), asset)
    )

    const { calldata, target } = encodeAtomicizedTransfer(
      schemaNames.map((name) => this._getSchema(name)),
      wyAssets,
      fromAddress,
      toAddress,
      this._wyvernProtocol,
      this._networkName
    )

    let proxyAddress = await this._getProxy(fromAddress)
    if (!proxyAddress) {
      proxyAddress = await this._initializeProxy(fromAddress)
    }

    await this._approveAll({
      schemaNames,
      wyAssets,
      accountAddress: fromAddress,
      proxyAddress
    })

    this._dispatch(EventType.TransferAll, {
      accountAddress: fromAddress,
      toAddress,
      assets: wyAssets
    })
    
    const txHash = await this.signer.sendTransaction({
      from: fromAddress,
      to: toAddress,
      data: encodeProxyCall(target, HowToCall.DelegateCall, calldata)
    })

    // const txHash = await sendRawTransaction(
    //   this.web3,
    //   {
    //     from: fromAddress,
    //     to: proxyAddress,
    //     data: encodeProxyCall(target, HowToCall.DelegateCall, calldata)
    //   },
    //   (error) => {
    //     this._dispatch(EventType.TransactionDenied, {
    //       error,
    //       accountAddress: fromAddress
    //     })
    //   }
    // )

    await this._confirmTransaction(
      txHash?.hash,
      EventType.TransferAll,
      `Transferring ${assets.length} asset${assets.length === 1 ? '' : 's'} to ${toAddress}`
    )
    return txHash?.hash
  }

  /**
   * Get an account's balance of any Asset.
   * @param param0 __namedParameters Object
   * @param accountAddress Account address to check
   * @param asset The Asset to check balance for
   * @param retries How many times to retry if balance is 0
   */
  public async getAssetBalance (
    { accountAddress, asset }: { accountAddress: string; asset: Asset },
    retries = 1
  ): Promise<BigNumber> {
    const schema = this._getSchema(this._getSchemaName(asset))
    const wyAsset = getWyvernAsset(schema, asset)

    if (schema.functions.countOf) {
      // ERC20 or ERC1155 (non-Enjin)

      const abi = schema.functions.countOf(wyAsset)
      const contract = new (this._getClientsForRead({
        retries
      }).web3.eth.Contract)([abi], abi.target)
      const inputValues = abi.inputs
        .filter((x) => x.value !== undefined)
        .map((x) => x.value)

      const count = await contract.methods[abi.name](
        accountAddress,
        ...inputValues
      ).call()

      if (count !== undefined) {
        return new BigNumber(count)
      }
    } else if (schema.functions.ownerOf) {
      // ERC721 asset

      const abi = schema.functions.ownerOf(wyAsset)
      const contract = new (this._getClientsForRead({
        retries
      }).web3.eth.Contract)([abi], abi.target)

      if (abi.inputs.filter((x) => x.value === undefined)[0]) {
        throw new Error(
          'Missing an argument for finding the owner of this asset'
        )
      }
      const inputValues = abi.inputs.map((i) => i.value.toString())
      try {
        const owner = await contract.methods[abi.name](...inputValues).call()
        if (owner) {
          return owner.toLowerCase() === accountAddress.toLowerCase()
            ? new BigNumber(1)
            : new BigNumber(0)
        }
        // eslint-disable-next-line no-empty
      } catch {}
    } else {
      // Missing ownership call - skip check to allow listings
      // by default
      throw new Error('Missing ownership schema for this asset type')
    }

    if (retries <= 0) {
      throw new Error('Unable to get current owner from smart contract')
    } else {
      await delay(500)
      // Recursively check owner again
      return await this.getAssetBalance({ accountAddress, asset }, retries - 1)
    }
  }

  /**
   * Get the balance of a fungible token.
   * Convenience method for getAssetBalance for fungibles
   * @param param0 __namedParameters Object
   * @param accountAddress Account address to check
   * @param tokenAddress The address of the token to check balance for
   * @param schemaName Optional schema name for the fungible token
   * @param retries Number of times to retry if balance is undefined
   */
  public async getTokenBalance (
    {
      accountAddress,
      tokenAddress,
      schemaName = WyvernSchemaName.ERC20
    }: {
      accountAddress: string;
      tokenAddress: string;
      schemaName?: WyvernSchemaName;
    },
    retries = 1
  ) {
    const asset: Asset = {
      tokenId: null,
      tokenAddress,
      schemaName
    }
    return this.getAssetBalance({ accountAddress, asset }, retries)
  }

  /**
   * Compute the fees for an order
   * @param param0 __namedParameters
   * @param asset Asset to use for fees. May be blank ONLY for multi-collection bundles.
   * @param side The side of the order (buy or sell)
   * @param accountAddress The account to check fees for (useful if fees differ by account, like transfer fees)
   * @param extraBountyBasisPoints The basis points to add for the bounty. Will throw if it exceeds the assets' contract's OpenSea fee.
   */
  public async computeFees ({
    asset,
    side,
    accountAddress,
    extraBountyBasisPoints = 0
  }: {
    asset?: OpenSeaAsset;
    side: OrderSide;
    accountAddress?: string;
    extraBountyBasisPoints?: number;
  }): Promise<ComputedFees> {
    let openseaBuyerFeeBasisPoints = DEFAULT_BUYER_FEE_BASIS_POINTS
    let openseaSellerFeeBasisPoints = DEFAULT_SELLER_FEE_BASIS_POINTS
    let devBuyerFeeBasisPoints = 0
    let devSellerFeeBasisPoints = 0
    let transferFee = makeBigNumber(0)
    let transferFeeTokenAddress = null
    let maxTotalBountyBPS = DEFAULT_MAX_BOUNTY

    if (asset) {
      openseaBuyerFeeBasisPoints = +asset.collection.openseaBuyerFeeBasisPoints
      openseaSellerFeeBasisPoints =
        +asset.collection.openseaSellerFeeBasisPoints
      devBuyerFeeBasisPoints = +asset.collection.devBuyerFeeBasisPoints
      devSellerFeeBasisPoints = +asset.collection.devSellerFeeBasisPoints

      maxTotalBountyBPS = openseaSellerFeeBasisPoints
    }

    // Compute transferFrom fees
    if (side === OrderSide.Sell && asset) {
      // Server-side knowledge
      transferFee = asset.transferFee
        ? makeBigNumber(asset.transferFee)
        : transferFee
      transferFeeTokenAddress = asset.transferFeePaymentToken
        ? asset.transferFeePaymentToken.address
        : transferFeeTokenAddress

      try {
        // web3 call to update it
        const result = await getTransferFeeSettings(this.web3, {
          asset,
          accountAddress
        })
        transferFee =
          result.transferFee !== null ? result.transferFee : transferFee
        transferFeeTokenAddress =
          result.transferFeeTokenAddress || transferFeeTokenAddress
      } catch (error) {
        // Use server defaults
        console.error(error)
      }
    }

    // Compute bounty
    const sellerBountyBasisPoints =
      side === OrderSide.Sell ? extraBountyBasisPoints : 0

    // Check that bounty is in range of the opensea fee
    const bountyTooLarge =
      sellerBountyBasisPoints + OPENSEA_SELLER_BOUNTY_BASIS_POINTS >
      maxTotalBountyBPS
    if (sellerBountyBasisPoints > 0 && bountyTooLarge) {
      let errorMessage = `Total bounty exceeds the maximum for this asset type (${
        maxTotalBountyBPS / 100
      }%).`
      if (maxTotalBountyBPS >= OPENSEA_SELLER_BOUNTY_BASIS_POINTS) {
        errorMessage += ` Remember that OpenSea will add ${
          OPENSEA_SELLER_BOUNTY_BASIS_POINTS / 100
        }% for referrers with OpenSea accounts!`
      }
      throw new Error(errorMessage)
    }

    return {
      totalBuyerFeeBasisPoints:
        openseaBuyerFeeBasisPoints + devBuyerFeeBasisPoints,
      totalSellerFeeBasisPoints:
        openseaSellerFeeBasisPoints + devSellerFeeBasisPoints,
      openseaBuyerFeeBasisPoints,
      openseaSellerFeeBasisPoints,
      devBuyerFeeBasisPoints,
      devSellerFeeBasisPoints,
      sellerBountyBasisPoints,
      transferFee,
      transferFeeTokenAddress
    }
  }

  /**
   * Post an order to the OpenSea orderbook.
   * @param order The order to post. Can either be signed by the maker or pre-approved on the Wyvern contract using approveOrder. See https://github.com/ProjectWyvern/wyvern-ethereum/blob/master/contracts/exchange/Exchange.sol#L178
   * @returns The order as stored by the orderbook
   */
  public async validateAndPostOrder (order: GameFiOrderWithSignature, network: string): Promise<GameFiOrderWithSignature> {
    // Validation is called server-side
    const confirmedOrder = await this.api.postOrderLegacyWyvern(
      gamefiOrderToJSON(order),
      2,
      network
    )

    return order
  }

  /**
   * DEPRECATED: ERC-1559
   * https://eips.ethereum.org/EIPS/eip-1559
   * Compute the gas price for sending a txn, in wei
   * Will be slightly above the mean to make it faster
   */
  public async _computeGasPrice (): Promise<BigNumber> {
    const meanGas = await getCurrentGasPrice(this.web3)
    const weiToAdd = this.web3.utils.toWei(
      this.gasPriceAddition.toString(),
      'gwei'
    )
    return meanGas.plus(weiToAdd)
  }

  /**
   * Compute the gas amount for sending a txn
   * Will be slightly above the result of estimateGas to make it more reliable
   * @param estimation The result of estimateGas for a transaction
   */
  public _correctGasAmount (estimation: number): number {
    return Math.ceil(estimation * this.gasIncreaseFactor)
  }

  /**
   * Estimate the gas needed to match two orders. Returns undefined if tx errors
   * @param param0 __namedParamaters Object
   * @param buy The buy order to match
   * @param sell The sell order to match
   * @param accountAddress The taker's wallet address
   * @param metadata Metadata bytes32 to send with the match
   * @param retries Number of times to retry if false
   */
  public async _estimateGasForMatch (
    {
      buy,
      sell,
      accountAddress,
      metadata = NULL_BLOCK_HASH
    }: { buy: Order; sell: Order; accountAddress: string; metadata?: string },
    retries = 1
  ): Promise<number | undefined> {
    let value: BigNumber | undefined
    if (
      buy.maker.toLowerCase() === accountAddress.toLowerCase() &&
      buy.paymentToken === NULL_ADDRESS
    ) {
      value = await this._getRequiredAmountForTakingSellOrder(sell)
    }

    try {
      return await this._getClientsForRead({
        retries
      })
        .wyvernProtocol.wyvernExchange.atomicMatch_(
          [
            buy.exchange,
            buy.maker,
            buy.taker,
            buy.feeRecipient,
            buy.target,
            buy.staticTarget,
            buy.paymentToken,
            sell.exchange,
            sell.maker,
            sell.taker,
            sell.feeRecipient,
            sell.target,
            sell.staticTarget,
            sell.paymentToken
          ],
          [
            buy.makerRelayerFee,
            buy.takerRelayerFee,
            buy.makerProtocolFee,
            buy.takerProtocolFee,
            buy.basePrice,
            buy.extra,
            buy.listingTime,
            buy.expirationTime,
            buy.salt,
            sell.makerRelayerFee,
            sell.takerRelayerFee,
            sell.makerProtocolFee,
            sell.takerProtocolFee,
            sell.basePrice,
            sell.extra,
            sell.listingTime,
            sell.expirationTime,
            sell.salt
          ],
          [
            buy.feeMethod,
            buy.side,
            buy.saleKind,
            buy.howToCall,
            sell.feeMethod,
            sell.side,
            sell.saleKind,
            sell.howToCall
          ],
          buy.calldata,
          sell.calldata,
          buy.replacementPattern,
          sell.replacementPattern,
          buy.staticExtradata,
          sell.staticExtradata,
          [buy.v || 0, sell.v || 0],
          [
            buy.r || NULL_BLOCK_HASH,
            buy.s || NULL_BLOCK_HASH,
            sell.r || NULL_BLOCK_HASH,
            sell.s || NULL_BLOCK_HASH,
            metadata
          ]
        )
        .estimateGasAsync({ from: accountAddress, value })
    } catch (error) {
      if (retries <= 0) {
        console.error(error)
        return undefined
      }
      await delay(200)
      return await this._estimateGasForMatch(
        { buy, sell, accountAddress, metadata },
        retries - 1
      )
    }
  }

  /**
   * Estimate the gas needed to transfer assets in bulk
   * Used for tests
   * @param param0 __namedParamaters Object
   * @param assets An array of objects with the tokenId and tokenAddress of each of the assets to transfer.
   * @param fromAddress The owner's wallet address
   * @param toAddress The recipient's wallet address
   * @param schemaName The Wyvern schema name corresponding to the asset type, if not in each asset
   */
  public async _estimateGasForTransfer ({
    assets,
    fromAddress,
    toAddress,
    schemaName = WyvernSchemaName.ERC721
  }: {
    assets: Asset[];
    fromAddress: string;
    toAddress: string;
    schemaName?: WyvernSchemaName;
  }): Promise<number> {
    const schemaNames = assets.map(
      (asset) => this._getSchemaName(asset) || schemaName
    )
    const wyAssets = assets.map((asset) =>
      getWyvernAsset(this._getSchema(this._getSchemaName(asset)), asset)
    )

    const proxyAddress = await this._getProxy(fromAddress)
    if (!proxyAddress) {
      throw new Error('Uninitialized proxy address')
    }

    await this._approveAll({
      schemaNames,
      wyAssets,
      accountAddress: fromAddress,
      proxyAddress
    })

    const { calldata, target } = encodeAtomicizedTransfer(
      schemaNames.map((name) => this._getSchema(name)),
      wyAssets,
      fromAddress,
      toAddress,
      this._wyvernProtocol,
      this._networkName
    )

    return estimateGas(this.web3, {
      from: fromAddress,
      to: proxyAddress,
      data: encodeProxyCall(target, HowToCall.DelegateCall, calldata)
    })
  }

  /**
   * Get the proxy address for a user's wallet.
   * Internal method exposed for dev flexibility.
   * @param accountAddress The user's wallet address
   * @param retries Optional number of retries to do
   * @param wyvernProtocol optional wyvern protocol override
   */
  public async _getProxy (
    accountAddress: string,
    retries = 0
  ): Promise<string | null> {
    // console.log('getProxy', this._wyvernProtocolReadOnly)
    // let proxyAddress: string | null =
    //   await this._wyvernProtocolReadOnly.wyvernProxyRegistry
    //     .proxies(accountAddress)
    //     .callAsync()

    const tokenContract = new ethers.Contract(proxyRegistryContractByChainId(this._network_chain_id), ProxyRegistryABI, this.signer)
    console.log('checking proxy', tokenContract, accountAddress)
    let proxyAddress: string | null = await tokenContract.proxies(accountAddress).catch(e => console.log(e))
    if (proxyAddress === '0x') {
      throw new Error(
        "Couldn't retrieve your account from the blockchain - make sure you're on the correct network!"
      )
    }

    if (!proxyAddress || proxyAddress === NULL_ADDRESS) {
      if (retries > 0) {
        await delay(1000)
        return await this._getProxy(accountAddress, retries - 1)
      }
      proxyAddress = null
    }
    return proxyAddress
  }

  /**
   * Initialize the proxy for a user's wallet.
   * Proxies are used to make trades on behalf of the order's maker so that
   *  trades can happen when the maker isn't online.
   * Internal method exposed for dev flexibility.
   * @param accountAddress The user's wallet address
   * @param wyvernProtocol optional wyvern protocol override
   */

  public async _initializeProxy (accountAddress: string): Promise<string> {
    this._dispatch(EventType.InitializeAccount, { accountAddress })
    this.logger(`Initializing proxy for account: ${accountAddress}`)

    // const txnData = { from: accountAddress }

    const contract = new ethers.Contract(proxyRegistryContractByChainId(this._network_chain_id), ProxyRegistryABI, this.signer)
    const feeData = await this.signer.provider.getFeeData()

    console.log('start', contract, feeData)
    const tx = await contract.registerProxy({
      gasPrice: feeData?.gasPrice
    })
    console.log(tx)
    const transactionHash = tx?.hash
    // const gasEstimate = await this._wyvernProtocol.wyvernProxyRegistry
    //   .registerProxy()
    //   .estimateGasAsync(txnData)
    // const transactionHash = await this._wyvernProtocol.wyvernProxyRegistry
    //   .registerProxy()
    //   .sendTransactionAsync({
    //     ...txnData,
    //     gas: this._correctGasAmount(gasEstimate)
    //   })

    await this._confirmTransaction(
      transactionHash,
      EventType.InitializeAccount,
      'Initializing proxy for account',
      async () => {
        const polledProxy = await this._getProxy(accountAddress, 0)
        return !!polledProxy
      }
    )

    const proxyAddress = await this._getProxy(accountAddress, 10)
    if (!proxyAddress) {
      throw new Error(
        'Failed to initialize your account :( Please restart your wallet/browser and try again!'
      )
    }

    return proxyAddress
  }

  /**
   * For a fungible token to use in trades (like W-ETH), get the amount
   *  approved for use by the Wyvern transfer proxy.
   * Internal method exposed for dev flexibility.
   * @param param0 __namedParameters Object
   * @param accountAddress Address for the user's wallet
   * @param tokenAddress Address for the token's contract
   * @param proxyAddress User's proxy address. If undefined, uses the token transfer proxy address
   */
  public async _getApprovedTokenCount ({
    accountAddress,
    tokenAddress,
    proxyAddress
  }: {
    accountAddress: string;
    tokenAddress?: string;
    proxyAddress?: string;
  }) {
    if (!tokenAddress) {
      tokenAddress =
        WyvernSchemas.tokens[this._networkName].canonicalWrappedEther.address
    }
    const addressToApprove =
      proxyAddress ||
      this._wyvernConfigOverride?.wyvernTokenTransferProxyContractAddress ||
      WyvernProtocol.getTokenTransferProxyAddress(this._networkName)
    const approved = await rawCall(this.web3, {
      from: accountAddress,
      to: tokenAddress,
      data: encodeCall(getMethod(ERC20, 'allowance'), [
        accountAddress,
        addressToApprove
      ])
    })
    return makeBigNumber(approved)
  }

  public async _makeBuyOrder ({
    asset,
    gamefiAsset,
    quantity,
    accountAddress,
    startAmount,
    expirationTime = getMaxOrderExpirationTimestamp(),
    paymentTokenAddress,
    extraBountyBasisPoints = 0,
    sellOrder,
    referrerAddress
  }: {
    asset: Asset;
    gamefiAsset: GameFiAsset;
    quantity: number;
    accountAddress: string;
    startAmount: number;
    expirationTime?: number;
    paymentTokenAddress: string;
    extraBountyBasisPoints: number;
    sellOrder?: UnhashedOrder;
    referrerAddress?: string;
  }): Promise<UnhashedOrder> {
    accountAddress = validateAndFormatWalletAddress(this.web3, accountAddress)
    const schema = this._getSchema(this._getSchemaName(asset))
    const quantityBN = WyvernProtocol.toBaseUnitAmount(
      makeBigNumber(quantity),
      asset.decimals || 0
    )
    const wyAsset = getWyvernAsset(schema, asset, quantityBN)

    // const openSeaAsset: OpenSeaAsset = await this.api.getAsset(asset)

    const taker = sellOrder ? sellOrder.maker : NULL_ADDRESS

    // const { totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints } =
    //   await this.computeFees({
    //     asset: openSeaAsset,
    //     extraBountyBasisPoints,
    //     side: OrderSide.Buy
    //   })

    if (Number(gamefiAsset?.platform_fee) * 100 > 100) console.log('Platform fee > 100%')
    const totalSellerFeeBasisPoints = (Number(gamefiAsset?.platform_fee) * 100 > 100 ? 0 : Number(gamefiAsset?.platform_fee) * 100) || 0
    const totalBuyerFeeBasisPoints = 0

    const {
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee,
      takerProtocolFee,
      makerReferrerFee,
      feeRecipient,
      feeMethod
    } = this._getBuyFeeParameters(
      totalBuyerFeeBasisPoints,
      totalSellerFeeBasisPoints,
      sellOrder
    )

    const { target, calldata, replacementPattern } = encodeBuy(
      schema,
      wyAsset,
      accountAddress,
      sellOrder?.waitingForBestCounterOrder
        ? undefined
        : merkleValidatorByChainId[this._network_chain_id]
    )

    const { basePrice, extra, paymentToken } = await this._getPriceParameters(
      OrderSide.Buy,
      paymentTokenAddress,
      makeBigNumber(expirationTime),
      makeBigNumber(startAmount),
      gamefiAsset?.asset_contract?.network
    )

    const times = this._getTimeParameters({
      expirationTimestamp: expirationTime
    })

    // const { staticTarget, staticExtradata } =
    //   await this._getStaticCallTargetAndExtraData({
    //     asset: openSeaAsset,
    //     useTxnOriginStaticCall: false
    //   })

    return {
      exchange:
        this._wyvernConfigOverride?.wyvernExchangeContractAddress ||
        WyvernProtocol.getExchangeContractAddress(this._networkName),
      maker: accountAddress,
      taker,
      quantity: quantityBN,
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee,
      takerProtocolFee,
      makerReferrerFee,
      waitingForBestCounterOrder: false,
      feeMethod,
      feeRecipient,
      side: OrderSide.Buy,
      saleKind: SaleKind.FixedPrice,
      target,
      howToCall:
        target === merkleValidatorByChainId[this._network_chain_id]
          ? HowToCall.DelegateCall
          : HowToCall.Call,
      calldata,
      replacementPattern,
      staticTarget: NULL_ADDRESS,
      staticExtradata: '0x',
      paymentToken,
      basePrice,
      extra,
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: WyvernProtocol.generatePseudoRandomSalt(),
      metadata: {
        asset: wyAsset,
        schema: schema.name as WyvernSchemaName,
        referrerAddress
      }
    }
  }

  public async _makeSellOrder ({
    asset,
    gamefiAsset,
    quantity,
    accountAddress,
    startAmount,
    endAmount,
    listingTime,
    expirationTime = getMaxOrderExpirationTimestamp(),
    waitForHighestBid,
    englishAuctionReservePrice = 0,
    paymentTokenAddress,
    extraBountyBasisPoints,
    buyerAddress
  }: {
    asset: Asset;
    gamefiAsset: GameFiAsset;
    quantity: number;
    accountAddress: string;
    startAmount: number;
    endAmount?: number;
    waitForHighestBid: boolean;
    englishAuctionReservePrice?: number;
    listingTime?: number;
    expirationTime?: number;
    paymentTokenAddress: string;
    extraBountyBasisPoints: number;
    buyerAddress: string;
  }): Promise<UnhashedOrder> {
    accountAddress = validateAndFormatWalletAddress(this.web3, accountAddress)
    const schema = this._getSchema(this._getSchemaName(asset))
    const quantityBN = WyvernProtocol.toBaseUnitAmount(
      makeBigNumber(quantity),
      asset.decimals || 0
    )
    const wyAsset = getWyvernAsset(schema, asset, quantityBN)
    // const openSeaAsset = await this.api.getAsset(asset)

    // fee computed by the OpenSea rule
    // const {
    //   totalSellerFeeBasisPoints,
    //   totalBuyerFeeBasisPoints,
    //   sellerBountyBasisPoints
    // } = await this.computeFees({
    //   asset: openSeaAsset,
    //   side: OrderSide.Sell,
    //   extraBountyBasisPoints
    // })

    // Fee computed by GameFi.org rule
    if (Number(gamefiAsset?.platform_fee) * 100 > 100) console.log('Platform fee > 100%')
    const totalSellerFeeBasisPoints = (Number(gamefiAsset?.platform_fee) * 100 > 100 ? 0 : Number(gamefiAsset?.platform_fee) * 100) || 0
    const totalBuyerFeeBasisPoints = 0
    const sellerBountyBasisPoints = 0

    const { target, calldata, replacementPattern } = encodeSell(
      schema,
      wyAsset,
      accountAddress,
      waitForHighestBid
        ? undefined
        : merkleValidatorByChainId[this._network_chain_id]
    )

    const orderSaleKind =
      endAmount !== null && endAmount !== startAmount
        ? SaleKind.DutchAuction
        : SaleKind.FixedPrice

    const { basePrice, extra, paymentToken, reservePrice } =
      await this._getPriceParameters(
        OrderSide.Sell,
        paymentTokenAddress,
        makeBigNumber(expirationTime),
        makeBigNumber(startAmount),
        gamefiAsset?.asset_contract?.network,
        endAmount !== undefined ? makeBigNumber(endAmount) : undefined,
        waitForHighestBid,
        makeBigNumber(englishAuctionReservePrice)
      )
    const times = this._getTimeParameters({
      expirationTimestamp: expirationTime,
      listingTimestamp: listingTime,
      waitingForBestCounterOrder: waitForHighestBid
    })

    const {
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee,
      takerProtocolFee,
      makerReferrerFee,
      feeRecipient,
      feeMethod
    } = this._getSellFeeParameters(
      totalBuyerFeeBasisPoints,
      totalSellerFeeBasisPoints,
      waitForHighestBid,
      sellerBountyBasisPoints
    )

    // const { staticTarget, staticExtradata } =
    //   await this._getStaticCallTargetAndExtraData({
    //     asset: openSeaAsset,
    //     useTxnOriginStaticCall: waitForHighestBid
    //   })

    return {
      exchange:
        this._wyvernConfigOverride?.wyvernExchangeContractAddress ||
        WyvernProtocol.getExchangeContractAddress(this._networkName),
      maker: accountAddress,
      taker: buyerAddress,
      quantity: quantityBN,
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee,
      takerProtocolFee,
      makerReferrerFee,
      waitingForBestCounterOrder: waitForHighestBid,
      englishAuctionReservePrice: reservePrice
        ? makeBigNumber(reservePrice)
        : undefined,
      feeMethod,
      feeRecipient,
      side: OrderSide.Sell,
      saleKind: orderSaleKind,
      target,
      howToCall:
        target === merkleValidatorByChainId[this._network_chain_id]
          ? HowToCall.DelegateCall
          : HowToCall.Call,
      calldata,
      replacementPattern,
      staticTarget: NULL_ADDRESS,
      staticExtradata: '0x',
      paymentToken,
      basePrice,
      extra,
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: WyvernProtocol.generatePseudoRandomSalt(),
      metadata: {
        asset: wyAsset,
        schema: schema.name as WyvernSchemaName
      }
    }
  }

  public _makeMatchingOrder ({
    order,
    accountAddress,
    recipientAddress
  }: {
    order: UnsignedOrder;
    accountAddress: string;
    recipientAddress: string;
  }): UnsignedOrder {
    accountAddress = validateAndFormatWalletAddress(this.web3, accountAddress)
    recipientAddress = validateAndFormatWalletAddress(
      this.web3,
      recipientAddress
    )

    const computeOrderParams = () => {
      const shouldValidate =
        order.target?.toLowerCase() === merkleValidatorByChainId[this._network_chain_id]?.toLowerCase()

      if ('asset' in order.metadata) {
        const schema = this._getSchema(order.metadata.schema)
        return order.side === OrderSide.Buy
          ? encodeSell(
            schema,
            order.metadata.asset,
            recipientAddress,
            shouldValidate ? order.target : undefined
          )
          : encodeBuy(
            schema,
            order.metadata.asset,
            recipientAddress,
            shouldValidate ? order.target : undefined
          )
      } else if ('bundle' in order.metadata) {
        // We're matching a bundle order
        const bundle = order.metadata.bundle
        const orderedSchemas = bundle.schemas
          ? bundle.schemas.map((schemaName) => this._getSchema(schemaName))
          : bundle.assets.map(() =>
            this._getSchema(
              'schema' in order.metadata ? order.metadata.schema : undefined
            )
          )
        const atomicized =
          order.side === OrderSide.Buy
            ? encodeAtomicizedSell(
              orderedSchemas,
              order.metadata.bundle.assets,
              recipientAddress,
              this._wyvernProtocol,
              this._networkName
            )
            : encodeAtomicizedBuy(
              orderedSchemas,
              order.metadata.bundle.assets,
              recipientAddress,
              this._wyvernProtocol,
              this._networkName
            )
        return {
          target: WyvernProtocol.getAtomicizerContractAddress(
            this._networkName
          ),
          calldata: atomicized.calldata,
          replacementPattern: atomicized.replacementPattern
        }
      } else {
        throw new Error('Invalid order metadata')
      }
    }

    const { target, calldata, replacementPattern } = computeOrderParams()
    const times = this._getTimeParameters({
      expirationTimestamp: 0,
      isMatchingOrder: true
    })
    // Compat for matching buy orders that have fee recipient still on them
    const feeRecipient =
      order.feeRecipient === NULL_ADDRESS
        ? MARKET_PLACE_FEE_RECIPIENT
        : NULL_ADDRESS

    const matchingOrder: UnhashedOrder = {
      exchange: order.exchange,
      maker: accountAddress,
      taker: order.maker,
      quantity: order.quantity,
      makerRelayerFee: order.makerRelayerFee,
      takerRelayerFee: order.takerRelayerFee,
      makerProtocolFee: order.makerProtocolFee,
      takerProtocolFee: order.takerProtocolFee,
      makerReferrerFee: order.makerReferrerFee,
      waitingForBestCounterOrder: false,
      feeMethod: order.feeMethod,
      feeRecipient,
      side: (order.side + 1) % 2,
      saleKind: SaleKind.FixedPrice,
      target,
      howToCall: order.howToCall,
      calldata,
      replacementPattern,
      staticTarget: NULL_ADDRESS,
      staticExtradata: '0x',
      paymentToken: order.paymentToken,
      basePrice: order.basePrice,
      extra: makeBigNumber(0),
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: WyvernProtocol.generatePseudoRandomSalt(),
      metadata: order.metadata
    }

    return matchingOrder
  }

  /**
   * Validate against Wyvern that a buy and sell order can match
   * @param param0 __namedParameters Object
   * @param buy The buy order to validate
   * @param sell The sell order to validate
   * @param accountAddress Address for the user's wallet
   * @param shouldValidateBuy Whether to validate the buy order individually.
   * @param shouldValidateSell Whether to validate the sell order individually.
   * @param retries How many times to retry if validation fails
   */
  public async _validateMatch (
    {
      buy,
      sell,
      accountAddress,
      shouldValidateBuy = false,
      shouldValidateSell = false
    }: {
      buy: Order;
      sell: Order;
      accountAddress: string;
      shouldValidateBuy?: boolean;
      shouldValidateSell?: boolean;
    },
    retries = 1
  ): Promise<boolean> {
    try {
      if (shouldValidateBuy) {
        const buyValid = await this._validateOrder(buy)
        this.logger(`Buy order is valid: ${buyValid}`)

        if (!buyValid) {
          throw new Error(
            'Invalid buy order. It may have recently been removed. Please refresh the page and try again!'
          )
        }
      }

      if (shouldValidateSell) {
        const sellValid = await this._validateOrder(sell)
        this.logger(`Sell order is valid: ${sellValid}`)

        if (!sellValid) {
          throw new Error(
            'Invalid sell order. It may have recently been removed. Please refresh the page and try again!'
          )
        }
      }

      const canMatch = await requireOrdersCanMatch(
        this._getClientsForRead({
          retries
        }).wyvernProtocol,
        { buy, sell, accountAddress }
      )
      this.logger(`Orders matching: ${canMatch}`)

      const calldataCanMatch = await requireOrderCalldataCanMatch(
        this._getClientsForRead({
          retries
        }).wyvernProtocol,
        { buy, sell }
      )
      this.logger(`Order calldata matching: ${calldataCanMatch}`)

      return true
    } catch (error) {
      if (retries <= 0) {
        throw new Error(
          `Error matching this listing: ${
            error instanceof Error ? error.message : ''
          }. Please contact the maker or try again later!`
        )
      }
      await delay(500)
      return await this._validateMatch(
        { buy, sell, accountAddress, shouldValidateBuy, shouldValidateSell },
        retries - 1
      )
    }
  }

  // Throws
  public async _sellOrderValidationAndApprovals ({
    order,
    accountAddress
  }: {
    order: UnhashedOrder;
    accountAddress: string;
  }) {
    console.log('_sellOrderValidationAndApprovals')
    const wyAssets =
      'bundle' in order.metadata
        ? order.metadata.bundle.assets
        : order.metadata.asset
          ? [order.metadata.asset]
          : []
    const schemaNames =
      'bundle' in order.metadata && 'schemas' in order.metadata.bundle
        ? order.metadata.bundle.schemas
        : 'schema' in order.metadata
          ? [order.metadata.schema]
          : []
    const tokenAddress = order.paymentToken

    await this._approveAll({
      schemaNames,
      wyAssets,
      accountAddress
    })

    // For fulfilling bids,
    // need to approve access to fungible token because of the way fees are paid
    // This can be done at a higher level to show UI
    if (tokenAddress !== NULL_ADDRESS) {
      const minimumAmount = makeBigNumber(order.basePrice)
      const tokenTransferProxyAddress =
        this._wyvernConfigOverride?.wyvernTokenTransferProxyContractAddress ||
        WyvernProtocol.getTokenTransferProxyAddress(this._networkName)
      await this.approveFungibleToken({
        accountAddress,
        tokenAddress,
        minimumAmount,
        proxyAddress: tokenTransferProxyAddress
      })
    }

    // Check sell parameters
    const sellValid = await this._wyvernProtocol.wyvernExchange
      .validateOrderParameters_(
        [
          order.exchange,
          order.maker,
          order.taker,
          order.feeRecipient,
          order.target,
          order.staticTarget,
          order.paymentToken
        ],
        [
          order.makerRelayerFee,
          order.takerRelayerFee,
          order.makerProtocolFee,
          order.takerProtocolFee,
          order.basePrice,
          order.extra,
          order.listingTime,
          order.expirationTime,
          order.salt
        ],
        order.feeMethod,
        order.side,
        order.saleKind,
        order.howToCall,
        order.calldata,
        order.replacementPattern,
        order.staticExtradata
      )
      .callAsync({ from: accountAddress })
    if (!sellValid) {
      console.error(order)
      throw new Error(
        'Failed to validate sell order parameters. Make sure you\'re on the right network!'
      )
    }
  }

  /**
   * Instead of signing an off-chain order, you can approve an order
   * with on on-chain transaction using this method
   * @param order Order to approve
   * @returns Transaction hash of the approval transaction
   */
  public async approveOrder (order: OrderV2) {
    this._dispatch(EventType.ApproveOrder, {
      orderV2: order,
      accountAddress: order.maker.address
    })

    let transactionHash: string
    switch (order.protocolAddress) {
    case CROSS_CHAIN_SEAPORT_ADDRESS: {
      const transaction = await this.seaport
        .validate([order.protocolData], order.maker.address)
        .transact()
      transactionHash = transaction.hash
      break
    }
    default:
      throw new Error('Unsupported protocol')
    }

    await this._confirmTransaction(
      transactionHash,
      EventType.ApproveOrder,
      'Approving order'
    )

    return transactionHash
  }

  /**
   * Instead of signing an off-chain order, you can approve an order
   * with on on-chain transaction using this method
   * @param order Order to approve
   * @returns Transaction hash of the approval transaction
   */
  public async approveOrderLegacyWyvern (order: UnsignedOrder) {
    const accountAddress = order.maker
    const includeInOrderBook = true

    this._dispatch(EventType.ApproveOrder, { order, accountAddress })

    const transactionHash = await this._wyvernProtocol.wyvernExchange
      .approveOrder_(
        [
          order.exchange,
          order.maker,
          order.taker,
          order.feeRecipient,
          order.target,
          order.staticTarget,
          order.paymentToken
        ],
        [
          order.makerRelayerFee,
          order.takerRelayerFee,
          order.makerProtocolFee,
          order.takerProtocolFee,
          order.basePrice,
          order.extra,
          order.listingTime,
          order.expirationTime,
          order.salt
        ],
        order.feeMethod,
        order.side,
        order.saleKind,
        order.howToCall,
        order.calldata,
        order.replacementPattern,
        order.staticExtradata,
        includeInOrderBook
      )
      .sendTransactionAsync({ from: accountAddress })

    await this._confirmTransaction(
      transactionHash.toString(),
      EventType.ApproveOrder,
      'Approving order',
      async () => {
        const isApproved = await this._validateOrder(order)
        return isApproved
      }
    )

    return transactionHash
  }

  public async _validateOrder (order: Order): Promise<boolean> {
    const isValid = await this._wyvernProtocolReadOnly.wyvernExchange
      .validateOrder_(
        [
          order.exchange,
          order.maker,
          order.taker,
          order.feeRecipient,
          order.target,
          order.staticTarget,
          order.paymentToken
        ],
        [
          order.makerRelayerFee,
          order.takerRelayerFee,
          order.makerProtocolFee,
          order.takerProtocolFee,
          order.basePrice,
          order.extra,
          order.listingTime,
          order.expirationTime,
          order.salt
        ],
        order.feeMethod,
        order.side,
        order.saleKind,
        order.howToCall,
        order.calldata,
        order.replacementPattern,
        order.staticExtradata,
        order.v || 0,
        order.r || NULL_BLOCK_HASH,
        order.s || NULL_BLOCK_HASH
      )
      .callAsync()

    return isValid
  }

  public async _approveAll ({
    schemaNames,
    wyAssets,
    accountAddress,
    proxyAddress
  }: {
    schemaNames: WyvernSchemaName[];
    wyAssets: WyvernAsset[];
    accountAddress: string;
    proxyAddress?: string;
  }) {
    console.log('approve all')
    proxyAddress =
      proxyAddress || (await this._getProxy(accountAddress, 0)) || undefined
    if (!proxyAddress) {
      proxyAddress = await this._initializeProxy(accountAddress)
    }

    console.log('proxy', proxyAddress)
    const contractsWithApproveAll: Set<string> = new Set()

    return Promise.all(
      wyAssets.map(async (wyAsset, i) => {
        const schemaName = schemaNames[i]
        // Verify that the taker owns the asset
        let isOwner
        try {
          isOwner = await this._ownsAssetOnChain({
            accountAddress,
            proxyAddress,
            wyAsset,
            schemaName
          })
        } catch (error) {
          // let it through for assets we don't support yet
          console.debug(error)
          isOwner = true
        }
        if (!isOwner) {
          const minAmount = 'quantity' in wyAsset ? wyAsset.quantity : 1
          console.error(
            `Failed on-chain ownership check: ${accountAddress} on ${schemaName}:`,
            wyAsset
          )
          throw new Error(
            `You don't own enough to do that (${minAmount} base units of ${
              wyAsset.address
            }${wyAsset.id ? ' token ' + wyAsset.id : ''})`
          )
        }
        switch (schemaName) {
        case WyvernSchemaName.ERC721:
        case WyvernSchemaName.ERC721v3:
        case WyvernSchemaName.ERC1155:
        case WyvernSchemaName.LegacyEnjin:
        case WyvernSchemaName.ENSShortNameAuction:
          // Handle NFTs and SFTs
          // eslint-disable-next-line no-case-declarations
          const wyNFTAsset = wyAsset as WyvernNFTAsset
          console.log('approve NFT', wyNFTAsset)
          return await this.approveSemiOrNonFungibleToken({
            tokenId: wyNFTAsset.id.toString(),
            tokenAddress: wyNFTAsset.address,
            accountAddress,
            proxyAddress,
            schemaName,
            skipApproveAllIfTokenAddressIn: contractsWithApproveAll
          })
        case WyvernSchemaName.ERC20:
          console.log('approve ERC20')
          // Handle FTs
          // eslint-disable-next-line no-case-declarations
          const wyFTAsset = wyAsset as WyvernFTAsset
          if (contractsWithApproveAll.has(wyFTAsset.address)) {
            // Return null to indicate no tx occurred
            return null
          }
          contractsWithApproveAll.add(wyFTAsset.address)
          return await this.approveFungibleToken({
            tokenAddress: wyFTAsset.address,
            accountAddress,
            proxyAddress
          })
          // For other assets, including contracts:
          // Send them to the user's proxy
          // if (where !== WyvernAssetLocation.Proxy) {
          //   return this.transferOne({
          //     schemaName: schema.name,
          //     asset: wyAsset,
          //     isWyvernAsset: true,
          //     fromAddress: accountAddress,
          //     toAddress: proxy
          //   })
          // }
          // return true
        }
      })
    )
  }

  // Throws
  public async _buyOrderValidationAndApprovals ({
    order,
    counterOrder,
    accountAddress
  }: {
    order: UnhashedOrder;
    counterOrder?: Order;
    accountAddress: string;
  }) {
    const tokenAddress = order.paymentToken

    if (tokenAddress !== NULL_ADDRESS) {
      /* NOTE: no buy-side auctions for now, so sell.saleKind === 0 */
      let minimumAmount = makeBigNumber(order.basePrice)
      if (counterOrder) {
        minimumAmount = await this._getRequiredAmountForTakingSellOrder(
          counterOrder
        )
      }

      // Check token approval
      // This can be done at a higher level to show UI
      await this.approveFungibleToken({
        accountAddress,
        tokenAddress,
        minimumAmount,
        proxyAddress:
          this._wyvernConfigOverride?.wyvernTokenTransferProxyContractAddress ||
          WyvernProtocol.getTokenTransferProxyAddress(this._networkName)
      })
    }

    // Check order formation
    const buyValid = await this._wyvernProtocolReadOnly.wyvernExchange
      .validateOrderParameters_(
        [
          order.exchange,
          order.maker,
          order.taker,
          order.feeRecipient,
          order.target,
          order.staticTarget,
          order.paymentToken
        ],
        [
          order.makerRelayerFee,
          order.takerRelayerFee,
          order.makerProtocolFee,
          order.takerProtocolFee,
          order.basePrice,
          order.extra,
          order.listingTime,
          order.expirationTime,
          order.salt
        ],
        order.feeMethod,
        order.side,
        order.saleKind,
        order.howToCall,
        order.calldata,
        order.replacementPattern,
        order.staticExtradata
      )
      .callAsync({ from: accountAddress })
    if (!buyValid) {
      console.error(order)
      throw new Error(
        'Failed to validate buy order parameters. Make sure you\'re on the right network!'
      )
    }
  }

  /**
   * Check if an account, or its proxy, owns an asset on-chain
   * @param accountAddress Account address for the wallet
   * @param proxyAddress Proxy address for the account
   * @param wyAsset asset to check. If fungible, the `quantity` attribute will be the minimum amount to own
   * @param schemaName WyvernSchemaName for the asset
   */
  public async _ownsAssetOnChain ({
    accountAddress,
    proxyAddress,
    wyAsset,
    schemaName
  }: {
    accountAddress: string;
    proxyAddress?: string | null;
    wyAsset: WyvernAsset;
    schemaName: WyvernSchemaName;
  }): Promise<boolean> {
    const asset: Asset = {
      tokenId: wyAsset.id || null,
      tokenAddress: wyAsset.address,
      schemaName
    }

    const minAmount = new BigNumber(
      'quantity' in wyAsset ? wyAsset.quantity : 1
    )

    const accountBalance = await this.getAssetBalance({
      accountAddress,
      asset
    })
    if (accountBalance.isGreaterThanOrEqualTo(minAmount)) {
      return true
    }

    proxyAddress = proxyAddress || (await this._getProxy(accountAddress))
    if (proxyAddress) {
      const proxyBalance = await this.getAssetBalance({
        accountAddress: proxyAddress,
        asset
      })
      if (proxyBalance.isGreaterThanOrEqualTo(minAmount)) {
        return true
      }
    }

    return false
  }

  public _getBuyFeeParameters (
    totalBuyerFeeBasisPoints: number,
    totalSellerFeeBasisPoints: number,
    sellOrder?: UnhashedOrder
  ) {
    this._validateFees(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints)

    let makerRelayerFee
    let takerRelayerFee

    if (sellOrder) {
      // Use the sell order's fees to ensure compatiblity and force the order
      // to only be acceptable by the sell order maker.
      // Swap maker/taker depending on whether it's an English auction (taker)
      // TODO add extraBountyBasisPoints when making bidder bounties
      makerRelayerFee = sellOrder.waitingForBestCounterOrder
        ? makeBigNumber(sellOrder.makerRelayerFee)
        : makeBigNumber(sellOrder.takerRelayerFee)
      takerRelayerFee = sellOrder.waitingForBestCounterOrder
        ? makeBigNumber(sellOrder.takerRelayerFee)
        : makeBigNumber(sellOrder.makerRelayerFee)
    } else {
      makerRelayerFee = makeBigNumber(totalBuyerFeeBasisPoints)
      takerRelayerFee = makeBigNumber(totalSellerFeeBasisPoints)
    }

    return {
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee: makeBigNumber(0),
      takerProtocolFee: makeBigNumber(0),
      makerReferrerFee: makeBigNumber(0), // TODO use buyerBountyBPS
      feeRecipient: MARKET_PLACE_FEE_RECIPIENT,
      feeMethod: FeeMethod.SplitFee
    }
  }

  public _getSellFeeParameters (
    totalBuyerFeeBasisPoints: number,
    totalSellerFeeBasisPoints: number,
    waitForHighestBid: boolean,
    sellerBountyBasisPoints = 0
  ) {
    this._validateFees(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints)
    // Use buyer as the maker when it's an English auction, so Wyvern sets prices correctly
    const feeRecipient = waitForHighestBid
      ? NULL_ADDRESS
      : MARKET_PLACE_FEE_RECIPIENT

    // Swap maker/taker fees when it's an English auction,
    // since these sell orders are takers not makers
    const makerRelayerFee = waitForHighestBid
      ? makeBigNumber(totalBuyerFeeBasisPoints)
      : makeBigNumber(totalSellerFeeBasisPoints)
    const takerRelayerFee = waitForHighestBid
      ? makeBigNumber(totalSellerFeeBasisPoints)
      : makeBigNumber(totalBuyerFeeBasisPoints)

    return {
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee: makeBigNumber(0),
      takerProtocolFee: makeBigNumber(0),
      makerReferrerFee: makeBigNumber(sellerBountyBasisPoints),
      feeRecipient,
      feeMethod: FeeMethod.SplitFee
    }
  }

  /**
   * Validate fee parameters
   * @param totalBuyerFeeBasisPoints Total buyer fees
   * @param totalSellerFeeBasisPoints Total seller fees
   */
  private _validateFees (
    totalBuyerFeeBasisPoints: number,
    totalSellerFeeBasisPoints: number
  ) {
    const maxFeePercent = INVERSE_BASIS_POINT / 100

    if (
      totalBuyerFeeBasisPoints > INVERSE_BASIS_POINT ||
      totalSellerFeeBasisPoints > INVERSE_BASIS_POINT
    ) {
      throw new Error(
        `Invalid buyer/seller fees: must be less than ${maxFeePercent}%`
      )
    }

    if (totalBuyerFeeBasisPoints < 0 || totalSellerFeeBasisPoints < 0) {
      throw new Error('Invalid buyer/seller fees: must be at least 0%')
    }
  }

  /**
   * Get the listing and expiration time parameters for a new order
   * @param expirationTimestamp Timestamp to expire the order (in seconds), or 0 for non-expiring
   * @param listingTimestamp Timestamp to start the order (in seconds), or undefined to start it now
   * @param waitingForBestCounterOrder Whether this order should be hidden until the best match is found
   */
  private _getTimeParameters ({
    expirationTimestamp = getMaxOrderExpirationTimestamp(),
    listingTimestamp,
    waitingForBestCounterOrder = false,
    isMatchingOrder = false
  }: {
    expirationTimestamp?: number;
    listingTimestamp?: number;
    waitingForBestCounterOrder?: boolean;
    isMatchingOrder?: boolean;
  }) {
    const maxExpirationTimeStamp = getMaxOrderExpirationTimestamp()

    const minListingTimestamp = Math.round(Date.now() / 1000)

    if (!isMatchingOrder && expirationTimestamp === 0) {
      throw new Error('Expiration time cannot be 0')
    }
    if (listingTimestamp && listingTimestamp < minListingTimestamp) {
      throw new Error('Listing time cannot be in the past.')
    }
    if (listingTimestamp && listingTimestamp >= expirationTimestamp) {
      throw new Error('Listing time must be before the expiration time.')
    }

    if (waitingForBestCounterOrder && listingTimestamp) {
      throw new Error('Cannot schedule an English auction for the future.')
    }
    if (parseInt(expirationTimestamp.toString()) !== expirationTimestamp) {
      throw new Error('Expiration timestamp must be a whole number of seconds')
    }
    if (expirationTimestamp > maxExpirationTimeStamp) {
      throw new Error('Expiration time must not exceed six months from now')
    }

    if (waitingForBestCounterOrder) {
      listingTimestamp = expirationTimestamp
      // Expire one week from now, to ensure server can match it
      // Later, this will expire closer to the listingTime
      expirationTimestamp =
        expirationTimestamp + ORDER_MATCHING_LATENCY_SECONDS

      // The minimum expiration time has to be at least fifteen minutes from now
      const minEnglishAuctionListingTimestamp =
        minListingTimestamp + MIN_EXPIRATION_MINUTES * 60

      if (
        !isMatchingOrder &&
        listingTimestamp < minEnglishAuctionListingTimestamp
      ) {
        throw new Error(
          `Expiration time must be at least ${MIN_EXPIRATION_MINUTES} minutes from now`
        )
      }
    } else {
      // Small offset to account for latency
      listingTimestamp =
        listingTimestamp || Math.round(Date.now() / 1000 - 100)

      // The minimum expiration time has to be at least fifteen minutes from now
      const minExpirationTimestamp =
        listingTimestamp + MIN_EXPIRATION_MINUTES * 60

      if (!isMatchingOrder && expirationTimestamp < minExpirationTimestamp) {
        throw new Error(
          `Expiration time must be at least ${MIN_EXPIRATION_MINUTES} minutes from the listing date`
        )
      }
    }

    return {
      listingTime: makeBigNumber(listingTimestamp),
      expirationTime: makeBigNumber(expirationTimestamp)
    }
  }

  /**
   * Compute the `basePrice` and `extra` parameters to be used to price an order.
   * Also validates the expiration time and auction type.
   * @param tokenAddress Address of the ERC-20 token to use for trading.
   * Use the null address for ETH
   * @param expirationTime When the auction expires, or 0 if never.
   * @param startAmount The base value for the order, in the token's main units (e.g. ETH instead of wei)
   * @param endAmount The end value for the order, in the token's main units (e.g. ETH instead of wei). If unspecified, the order's `extra` attribute will be 0
   */
  private async _getPriceParameters (
    orderSide: OrderSide,
    tokenAddress: string,
    expirationTime: BigNumber,
    startAmount: BigNumber,
    network: string,
    endAmount?: BigNumber,
    waitingForBestCounterOrder = false,
    englishAuctionReservePrice?: BigNumber
  ) {
    const priceDiff =
      endAmount !== null && endAmount !== undefined ? startAmount.minus(endAmount) : new BigNumber(0)
    const paymentToken = tokenAddress.toLowerCase()
    const isEther = tokenAddress === NULL_ADDRESS
    const token = await this.api.getGameFiPaymentTokens(tokenAddress, network)

    // Validation
    if (startAmount.isNaN() || startAmount === null || startAmount.lt(0)) {
      throw new Error('Starting price must be a number >= 0')
    }
    if (!isEther && !token) {
      throw new Error(`No ERC-20 token found for '${paymentToken}'`)
    }
    if (isEther && waitingForBestCounterOrder) {
      throw new Error(
        'English auctions must use wrapped ETH or an ERC-20 token.'
      )
    }
    if (isEther && orderSide === OrderSide.Buy) {
      throw new Error('Offers must use wrapped ETH or an ERC-20 token.')
    }
    if (priceDiff.lt(0)) {
      throw new Error(
        'End price must be less than or equal to the start price.'
      )
    }
    if (priceDiff.gt(0) && expirationTime.eq(0)) {
      throw new Error(
        'Expiration time must be set if order will change in price.'
      )
    }
    if (
      englishAuctionReservePrice &&
      !englishAuctionReservePrice.isZero() &&
      !waitingForBestCounterOrder
    ) {
      throw new Error('Reserve prices may only be set on English auctions.')
    }
    if (
      englishAuctionReservePrice &&
      !englishAuctionReservePrice.isZero() &&
      englishAuctionReservePrice < startAmount
    ) {
      throw new Error(
        'Reserve price must be greater than or equal to the start amount.'
      )
    }

    // Note: WyvernProtocol.toBaseUnitAmount(makeBigNumber(startAmount), token.decimals)
    // will fail if too many decimal places, so special-case ether
    const basePrice = isEther
      ? makeBigNumber(
        this.web3.utils.toWei(startAmount.toString(), 'ether')
      ).integerValue()
      : WyvernProtocol.toBaseUnitAmount(startAmount, token.decimals)

    const endPrice = endAmount
      ? isEther
        ? makeBigNumber(
          this.web3.utils.toWei(endAmount.toString(), 'ether')
        ).integerValue()
        : WyvernProtocol.toBaseUnitAmount(endAmount, token.decimals)
      : undefined

    const extra = isEther
      ? makeBigNumber(
        this.web3.utils.toWei(priceDiff.toString(), 'ether')
      ).integerValue()
      : WyvernProtocol.toBaseUnitAmount(priceDiff, token.decimals)

    const reservePrice = englishAuctionReservePrice
      ? isEther
        ? makeBigNumber(
          this.web3.utils.toWei(
            englishAuctionReservePrice.toString(),
            'ether'
          )
        ).integerValue()
        : WyvernProtocol.toBaseUnitAmount(
          englishAuctionReservePrice,
          token.decimals
        )
      : undefined

    return { basePrice, extra, paymentToken, reservePrice, endPrice }
  }

  private _getMetadata (order: Order, referrerAddress?: string) {
    const referrer = referrerAddress || order.metadata.referrerAddress
    if (referrer && isValidAddress(referrer)) {
      return referrer
    }
    return undefined
  }

  private async _atomicMatch ({
    buy,
    sell,
    accountAddress,
    metadata = NULL_BLOCK_HASH
  }: {
    buy: Order;
    sell: Order;
    accountAddress: string;
    metadata?: string;
  }) {
    let value
    let shouldValidateBuy = true
    let shouldValidateSell = true

    // Only check buy, but shouldn't matter as they should always be equal
    if (sell.maker.toLowerCase() === accountAddress.toLowerCase()) {
      // USER IS THE SELLER, only validate the buy order
      await this._sellOrderValidationAndApprovals({
        order: sell,
        accountAddress
      })
      shouldValidateSell = false
    } else if (buy.maker.toLowerCase() === accountAddress.toLowerCase()) {
      // USER IS THE BUYER, only validate the sell order
      await this._buyOrderValidationAndApprovals({
        order: buy,
        counterOrder: sell,
        accountAddress
      })
      shouldValidateBuy = false

      // If using ETH to pay, set the value of the transaction to the current price
      if (buy.paymentToken === NULL_ADDRESS) {
        value = await this._getRequiredAmountForTakingSellOrder(sell)
      }
    } else {
      // User is neither - matching service
    }

    await this._validateMatch({
      buy,
      sell,
      accountAddress,
      shouldValidateBuy,
      shouldValidateSell
    })

    this._dispatch(EventType.MatchOrders, {
      buy,
      sell,
      accountAddress,
      matchMetadata: metadata
    })

    let txHash
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txnData: any = { from: accountAddress, value }
    const args: WyvernAtomicMatchParameters = [
      [
        buy.exchange,
        buy.maker,
        buy.taker,
        buy.feeRecipient,
        buy.target,
        buy.staticTarget,
        buy.paymentToken,
        sell.exchange,
        sell.maker,
        sell.taker,
        sell.feeRecipient,
        sell.target,
        sell.staticTarget,
        sell.paymentToken
      ],
      [
        buy.makerRelayerFee,
        buy.takerRelayerFee,
        buy.makerProtocolFee,
        buy.takerProtocolFee,
        buy.basePrice,
        buy.extra,
        buy.listingTime,
        buy.expirationTime,
        buy.salt,
        sell.makerRelayerFee,
        sell.takerRelayerFee,
        sell.makerProtocolFee,
        sell.takerProtocolFee,
        sell.basePrice,
        sell.extra,
        sell.listingTime,
        sell.expirationTime,
        sell.salt
      ],
      [
        buy.feeMethod,
        buy.side,
        buy.saleKind,
        buy.howToCall,
        sell.feeMethod,
        sell.side,
        sell.saleKind,
        sell.howToCall
      ],
      buy.calldata,
      sell.calldata,
      buy.replacementPattern,
      sell.replacementPattern,
      buy.staticExtradata,
      sell.staticExtradata,
      [buy.v || 0, sell.v || 0],
      [
        buy.r || NULL_BLOCK_HASH,
        buy.s || NULL_BLOCK_HASH,
        sell.r || NULL_BLOCK_HASH,
        sell.s || NULL_BLOCK_HASH,
        metadata
      ]
    ]

    // Estimate gas first
    try {
      // Typescript splat doesn't typecheck
      const gasEstimate = 300000

      txnData.gas = this._correctGasAmount(gasEstimate)
    } catch (error) {
      console.error('Failed atomic match with args: ', args, error)
      throw new Error(
        `Oops, the network rejected this transaction :( The exact error was "${
          error instanceof Error
            ? error.message.substr(0, MAX_ERROR_LENGTH)
            : 'unknown'
        }..."`
      )
    }

    // Then do the transaction
    try {
      this.logger(`Fulfilling order with gas set to ${txnData.gas}`)
      txHash = await this._wyvernProtocol.wyvernExchange
        .atomicMatch_(
          args[0],
          args[1],
          args[2],
          args[3],
          args[4],
          args[5],
          args[6],
          args[7],
          args[8],
          args[9],
          args[10]
        )
        .sendTransactionAsync(txnData)
    } catch (error) {
      console.error(error)

      this._dispatch(EventType.TransactionDenied, {
        error,
        buy,
        sell,
        accountAddress,
        matchMetadata: metadata
      })

      throw new Error(
        `Failed to authorize transaction: "${
          error instanceof Error && error.message
            ? error.message
            : 'user denied'
        }..."`
      )
    }
    return txHash
  }

  private async _getRequiredAmountForTakingSellOrder (sell: Order) {
    const currentPrice = await this.getCurrentPriceLegacyWyvern(sell)
    const estimatedPrice = estimateCurrentPrice(sell)

    const maxPrice = BigNumber.max(currentPrice, estimatedPrice)

    // TODO Why is this not always a big number?
    sell.takerRelayerFee = makeBigNumber(sell.takerRelayerFee)
    const feePercentage = sell.takerRelayerFee.div(INVERSE_BASIS_POINT)
    const fee = feePercentage.times(maxPrice)
    return fee.plus(maxPrice).integerValue(BigNumber.ROUND_CEIL)
  }

  /**
   * Gets the current order nonce for an account
   * @param accountAddress account to check the nonce for
   * @returns nonce
   */
  public getNonce (accountAddress: string) {
    return this._wyvernProtocol.wyvernExchange
      .nonces(accountAddress)
      .callAsync()
  }

  /**
   * Generate the signature for authorizing an order
   * @param order Unsigned wyvern order
   * @returns order signature in the form of v, r, s, also an optional nonce
   */
  public async authorizeOrder (
    order: UnsignedOrder
  ): Promise<(ECSignature & { nonce?: number }) | null> {
    const signerAddress = order.maker

    this._dispatch(EventType.CreateOrder, {
      order,
      accountAddress: order.maker
    })

    try {
      // 2.3 Sign order flow using EIP-712
      const signerOrderNonce = await this.getNonce(signerAddress)

      // We need to manually specify each field because OS orders can contain unrelated data
      const orderForSigning: RawWyvernOrderJSON = {
        maker: order.maker,
        exchange: order.exchange,
        taker: order.taker,
        makerRelayerFee: order.makerRelayerFee.toString(),
        takerRelayerFee: order.takerRelayerFee.toString(),
        makerProtocolFee: order.makerProtocolFee.toString(),
        takerProtocolFee: order.takerProtocolFee.toString(),
        feeRecipient: order.feeRecipient,
        feeMethod: order.feeMethod,
        side: order.side,
        saleKind: order.saleKind,
        target: order.target,
        howToCall: order.howToCall,
        calldata: order.calldata,
        replacementPattern: order.replacementPattern,
        staticTarget: order.staticTarget,
        staticExtradata: order.staticExtradata,
        paymentToken: order.paymentToken,
        basePrice: order.basePrice.toString(),
        extra: order.extra.toString(),
        listingTime: order.listingTime.toString(),
        expirationTime: order.expirationTime.toString(),
        salt: order.salt.toString()
      }

      // We don't JSON.stringify as certain wallet providers sanitize this data
      // https://github.com/coinbase/coinbase-wallet-sdk/issues/60
      const message = {
        types: EIP_712_ORDER_TYPES,
        domain: {
          name: EIP_712_WYVERN_DOMAIN_NAME,
          version: EIP_712_WYVERN_DOMAIN_VERSION,
          chainId: this._network_chain_id,
          verifyingContract: order.exchange
        },
        primaryType: 'Order',
        message: { ...orderForSigning, nonce: signerOrderNonce.toNumber() }
      }

      const ecSignature = await signTypedDataAsync(
        this.web3,
        message,
        signerAddress,
        this.signer
      )

      console.log('ecSignature', ecSignature)

      return { ...ecSignature, nonce: signerOrderNonce.toNumber() }
    } catch (error) {
      this._dispatch(EventType.OrderDenied, {
        order,
        accountAddress: signerAddress
      })
      throw error
    }
  }

  private _getSchemaName (asset: Asset | OpenSeaAsset) {
    if (asset.schemaName) {
      return asset.schemaName
    } else if ('assetContract' in asset) {
      return asset.assetContract.schemaName
    }

    return undefined
  }

  private _getSchema (schemaName?: WyvernSchemaName): Schema<WyvernAsset> {
    const schemaName_ = schemaName || WyvernSchemaName.ERC721
    const schema = WyvernSchemas.schemas[this._networkName].filter(
      (s) => s.name === schemaName_
    )[0]

    if (!schema) {
      throw new Error(
        `Trading for this asset (${schemaName_}) is not yet supported. Please contact us or check back later!`
      )
    }
    return schema
  }

  private _dispatch (event: EventType, data: EventData) {
    this._emitter.emit(event, data)
  }

  /**
   * Get the clients to use for a read call
   * @param retries current retry value
   * @param wyvernProtocol optional wyvern protocol to use, has default
   * @param wyvernProtocol optional readonly wyvern protocol to use, has default
   */
  private _getClientsForRead ({ retries }: { retries: number }): {
    web3: Web3;
    wyvernProtocol: WyvernProtocol;
  } {
    if (retries > 0) {
      // Use injected provider by default
      return {
        web3: this.web3,
        wyvernProtocol: this._wyvernProtocol
      }
    } else {
      // Use provided provider as fallback
      return {
        web3: this.web3ReadOnly,
        wyvernProtocol: this._wyvernProtocolReadOnly
      }
    }
  }

  private async _confirmTransaction (
    transactionHash: string,
    event: EventType,
    description: string,
    testForSuccess?: () => Promise<boolean>
  ): Promise<void> {
    const transactionEventData = { transactionHash, event }
    this.logger(`Transaction started: ${description}`)

    if (transactionHash === NULL_BLOCK_HASH) {
      // This was a smart contract wallet that doesn't know the transaction
      this._dispatch(EventType.TransactionCreated, { event })

      if (!testForSuccess) {
        // Wait if test not implemented
        this.logger(`Unknown action, waiting 1 minute: ${description}`)
        await delay(60 * 1000)
        return
      }

      return await this._pollCallbackForConfirmation(
        event,
        description,
        testForSuccess
      )
    }

    // Normal wallet
    try {
      this._dispatch(EventType.TransactionCreated, transactionEventData)
      await confirmTransaction(this.web3, transactionHash)
      this.logger(`Transaction succeeded: ${description}`)
      this._dispatch(EventType.TransactionConfirmed, transactionEventData)
    } catch (error) {
      this.logger(`Transaction failed: ${description}`)
      this._dispatch(EventType.TransactionFailed, {
        ...transactionEventData,
        error
      })
      throw error
    }
  }

  private async _pollCallbackForConfirmation (
    event: EventType,
    description: string,
    testForSuccess: () => Promise<boolean>
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const initialRetries = 60

      const testResolve: (r: number) => Promise<void> = async (retries) => {
        const wasSuccessful = await testForSuccess()
        if (wasSuccessful) {
          this.logger(`Transaction succeeded: ${description}`)
          this._dispatch(EventType.TransactionConfirmed, { event })
          resolve()
          return
        } else if (retries <= 0) {
          reject(new Error('invalid'))
          return
        }

        if (retries % 10 === 0) {
          this.logger(
            `Tested transaction ${
              initialRetries - retries + 1
            } times: ${description}`
          )
        }
        await delay(5000)
        testResolve(retries - 1)
      }

      testResolve(initialRetries)
    })
  }

  /**
   * Returns whether or not an authenticated proxy is revoked for a specific account address
   * @param accountAddress
   * @returns
   */
  public async isAuthenticatedProxyRevoked (
    accountAddress: string
  ): Promise<boolean> {
    const proxy = await this._wyvernProtocol.getAuthenticatedProxy(
      accountAddress
    )

    return proxy.revoked().callAsync()
  }

  /**
   * Revokes an authenticated proxy's access i.e. for freezing listings
   * @param accountAddress
   * @returns transaction hash
   */
  public async revokeAuthenticatedProxyAccess (
    accountAddress: string
  ): Promise<string> {
    const proxy = await this._wyvernProtocol.getAuthenticatedProxy(
      accountAddress
    )
    return proxy.setRevoke(true).sendTransactionAsync({ from: accountAddress })
  }

  /**
   * Unrevokes an authenticated proxy's access i.e. for unfreezing listings
   * @param accountAddress
   * @returns transaction hash
   */
  public async unrevokeAuthenticatedProxyAccess (
    accountAddress: string
  ): Promise<string> {
    const proxy = await this._wyvernProtocol.getAuthenticatedProxy(
      accountAddress
    )
    return proxy.setRevoke(false).sendTransactionAsync({
      from: accountAddress
    })
  }
}
