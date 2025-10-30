import React from 'react';
import { useFreighterWallet } from '../hooks/useFreighterWallet';

const WalletConnect = () => {
  const {
    isWalletConnected,
    publicKey,
    network,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
  } = useFreighterWallet();

  const formatPublicKey = (key) => {
    if (!key) return '';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  return (
    <div className="wallet-connect">
      <div className="wallet-status">
        {error && (
          <div className="error-message">
            <p>Error: {error}</p>
          </div>
        )}
        
        {isLoading ? (
          <div className="loading">
            <p>Loading...</p>
          </div>
        ) : isWalletConnected ? (
          <div className="connected">
            <h3>Wallet Connected</h3>
            <p><strong>Public Key:</strong> {formatPublicKey(publicKey)}</p>
            <p><strong>Network:</strong> {network}</p>
            <button onClick={disconnectWallet} className="disconnect-btn">
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div className="disconnected">
            <h3>Connect Your Freighter Wallet</h3>
            <p>Please connect your Freighter wallet to continue</p>
            <button onClick={connectWallet} className="connect-btn">
              Connect Freighter Wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletConnect;