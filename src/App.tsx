/* eslint-disable @typescript-eslint/no-explicit-any */
import './App.css'
import { Alert, Button, Input, Layout, Table } from 'antd'
import Uploader from './components/Uploader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse'
import toast, { Toaster } from 'react-hot-toast'
import type { ColumnsType } from 'antd/es/table'
import { Network, WyvernSchemaName } from 'opensea-js/lib/types';
import { SDK } from './components/sdk';
import { ethers } from 'ethers';
import Web3 from 'web3';
import React from 'react';
import Spinner from 'react-spinner-material'
const { Header, Content } = Layout
import ERC20_ABI from './abi/ERC20.json'
import ERC721_ABI from './abi/ERC721.json'
import Link from "antd/lib/typography/Link";
import { red } from '@ant-design/colors'
import { API_NFT_URL } from "./components/sdk/utils";
import { CONTRACTS_1, CONTRACTS_137, CONTRACTS_43114, CONTRACTS_56, CONTRACTS_80001 } from "./components/sdk/types";

const PRIVATE_KEY = process.env.REACT_APP_PRIVATE_KEY
const RPC_URL_1 = process.env.REACT_APP_RPC_1
const RPC_URL_56 = process.env.REACT_APP_RPC_56
const RPC_URL_137 = process.env.REACT_APP_RPC_137
const RPC_URL_43114 = process.env.REACT_APP_RPC_43114
const RPC_URL_80001 = process.env.REACT_APP_RPC_80001


