/* eslint-disable @typescript-eslint/no-explicit-any */
import './App.css'
import { Alert, Button, Layout, Table } from 'antd'
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
import Link from "antd/lib/typography/Link";
import { red } from '@ant-design/colors'

const PRIVATE_KEY = process.env.REACT_APP_PRIVATE_KEY
const CHAIN_ID = process.env.REACT_APP_CHAIN_ID
const RPC_URL_1 = process.env.REACT_APP_RPC_1
const RPC_URL_56 = process.env.REACT_APP_RPC_56
const RPC_URL_137 = process.env.REACT_APP_RPC_137
const RPC_URL_43114 = process.env.REACT_APP_RPC_43114


function App() {
  const [assets, setAssets] = useState<any>([])
  const [started, setStarted] = useState(false)
  const [finishedItems, setFinishedItem] = useState([])

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
          started ? (finishedItems.findIndex(item => item.gamefiAsset.token_id === record.gamefiAsset.token_id && item.gamefiAsset.asset_contract.address === record.gamefiAsset.asset_contract.address) >= 0 ? <div>Done</div> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner radius={20} stroke={2}></Spinner>
        </div>) : <div></div>
        )
      },
    },
  ]

  const formatColumns: ColumnsType<any> = [
    {
      title: 'network',
      dataIndex: 'network',
      key: 'network'
    },
    {
      title: 'address',
      dataIndex: 'address',
      key: 'address'
    },
    {
      title: 'id',
      dataIndex: 'id',
      key: 'id'
    },
    {
      title: 'payment',
      dataIndex: 'payment',
      key: 'payment'
    },
    {
      title: 'price',
      dataIndex: 'price',
      key: 'price'
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

  const marketProvider43114 = new Web3.providers.HttpProvider(RPC_URL_43114)
  const provider43114 = new ethers.providers.JsonRpcProvider(RPC_URL_43114)
  const wallet43114 = new ethers.Wallet(PRIVATE_KEY, provider43114)

  const approveAllTokens = useCallback(async (tokenAddresses: string[]) => {
    tokenAddresses.forEach(async address => {
      if (address.toLowerCase() === '0xe9e7cea3dedca5984780bafc599bd69add087d56') {
        const signer = wallet56.connect(provider56)
        const tokenContract = new ethers.Contract(address, ERC20_ABI, signer)
        await tokenContract.approve('0x384A47e8A61C6D3eEdDae213c1C18398e3eceAc7', ethers.constants.MaxUint256)
      }

      if (address.toLowerCase() === '0xdAC17F958D2ee523a2206206994597C13D831ec7') {
        const signer = wallet1.connect(provider1)
        const tokenContract = new ethers.Contract(address, ERC20_ABI, signer)
        await tokenContract.approve('0x9daa2cFD70D1f92a2Cf560eF8078b680151D0977', ethers.constants.MaxUint256)
      }

      if (address.toLowerCase() === '0xc2132d05d31c914a87c6611c10748aeb04b58e8f') {
        const signer = wallet137.connect(provider137)
        const tokenContract = new ethers.Contract(address, ERC20_ABI, signer)
        await tokenContract.approve('0xd4B3b80698287F612B8f78822878fee8a298Af6c', ethers.constants.MaxUint256)
      }

      if (address.toLowerCase() === '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7') {
        const signer = wallet43114.connect(provider43114)
        const tokenContract = new ethers.Contract(address, ERC20_ABI, signer)
        await tokenContract.approve('0x2b820C3ae26d80b5c3E2efB58e40c79A39C8eEaB', ethers.constants.MaxUint256)
      }
    })
  }, [wallet56, wallet1, wallet137, wallet43114, provider1, provider56, provider137, provider43114])

  const sdkBSC = useMemo(() => {
    const signer = wallet56.connect(provider56)
    return new SDK(marketProvider56, signer, {
      networkName: Network.Main,
      wyvernConfig: {
        network: Network.Main,
        wyvernExchangeContractAddress: '0x31B72918D2ae4E37660a71fFC6Ecd9f9A05F85e8',
        wyvernProxyRegistryContractAddress: '0x9daa2cFD70D1f92a2Cf560eF8078b680151D0977',
        wyvernDAOContractAddress: '0xd4B3b80698287F612B8f78822878fee8a298Af6c',
        wyvernTokenContractAddress: '0x89Af13A10b32F1b2f8d1588f93027F69B6F4E27e',
        wyvernTokenTransferProxyContractAddress: '0x384A47e8A61C6D3eEdDae213c1C18398e3eceAc7',
        wyvernAtomicizerContractAddress: '0xaE60460E0d93a8170Dbe155914e9970483BBFd3f'
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
        wyvernExchangeContractAddress: '0x66740c8F4370AB9aeccB86E0d43AC7556D1752Cc',
        wyvernProxyRegistryContractAddress: '0x12Aa3eE78fE41a741Cb018181bb643bbBdBa2F1E',
        wyvernDAOContractAddress: '0x2DB294bc4BaB155521aE359D879Fa0ad9b74ee08',
        wyvernTokenContractAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        wyvernTokenTransferProxyContractAddress: '0xd4B3b80698287F612B8f78822878fee8a298Af6c',
        wyvernAtomicizerContractAddress: '0x8704A455Df75618ADc7741AA0C01125e1c1BE048'
      },
      useReadOnlyProvider: false
    }, 137, (e) => console.log(e))
  }, [wallet137, provider137, marketProvider137])

  const sdkETH = useMemo(() => {
    const signer = wallet1.connect(provider1)
    return new SDK(marketProvider1, signer, {
      networkName: Network.Main,
      wyvernConfig: {
        network: Network.Main,
        wyvernExchangeContractAddress: '0x384A47e8A61C6D3eEdDae213c1C18398e3eceAc7',
        wyvernProxyRegistryContractAddress: '0xaE60460E0d93a8170Dbe155914e9970483BBFd3f',
        wyvernDAOContractAddress: '0x12Aa3eE78fE41a741Cb018181bb643bbBdBa2F1E',
        wyvernTokenContractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        wyvernTokenTransferProxyContractAddress: '0x9daa2cFD70D1f92a2Cf560eF8078b680151D0977',
        wyvernAtomicizerContractAddress: '0x66740c8F4370AB9aeccB86E0d43AC7556D1752Cc'
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
        wyvernExchangeContractAddress: '0x2DB294bc4BaB155521aE359D879Fa0ad9b74ee08',
        wyvernProxyRegistryContractAddress: '0x5c83E1e454A6b86845e44e7520833cD50F04DE59',
        wyvernDAOContractAddress: '0x928466fC71a749930F079485fFdae5721D2b4C78',
        wyvernTokenContractAddress: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
        wyvernTokenTransferProxyContractAddress: '0x2b820C3ae26d80b5c3E2efB58e40c79A39C8eEaB',
        wyvernAtomicizerContractAddress: '0xB54EC22d7784E62318b050Ab5b6Ba7f6506E5990'
      },
      useReadOnlyProvider: false
    }, 43114, (e) => console.log(e))
  }, [wallet43114, provider43114, marketProvider43114])

  const getSDK = useCallback((network) => {
    switch (network?.toLowerCase()) {
      case 'bsc':
        return sdkBSC
      case 'polygon':
        return sdkPolygon
      case 'eth':
        return sdkETH
      case 'avalanche':
        return sdkAvax
      default:
        return null
    }
  }, [sdkBSC, sdkAvax, sdkETH, sdkPolygon])

  const getWallet = useCallback((network) => {
    switch (network?.toLowerCase()) {
      case 'bsc':
        return wallet56
      case 'polygon':
        return wallet137
      case 'eth':
        return wallet1
      case 'avalanche':
        return wallet43114
      default:
        return null
    }
  }, [wallet56, wallet137, wallet1, wallet43114])

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
        setFinishedItem(old => [...old, item])
      }
    })
    .catch(e => {
      // toast.dismiss(toasting)
      console.log(e)
    })
  }, [assets, getSDK, setFinishedItem])
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
    await approveAllTokens(tokens)

    toast.dismiss(toasting)

    for (let i = 0; i < assets.length; i += 5) {
      const promises = []
      for (let j = i; j < i + 5; j++) {
        promises.push(new Promise((resolve, reject) => {
          console.log(assets[j])
          return createSellOrder(assets[j], getWallet(assets[j]?.network)).finally(() => resolve(null))
       }))
      }
      await Promise.all(promises).then(res => console.log('Done 1'))
    }
    // assets.forEach(asset => {
    //   createSellOrder(asset)
    // })
  }, [assets, getWallet])
  return (
    <Layout className="layout">
    <Header>
      <div className="logo text-white">Tools</div>
    </Header>
    <Content>
      <div className="site-layout-content" style={{ minHeight: '100vh' }}>
        <div className="container">
          <div style={{ color: red.primary, marginBottom: '10px' }}>Warning: If your account has not listed any item have the same network with your NFT on GameFi.org Digital Collectibles before, you should manually list 1 item on the website before using this tool</div>
          <div style={{ marginBottom: '10px' }}>1. Upload CSV file following <Link href="/demo.csv" download>this format</Link></div>
          <ul>
              <li>Network can be: bsc, eth, polygon, avalanche</li>
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
        </div>
      </div>
      <Toaster></Toaster>
    </Content>
  </Layout>
  )
}

export default App;
