import { useState } from 'react';
import { useFreighterWallet } from '../hooks/useFreighterWallet';
import StellarService from '../services/stellarService';
import { Networks } from '@stellar/stellar-sdk';

const StellarTransactions = () => {
  const { publicKey, signTransaction, isWalletConnected } = useFreighterWallet();
  const [stellarService] = useState(() => new StellarService('testnet'));
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    destination: '',
    amount: ''
  });

  // Contract form state
  const [contractForm, setContractForm] = useState({
    contractAddress: '',
    method: '',
    params: ''
  });

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!isWalletConnected) {
      setError('Please connect your wallet first');
      return;
    }

    // Basic validation
    if (!paymentForm.destination || !paymentForm.amount) {
      setError('Please fill in all required fields');
      return;
    }

    if (parseFloat(paymentForm.amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setResult('');

      // Create payment transaction
      const transaction = await stellarService.createPaymentTransaction(
        publicKey,
        paymentForm.destination,
        paymentForm.amount
      );
      console.log("-->", transaction)

      // Sign transaction with Freighter
      const signedTransactionXdr = await signTransaction(transaction.toXDR(), {
        networkPassphrase: Networks.TESTNET,
        address: publicKey,
      });
      console.log("-->", signedTransactionXdr)

      // Submit transaction
      const result = await stellarService.submitTransaction(signedTransactionXdr.signedTxXdr);

      setResult(`Payment successful! Transaction hash: ${result.hash}`);
      setPaymentForm({ destination: '', amount: '' });
    } catch (err) {
      setError(`Payment failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContractCall = async (e) => {
    e.preventDefault();
    if (!isWalletConnected) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setResult('');

      // Parse parameters (assuming JSON format)
      let params = [];
      if (contractForm.params.trim()) {
        params = JSON.parse(contractForm.params);
      }

      // Create contract transaction
      const transaction = await stellarService.createContractTransaction(
        publicKey,
        contractForm.contractAddress,
        contractForm.method,
        params
      );

      // Simulate first (optional but recommended)
      const simulation = await stellarService.simulateContractTransaction(transaction);
      console.log('Simulation result:', simulation);

      // Sign transaction with Freighter
      const signedTransaction = await signTransaction(transaction.toXDR());

      // Submit transaction
      const result = await stellarService.submitTransaction(signedTransaction);

      setResult(`Contract call successful! Transaction hash: ${result.hash}`);
      setContractForm({ contractAddress: '', method: '', params: '' });
    } catch (err) {
      setError(`Contract call failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isWalletConnected) {
    return (
      <div className="transactions-container">
        <p>Please connect your Freighter wallet to use transactions.</p>
      </div>
    );
  }

  return (
    <div className="transactions-container">
      <h2>Stellar Transactions</h2>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="success-message">
          <p>{result}</p>
        </div>
      )}

      {/* Payment Form */}
      <div className="transaction-form">
        <h3>Send Payment</h3>
        <form onSubmit={handlePayment}>
          <div className="form-group">
            <label>Destination Address:</label>
            <input
              type="text"
              value={paymentForm.destination}
              onChange={(e) => setPaymentForm({ ...paymentForm, destination: e.target.value })}
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              required
            />
          </div>
          <div className="form-group">
            <label>Amount (XLM):</label>
            <input
              type="number"
              step="0.0000001"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              placeholder="10.5"
              required
            />
          </div>
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Send Payment'}
          </button>
        </form>
      </div>

      {/* Contract Invocation Form */}
      <div className="transaction-form">
        <h3>Contract Invocation</h3>
        <form onSubmit={handleContractCall}>
          <div className="form-group">
            <label>Contract Address:</label>
            <input
              type="text"
              value={contractForm.contractAddress}
              onChange={(e) => setContractForm({ ...contractForm, contractAddress: e.target.value })}
              placeholder="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              required
            />
          </div>
          <div className="form-group">
            <label>Method Name:</label>
            <input
              type="text"
              value={contractForm.method}
              onChange={(e) => setContractForm({ ...contractForm, method: e.target.value })}
              placeholder="transfer"
              required
            />
          </div>
          <div className="form-group">
            <label>Parameters (JSON array):</label>
            <textarea
              value={contractForm.params}
              onChange={(e) => setContractForm({ ...contractForm, params: e.target.value })}
              placeholder='["param1", "param2"]'
              rows="3"
            />
          </div>
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Call Contract'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StellarTransactions;