function App() {
  const [assets, setAssets] = useState<any>([])
  const [started, setStarted] = useState(false)
  const [finishedItems, setFinishedItems] = useState([])
  const [failedItems, setFailedItems] = useState([])
  const [receiverAddress, setReceiverAddress] = useState('')

  const previewColumns: ColumnsType<any> = [
    {
      title: 'Token ID',
      dataIndex: 'gamefiAsset',
      key: 'id',
      render: data => <div>{data?.token_id}</div>
    },
    {
      title: 'Token Address',
      dataIndex: 'gamefiAsset',
      key: 'address',
      render: data => <div>{data?.asset_contract?.address}</div>
    },
    {
      title: 'Network',
      dataIndex: 'network'
    },
    {
      title: 'Price',
      dataIndex: 'price'
    },
    {
      title: 'Payment Token',
      dataIndex: 'paymentToken'
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        return (
          started ? (finishedItems.findIndex(item => item.gamefiAsset.token_id === record.gamefiAsset.token_id && item.gamefiAsset.asset_contract.address === record.gamefiAsset.asset_contract.address) >= 0 ? <div>Done</div> :
          failedItems.findIndex(item => item.gamefiAsset.token_id === record.gamefiAsset.token_id && item.gamefiAsset.asset_contract.address === record.gamefiAsset.asset_contract.address) >= 0 ? <div>Done</div> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner radius={20} stroke={2}></Spinner>
        </div>) : <div></div>
        )
      },
    },
  ]

  const parseFile = useCallback((file: File) => {
    const fileExtension = file?.type?.split("/")[1]
    if (fileExtension !== 'csv') {
        toast.error("Please input a csv file")
        return
    }
    if (!file) return

    const reader = new FileReader()
    reader.onload = async ({ target } : { target: any }) => {
      const list = []
      const csv = Papa.parse(target.result, { header: true })
      const parsedData = csv?.data
      parsedData.slice(0, parsedData?.length - 1).forEach((data: any) => {
        list.push({
          gamefiAsset: {
            asset_contract: {
              address: data?.address,
              network: data?.network
            },
            token_id: data?.id
          },
          network: data?.network,
          paymentToken: data?.payment,
          price: data?.price
        })
      })

      setAssets(list)
      // setItems(rows)
      // console.log(rows)
  };
  reader.readAsText(file);
  }, [setAssets])


  const marketProvider56 = new Web3.providers.HttpProvider(RPC_URL_56)
  const provider56 = new ethers.providers.JsonRpcProvider(RPC_URL_56)
  const wallet56 = new ethers.Wallet(PRIVATE_KEY, provider56)

  const marketProvider1 = new Web3.providers.HttpProvider(RPC_URL_1)
  const provider1 = new ethers.providers.JsonRpcProvider(RPC_URL_1)
  const wallet1 = new ethers.Wallet(PRIVATE_KEY, provider1)

  const marketProvider137 = new Web3.providers.HttpProvider(RPC_URL_137)
  const provider137 = new ethers.providers.JsonRpcProvider(RPC_URL_137)
  const wallet137 = new ethers.Wallet(PRIVATE_KEY, provider137)

  const marketProvider80001 = new Web3.providers.HttpProvider(RPC_URL_80001)
  const provider80001 = new ethers.providers.JsonRpcProvider(RPC_URL_80001)
  const wallet80001 = new ethers.Wallet(PRIVATE_KEY, provider80001)

  const marketProvider43114 = new Web3.providers.HttpProvider(RPC_URL_43114)
  const provider43114 = new ethers.providers.JsonRpcProvider(RPC_URL_43114)
  const wallet43114 = new ethers.Wallet(PRIVATE_KEY, provider43114)

  const approveAllTokens = useCallback(async (tokenAddresses: string[]) => {
    tokenAddresses.forEach(async address => {
      if (address.toLowerCase() === '0xe9e7cea3dedca5984780bafc599bd69add087d56') { // BUSD
        const signer = wallet56.connect(provider56)
        const tokenContract = new ethers.Contract(address, ERC20_ABI, signer)
        await tokenContract.approve(CONTRACTS_56.wyvernTokenTransferProxyContractAddress, ethers.constants.MaxUint256)
      }

      if (address.toLowerCase() === '0xdAC17F958D2ee523a2206206994597C13D831ec7') { // USDT
        const signer = wallet1.connect(provider1)
        const tokenContract = new ethers.Contract(address, ERC20_ABI, signer)
        await tokenContract.approve(CONTRACTS_1.wyvernTokenTransferProxyContractAddress, ethers.constants.MaxUint256)
      }

      if (address.toLowerCase() === '0xc2132d05d31c914a87c6611c10748aeb04b58e8f') { // USDT
        const signer = wallet137.connect(provider137)
        const tokenContract = new ethers.Contract(address, ERC20_ABI, signer)
        await tokenContract.approve(CONTRACTS_137.wyvernTokenTransferProxyContractAddress, ethers.constants.MaxUint256)
      }

      if (address.toLowerCase() === '0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e') { // USDT
        const signer = wallet80001.connect(provider80001)
        const tokenContract = new ethers.Contract(address, ERC20_ABI, signer)
        await tokenContract.approve(CONTRACTS_80001.wyvernTokenTransferProxyContractAddress, ethers.constants.MaxUint256)
      }

      if (address.toLowerCase() === '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7') { // USDT
        const signer = wallet43114.connect(provider43114)
        const tokenContract = new ethers.Contract(address, ERC20_ABI, signer)
        await tokenContract.approve(CONTRACTS_43114.wyvernTokenTransferProxyContractAddress, ethers.constants.MaxUint256)
      }
    })
  }, [wallet56, wallet1, wallet137, wallet43114, provider1, provider56, provider137, provider43114])

  const sdkBSC = useMemo(() => {
    const signer = wallet56.connect(provider56)
    return new SDK(marketProvider56, signer, {
      networkName: Network.Main,
      wyvernConfig: {
        network: Network.Main,
        wyvernExchangeContractAddress: CONTRACTS_56.wyvernExchangeContractAddress,
        wyvernProxyRegistryContractAddress: CONTRACTS_56.wyvernProxyRegistryContractAddress,
        wyvernDAOContractAddress: CONTRACTS_56.wyvernDAOContractAddress,
        wyvernTokenContractAddress: CONTRACTS_56.wyvernTokenContractAddress,
        wyvernTokenTransferProxyContractAddress: CONTRACTS_56.wyvernTokenTransferProxyContractAddress,
        wyvernAtomicizerContractAddress: CONTRACTS_56.wyvernAtomicizerContractAddress
      },
      useReadOnlyProvider: false
    }, 56, (e) => console.log(e))
  }, [wallet56, provider56, marketProvider56])

  const sdkPolygon = useMemo(() => {
    const signer = wallet137.connect(provider137)
    return new SDK(marketProvider137, signer, {
      networkName: Network.Main,
      wyvernConfig: {
        network: Network.Main,
        wyvernExchangeContractAddress: CONTRACTS_137.wyvernExchangeContractAddress,
        wyvernProxyRegistryContractAddress: CONTRACTS_137.wyvernProxyRegistryContractAddress,
        wyvernDAOContractAddress: CONTRACTS_137.wyvernDAOContractAddress,
        wyvernTokenContractAddress: CONTRACTS_137.wyvernTokenContractAddress,
        wyvernTokenTransferProxyContractAddress: CONTRACTS_137.wyvernTokenTransferProxyContractAddress,
        wyvernAtomicizerContractAddress: CONTRACTS_137.wyvernAtomicizerContractAddress
      },
      useReadOnlyProvider: false
    }, 137, (e) => console.log(e))
  }, [wallet137, provider137, marketProvider137])
  
  const sdkMumbai = useMemo(() => {
    const signer = wallet80001.connect(provider80001)
    return new SDK(marketProvider80001, signer, {
      networkName: Network.Main,
      wyvernConfig: {
        network: Network.Main,
        wyvernExchangeContractAddress: CONTRACTS_80001.wyvernExchangeContractAddress,
        wyvernProxyRegistryContractAddress: CONTRACTS_80001.wyvernProxyRegistryContractAddress,
        wyvernDAOContractAddress: CONTRACTS_80001.wyvernDAOContractAddress,
        wyvernTokenContractAddress: CONTRACTS_80001.wyvernTokenContractAddress,
        wyvernTokenTransferProxyContractAddress: CONTRACTS_80001.wyvernTokenTransferProxyContractAddress,
        wyvernAtomicizerContractAddress: CONTRACTS_80001.wyvernAtomicizerContractAddress
      },
      useReadOnlyProvider: false
    }, 80001, (e) => console.log(e))
  }, [wallet80001, provider80001, marketProvider80001])

  const sdkETH = useMemo(() => {
    const signer = wallet1.connect(provider1)
    return new SDK(marketProvider1, signer, {
      networkName: Network.Main,
      wyvernConfig: {
        network: Network.Main,
        wyvernExchangeContractAddress: CONTRACTS_1.wyvernExchangeContractAddress,
        wyvernProxyRegistryContractAddress: CONTRACTS_1.wyvernProxyRegistryContractAddress,
        wyvernDAOContractAddress: CONTRACTS_1.wyvernDAOContractAddress,
        wyvernTokenContractAddress: CONTRACTS_1.wyvernTokenContractAddress,
        wyvernTokenTransferProxyContractAddress: CONTRACTS_1.wyvernTokenTransferProxyContractAddress,
        wyvernAtomicizerContractAddress: CONTRACTS_1.wyvernAtomicizerContractAddress
      },
      useReadOnlyProvider: false
    }, 1, (e) => console.log(e))
  }, [wallet1, provider1, marketProvider1])

  const sdkAvax = useMemo(() => {
    const signer = wallet43114.connect(provider43114)
    return new SDK(marketProvider43114, signer, {
      networkName: Network.Main,
      wyvernConfig: {
        network: Network.Main,
        wyvernExchangeContractAddress: CONTRACTS_43114.wyvernExchangeContractAddress,
        wyvernProxyRegistryContractAddress: CONTRACTS_43114.wyvernProxyRegistryContractAddress,
        wyvernDAOContractAddress: CONTRACTS_43114.wyvernDAOContractAddress,
        wyvernTokenContractAddress: CONTRACTS_43114.wyvernTokenContractAddress,
        wyvernTokenTransferProxyContractAddress: CONTRACTS_43114.wyvernTokenTransferProxyContractAddress,
        wyvernAtomicizerContractAddress: CONTRACTS_43114.wyvernAtomicizerContractAddress
      },
      useReadOnlyProvider: false
    }, 43114, (e) => console.log(e))
  }, [wallet43114, provider43114, marketProvider43114])

  const getSDK = useCallback((network) => {
    switch (network?.toLowerCase()) {
      case 'bsc':
        return sdkBSC
      case 'matic':
        return sdkPolygon
      case 'eth':
        return sdkETH
      case 'avalanche':
        return sdkAvax
      case 'mumbai':
        return sdkMumbai
      default:
        return null
    }
  }, [sdkBSC, sdkAvax, sdkETH, sdkPolygon, sdkMumbai])

  const getWallet = useCallback((network) => {
    switch (network?.toLowerCase()) {
      case 'bsc':
        return wallet56
      case 'matic':
        return wallet137
      case 'eth':
        return wallet1
      case 'avalanche':
        return wallet43114
      case 'mumbai':
        return wallet80001
      default:
        return null
    }
  }, [wallet56, wallet137, wallet1, wallet43114, wallet80001])

  const createSellOrder = useCallback(async (item, wallet: ethers.Wallet) => {
    const sdk = getSDK(item?.network)
    if (!sdk) return
    if (!item?.gamefiAsset || !item?.network || !item?.price || !item?.paymentToken) {
      console.log('missing data to list the item', item)
      return
    }
    // const toasting = toast.loading('Listing...')
    // console.log(toasting)
    await sdk.createSellOrderLegacyWyvern({
      asset: {
        tokenId: item.gamefiAsset.token_id,
        tokenAddress: item.gamefiAsset.asset_contract.address,
        schemaName: WyvernSchemaName.ERC721,
        network: item.network
      },
      gamefiAsset: item.gamefiAsset,
      accountAddress: wallet.address,
      // Value of the offer, in units of the payment token (or wrapped ETH if none is specified):
      startAmount: Number(item.price),
      network: item.network,
      paymentTokenAddress: item.paymentToken,
      expirationTime: Math.round(new Date().getTime() / 1000) + 3 * 30 * 24 * 60 * 60
    }).then(res => {
      if (res) {
        console.log('Done', res)
        setFinishedItems(old => [...old, item])
      }
    })
    .catch(e => {
      // toast.dismiss(toasting)
      console.log(e)
      setFailedItems(old => [...old, item])
    })
  }, [assets, getSDK, setFinishedItems, setFailedItems])
  useEffect(() => {
    console.log(finishedItems)
  }, [finishedItems])

  function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }

  const handleListing = useCallback(async () => {
    if (!assets?.length) return

    const tokens = assets.map(item => item.paymentToken).filter(onlyUnique)
    console.log('tokens', tokens)

    const toasting = toast.loading('Approving Tokens')
    // await approveAllTokens(tokens)

    toast.dismiss(toasting)

    // for (let i = 0; i < assets.length; i += 5) {
    //   const promises = []
    //   for (let j = i; j < i + 5; j++) {
    //     promises.push(new Promise((resolve, reject) => {
    //       console.log(assets[j])
    //       return createSellOrder(assets[j], getWallet(assets[j]?.network)).finally(() => resolve(null))
    //    }))
    //   }
    //   await Promise.all(promises).then(res => console.log('Done 1'))
    // }

    for (let i = 0; i < assets?.length; i++) {
      await createSellOrder(assets[i], getWallet(assets[i]?.network))
    }
  }, [assets, getWallet])

  const transferAll = useCallback(async (items, network) => {
    const sdk = getSDK(network)
    if (!sdk) return

    for (let i = 0; i < items.length; i++) {
      await sdk.transfer({
        asset: {
          tokenId: items[i].gamefiAsset.token_id,
          tokenAddress: items[i].gamefiAsset.asset_contract.address,
          schemaName: WyvernSchemaName.ERC721,
          network: items[i].network
        },
        fromAddress: wallet56.address,
        toAddress: receiverAddress
      }).then(res => {
        if (res) {
          console.log('Done', items[i], res)
          fetch(`${API_NFT_URL}/asset/notify_update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              asset_address: items[i].gamefiAsset.asset_contract.address,
              asset_id: items[i].gamefiAsset.token_id,
              network: 'bsc',
              transaction_hash: res
            })
          }).then(res => console.log('update asset', res))
          setFinishedItems(old => [...old, items[i]])
        }
      })
      .catch(e => {
        // toast.dismiss(toasting)
        console.log(e)
        setFailedItems(old => [...old, items[i]])
      })
    }
  }, [assets, getSDK, setFinishedItems, receiverAddress, wallet56])

  const handleTransferAll = useCallback(async () => {
    if (!assets?.length) return

    await transferAll(assets, 'bsc')
  }, [assets, transferAll])

  const handleFavorite = useCallback(async (item) => {
    const signature = await wallet56.connect(provider56).signMessage('Gamefi Signature')
    return await fetch(`${API_NFT_URL}/favorite/post`, {
      method: 'POST',
      body: JSON.stringify({
        network: item.network,
        token: item.gamefiAsset.asset_contract.address,
        token_id: item.gamefiAsset.token_id
      }),
      headers: {
        'x-signature': signature,
        'x-wallet-address': wallet56.address,
        'x-msg-signature': 'Gamefi Signature',
        'Content-Type': 'application/json'
      }
    }).then(() => {
      setFinishedItems(old => [...old, item])
    }).catch(e => console.log(e))
  }, [setFinishedItems])

  const handleFavoriteAll = useCallback(async () => {
    if (!assets?.length) return

    assets.forEach(async (asset) => await handleFavorite(asset))
  }, [assets])

  return (
    <Layout className="layout">
    <Header>
      <div className="logo text-white">Tools</div>
    </Header>
    <Content>
      <div className="site-layout-content" style={{ minHeight: '100vh' }}>
        <div className="container">
          {/* <div style={{ color: red.primary, marginBottom: '10px' }}>Warning: If your account has not listed any item have the same network with your NFT on GameFi.org Digital Collectibles before, you should manually list 1 item on the website before using this tool</div> */}
          <div style={{ marginBottom: '10px' }}>1. Upload CSV file following <Link href="/demo.csv" download>this format</Link></div>
          <ul>
              <li>Network can be: bsc, eth, matic, avalanche</li>
              <li>Payment is the payment token used for the listing, for now we are accepting <Link href="/tokens.csv" download>these tokens</Link></li>
            </ul>
          <div className="csv-upload-container">
            <div style={{ width: '300px', marginBottom: '14px' }}>
              <Uploader onChange={(file) => {
                parseFile(file)
              }}></Uploader>
            </div>
            {
              assets &&  <Table dataSource={assets.map(asset => ({ ...asset, key: `${asset.gamefiAsset?.token_id}-${asset.gamefiAsset?.asset_contract?.address}` }))} columns={previewColumns}></Table>
            }
          </div>
          <div style={{ marginBottom: '10px' }}>2. After checking asset format, click button below to start bulk listing to the marketplace:</div>
          <Button onClick={() => {
            handleListing()
            setStarted(true)
          }}>Start Listing</Button>
          {/* <div style={{ marginBottom: '10px', marginTop: '10px' }}>3. Transfer All</div>
          <Input value={receiverAddress} onChange={e => setReceiverAddress(e?.target?.value || '')} style={{ marginBottom: '10px' }} placeholder="Receiver Address"></Input>
          <Button type="primary" onClick={() => {
            handleTransferAll()
            setStarted(true)
          }}>Transfer</Button>
          <div style={{ marginBottom: '10px', marginTop: '10px' }}>3. Favorite All</div>
          <Button type="primary" onClick={() => {
            handleFavoriteAll()
            setStarted(true)
          }}>Favorite All</Button> */}
        </div>
      </div>
      <Toaster></Toaster>
    </Content>
  </Layout>
  )
}

export default App;
