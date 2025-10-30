import { useState, useEffect } from 'react';
import {
  isConnected,
  getPublicKey,
  signTransaction,
  getNetwork,
  requestAccess,
  isAllowed,
  getAddress
} from '@stellar/freighter-api';

export const useFreighterWallet = () => {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [network, setNetwork] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(false);

  // Check if Freighter extension is installed
  const checkFreighterInstallation = () => {
    return typeof window !== 'undefined'
  };

  // Check if user has already granted access
  const checkConnection = async () => {
    try {
      setIsLoading(true);
      setError('');

      // First check if Freighter is installed
      const installed = checkFreighterInstallation();
      setIsFreighterInstalled(installed);

      if (!installed) {
        setError('Freighter wallet extension is not installed');
        return;
      }

      // Check if connected and allowed
      const connected = await isConnected();
      const allowed = await isAllowed();

      if (connected && allowed) {
        const pubKey = await getAddress();
        const currentNetwork = await getNetwork();

        setPublicKey(pubKey.address);
        setNetwork(currentNetwork.networkPassphrase);
        setIsWalletConnected(true);
      } else {
        setIsWalletConnected(false);
      }
    } catch (err) {
      setError('Failed to check wallet connection: ' + err.message);
      console.error('Wallet connection error:', err);
      setIsWalletConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Request access and connect to Freighter wallet
  const connectWallet = async () => {
    try {
      setIsLoading(true);
      setError('');

      if (!isFreighterInstalled) {
        setError('Freighter wallet extension is not installed. Please install it from freighter.app');
        return;
      }

      // Request access (this will prompt user for permission)
      const accessObj = await requestAccess();

      if (accessObj.error) {
        throw new Error(accessObj.error);
      }

      // Get public key and network after successful access
      const pubKey = await getAddress();
      const currentNetwork = await getNetwork();

      setPublicKey(pubKey.address);
      setNetwork(currentNetwork.networkPassphrase);
      setIsWalletConnected(true);
    } catch (err) {
      if (err.message.includes('User declined access')) {
        setError('User declined wallet access');
      } else {
        setError('Failed to connect wallet: ' + err.message);
      }
      console.error('Wallet connection error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign a transaction
  const signTx = async (transactionXdr, options = {}) => {
    try {
      setIsLoading(true);
      setError('');

      if (!isWalletConnected) {
        throw new Error('Wallet not connected');
      }

      // Sign transaction with Freighter
      const signedTx = await signTransaction(transactionXdr, {
        network: network,
        accountToSign: publicKey,
        ...options
      });

      return signedTx;
    } catch (err) {
      setError('Failed to sign transaction: ' + err.message);
      console.error('Transaction signing error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect wallet (clear local state)
  const disconnectWallet = () => {
    setIsWalletConnected(false);
    setPublicKey('');
    setNetwork('');
    setError('');
  };

  // Get network details
  const getNetworkDetails = () => {
    return {
      network,
      isTestnet: network === 'TESTNET',
      isMainnet: network === 'PUBLIC'
    };
  };

  // Check connection on component mount
  useEffect(() => {
    checkConnection();
  }, []);

  return {
    // State
    isWalletConnected,
    publicKey,
    network,
    isLoading,
    error,
    isFreighterInstalled,

    // Actions
    connectWallet,
    disconnectWallet,
    signTransaction: signTx,
    checkConnection,

    // Utilities
    getNetworkDetails
  };
};