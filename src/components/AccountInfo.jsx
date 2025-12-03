import React, { useState, useEffect } from 'react';
import { useFreighterWallet } from '../hooks/useFreighterWallet';
import StellarService from '../services/stellarService';

const AccountInfo = () => {
  const { isWalletConnected, publicKey, network } = useFreighterWallet();
  const [stellarService] = useState(() => new StellarService('mainnet'));
  const [accountData, setAccountData] = useState(null);
  const [balances, setBalances] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAccountInfo = async () => {
    if (!isWalletConnected || !publicKey) return;

    try {
      setIsLoading(true);
      setError('');

      // Load account data
      const account = await stellarService.getAccount(publicKey);
      setAccountData(account);

      // Load balances
      const accountBalances = await stellarService.getAccountBalance(publicKey);
      setBalances(accountBalances);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError('Account not found. Make sure your account is funded on the testnet.');
      } else {
        setError(`Failed to load account info: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccountInfo();
  }, [isWalletConnected, publicKey]);

  if (!isWalletConnected) {
    return null;
  }

  return (
    <div className="account-info">
      <h3>Account Information</h3>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
          {error.includes('not found') && (
            <p>
              <a 
                href="https://friendbot.stellar.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="friendbot-link"
              >
                Fund your account on Stellar Testnet
              </a>
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="loading">
          <p>Loading account information...</p>
        </div>
      ) : accountData ? (
        <div className="account-details">
          <div className="account-field">
            <strong>Public Key:</strong>
            <span className="public-key">{publicKey}</span>
          </div>
          
          <div className="account-field">
            <strong>Network:</strong>
            <span className="network">{network}</span>
          </div>
          
          <div className="account-field">
            <strong>Sequence Number:</strong>
            <span>{accountData.sequenceNumber()}</span>
          </div>

          <div className="balances-section">
            <h4>Balances:</h4>
            {balances.length > 0 ? (
              <div className="balances-list">
                {balances.map((balance, index) => (
                  <div key={index} className="balance-item">
                    <span className="asset">
                      {balance.asset_type === 'native' ? 'XLM' : `${balance.asset_code}:${balance.asset_issuer}`}
                    </span>
                    <span className="amount">{parseFloat(balance.balance).toFixed(7)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p>No balances found</p>
            )}
          </div>

          <button onClick={loadAccountInfo} className="refresh-btn">
            Refresh Account Info
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default AccountInfo;