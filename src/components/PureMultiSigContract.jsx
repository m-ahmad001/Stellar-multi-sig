import { useState } from 'react';
import { useFreighterWallet } from '../hooks/useFreighterWallet';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Server } from '@stellar/stellar-sdk/rpc';
import StellarService from '../services/stellarService';

const PureMultiSigContract = () => {
    const { publicKey, signTransaction, isWalletConnected, network } = useFreighterWallet();
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [stellarService] = useState(() => new StellarService('testnet'));


    // Contract transfer form
    const [contractForm, setContractForm] = useState({
        multisigAccount: 'GCA3XIQAK2JKH7SDTVEEALP4HIMS4HULVMK3QCH5GQH4KLIWQW4CSCKF',
        contractId: 'CDDMNSMJCJCQH5VGGENQ4KOIZFBPYW2OWICBMWSELLRHJW6N2P47IEIQ',
        fromAddress: 'GCA3XIQAK2JKH7SDTVEEALP4HIMS4HULVMK3QCH5GQH4KLIWQW4CSCKF',
        toAddress: 'GA7QSXFU4Z6MBA656RHPJVBHSV6SFVVRLOO4CE3XN5SIFOMLN7VV3X53',
        amount: '20000000'
    });

    // Transaction state
    const [transactionState, setTransactionState] = useState({
        unsignedXdr: '',
        signedXdr: '',
        signatures: 0,
        requiredSignatures: 2,
        transactionHash: '',
        isReadyToSubmit: false
    });

    // Constants
    const HORIZON_URL = "https://horizon-testnet.stellar.org";
    const RPC_URL = "https://soroban-testnet.stellar.org";
    const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

    // Servers
    const server = new Server("https://soroban-testnet.stellar.org")
    const rpc = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

    // Check account thresholds
    const checkThresholds = async (accountPublicKey) => {
        try {
            // const account = await horizon.getAccount(accountPublicKey);

            // console.log("Signers:", account.signers);
            // console.log("Thresholds:", account.thresholds);

            // const required = account.thresholds.med_threshold;
            // console.log(`✅ Requires ${required} total weight for approval.`);

            return {
                signers: [],
                thresholds: 2,
                required: 2
            };
        } catch (error) {
            console.error('Error checking thresholds:', error);
            throw error;
        }
    };

    // Build contract transfer transaction
    const buildContractTransaction = async () => {
        try {
            console.log('Building contract transfer transaction...');

            // Get account rpc.loadAccount(sourcePublicKey);
            const sourceAccount = await server.getAccount(contractForm.multisigAccount);
            console.log("🚀 ~ buildContractTransaction ~ account:", sourceAccount)

            const params = [
                "ahmad_amir"
            ]


            // Build transaction
            const transaction = await stellarService.invokeContract(
                contractForm.multisigAccount,
                contractForm.contractId,
                "set_name",
                params
            );
            // const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
            //     fee: StellarSdk.BASE_FEE,
            //     networkPassphrase: NETWORK_PASSPHRASE,
            // })
            //     .addOperation(operation)
            //     .setTimeout(300)
            //     .build();

            console.log("✅ Built transaction");
            console.log("Built transaction, preparing...", transaction);

            // Prepare transaction

            console.log("✅ Transaction prepared");
            return transaction;

        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    };
    // Create unsigned transaction
    const createTransaction = async (e) => {
        e.preventDefault();

        if (!contractForm.multisigAccount || !contractForm.contractId || !contractForm.fromAddress || !contractForm.toAddress) {
            setError('Please fill in all required fields');
            return;
        }

        // Validate formats
        if (!contractForm.multisigAccount.startsWith('G') || contractForm.multisigAccount.length !== 56) {
            setError('Multi-sig account must be a valid Stellar address (starts with G, 56 characters)');
            return;
        }

        if (!contractForm.contractId.startsWith('C') || contractForm.contractId.length !== 56) {
            setError('Contract ID must be a valid Stellar contract address (starts with C, 56 characters)');
            return;
        }

        if (!contractForm.fromAddress.startsWith('G') || contractForm.fromAddress.length !== 56) {
            setError('From address must be a valid Stellar address (starts with G, 56 characters)');
            return;
        }

        if (!contractForm.toAddress.startsWith('G') || contractForm.toAddress.length !== 56) {
            setError('To address must be a valid Stellar address (starts with G, 56 characters)');
            return;
        }

        const amount = parseInt(contractForm.amount);
        if (isNaN(amount) || amount <= 0) {
            setError('Amount must be a positive number');
            return;
        }

        try {
            setIsLoading(true);
            setError('');
            setResult('');

            console.log('Creating contract transaction with parameters:', {
                multisigAccount: contractForm.multisigAccount,
                contractId: contractForm.contractId,
                fromAddress: contractForm.fromAddress,
                toAddress: contractForm.toAddress,
                amount: contractForm.amount
            });

            // Check account thresholds first
            console.log('Checking account thresholds...');
            const thresholdInfo = await checkThresholds(contractForm.multisigAccount);

            // Build the transaction
            console.log('Building contract transaction...');
            const preparedTx = await buildContractTransaction();

            // Get unsigned XDR
            const unsignedXdr = preparedTx.toXDR();
            console.log("XDR", unsignedXdr)

            setTransactionState({
                unsignedXdr: unsignedXdr,
                signedXdr: unsignedXdr,
                signatures: 0,
                requiredSignatures: thresholdInfo?.required || 2,
                transactionHash: preparedTx.hash().toString('hex'),
                isReadyToSubmit: false
            });

            setResult(`📝 Multi-sig contract transaction created successfully!

Contract: ${contractForm.contractId}
From: ${contractForm.fromAddress}
To: ${contractForm.toAddress}
Amount: ${contractForm.amount} stroops

Transaction Hash: ${preparedTx.hash().toString('hex')}
Required Signatures: ${thresholdInfo.required}

Account Signers:
${thresholdInfo.signers.map((signer, i) =>
                `${i + 1}. ${signer.key.substring(0, 10)}...${signer.key.substring(signer.key.length - 10)} (Weight: ${signer.weight})`
            ).join('\n')}

⚠️ Transaction is ready for signing. Use Freighter to sign with authorized accounts.`);

        } catch (err) {
            setError(`Transaction creation failed: ${err.message}`);
            console.error('Transaction creation error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Sign transaction with Freighter
    const signWithFreighter = async () => {
        if (!transactionState.unsignedXdr) {
            setError('No transaction to sign');
            return;
        }

        if (!isWalletConnected) {
            setError('Please connect your Freighter wallet first');
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            console.log('Signing with Freighter...');

            // Sign with Freighter
            const signedXdr = await signTransaction(transactionState.signedXdr, {
                networkPassphrase: NETWORK_PASSPHRASE,
                accountToSign: publicKey
            });

            // Parse the signed transaction to count signatures
            const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr.signedTxXdr, NETWORK_PASSPHRASE);
            const signatureCount = signedTx.signatures.length;

            console.log(`✅ Signed by: ${publicKey}`);
            console.log(`Total signatures: ${signatureCount}/${transactionState.requiredSignatures}`);

            const isReady = signatureCount >= transactionState.requiredSignatures;

            setTransactionState({
                ...transactionState,
                signedXdr: signedXdr.signedTxXdr,
                signatures: signatureCount,
                isReadyToSubmit: isReady
            });

            setResult(`✍️ Transaction signed successfully!

Signer: ${publicKey}
Total Signatures: ${signatureCount}/${transactionState.requiredSignatures}

${isReady
                    ? '✅ Transaction has enough signatures and can be submitted!'
                    : `⏳ Need ${transactionState.requiredSignatures - signatureCount} more signature(s)`
                }

Updated Transaction XDR:
${signedXdr}`);

        } catch (err) {
            setError(`Signing failed: ${err.message}`);
            console.error('Signing error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Submit the multi-sig transaction
    const submitTransaction = async () => {
        if (!transactionState.isReadyToSubmit) {
            setError('Transaction does not have enough signatures');
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            console.log('Submitting multi-sig contract transaction...');

            // Parse the signed transaction
            const signedTx = StellarSdk.TransactionBuilder.fromXDR(transactionState.signedXdr, NETWORK_PASSPHRASE);
            // Submit transaction
            const response = await server.sendTransaction(signedTx);
            console.log("📤 Transaction submitted:", response);

            // Wait for confirmation
            if (response.status === "PENDING") {
                let txResponse = await rpc.getTransaction(response.hash);

                // Poll until transaction is confirmed (with timeout)
                const maxAttempts = 30;
                let attempts = 0;

                while (txResponse.status === "NOT_FOUND" && attempts < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    txResponse = await rpc.getTransaction(response.hash);
                    attempts++;
                }

                if (txResponse.status === "SUCCESS") {
                    setResult(`🎉 Multi-sig contract transfer executed successfully!

Transaction Hash: ${response.hash}
Signatures Used: ${transactionState.signatures}
Contract: ${contractForm.contractId}
Transfer: ${contractForm.amount} stroops from ${contractForm.fromAddress} to ${contractForm.toAddress}

View on Stellar Expert: https://stellar.expert/explorer/testnet/tx/${response.hash}

Transaction Result: ${JSON.stringify(txResponse, null, 2)}`);

                    // Reset transaction state
                    setTransactionState({
                        unsignedXdr: '',
                        signedXdr: '',
                        signatures: 0,
                        requiredSignatures: 2,
                        transactionHash: '',
                        isReadyToSubmit: false
                    });

                } else if (txResponse.status === "FAILED") {
                    setError(`Transaction failed: ${JSON.stringify(txResponse)}`);
                } else {
                    setError("Transaction status unknown after timeout");
                }
            }

        } catch (err) {
            setError(`Transaction submission failed: ${err.message}`);
            console.error('Submission error:', err);

            if (err.response) {
                console.error("Error details:", err.response.data);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pure-multisig-contract">
            <h2>🔐 Pure Multi-Sig Contract Transfer</h2>
            <p className="description">
                Execute contract transfers with multi-signature security using Freighter wallet.
            </p>

            {error && (
                <div className="error-message">
                    <p>{error}</p>
                </div>
            )}

            {result && (
                <div className="success-message">
                    <pre>{result}</pre>
                </div>
            )}


            {/* Contract Transfer Form */}
            <div className="contract-form">
                <h3>1️⃣ Create Contract Transfer Transaction</h3>
                <form onSubmit={createTransaction}>
                    <div className="form-group">
                        <label>Multi-sig Account:</label>
                        <input
                            type="text"
                            value={contractForm.multisigAccount}
                            onChange={(e) => setContractForm({ ...contractForm, multisigAccount: e.target.value })}
                            placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                            required
                        />
                        <small>The multi-signature account that will send the transfer</small>
                    </div>

                    <div className="form-group">
                        <label>Contract ID:</label>
                        <input
                            type="text"
                            value={contractForm.contractId}
                            onChange={(e) => setContractForm({ ...contractForm, contractId: e.target.value })}
                            placeholder="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                            required
                        />
                        <small>Soroban contract address (starts with C)</small>
                    </div>

                    <div className="form-group">
                        <label>From Address:</label>
                        <input
                            type="text"
                            value={contractForm.fromAddress}
                            onChange={(e) => setContractForm({ ...contractForm, fromAddress: e.target.value })}
                            placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                            required
                        />
                        <small>Address sending tokens (usually the multi-sig account)</small>
                    </div>

                    <div className="form-group">
                        <label>To Address:</label>
                        <input
                            type="text"
                            value={contractForm.toAddress}
                            onChange={(e) => setContractForm({ ...contractForm, toAddress: e.target.value })}
                            placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                            required
                        />
                        <small>Address receiving tokens</small>
                    </div>

                    <div className="form-group">
                        <label>Amount (stroops):</label>
                        <input
                            type="number"
                            value={contractForm.amount}
                            onChange={(e) => setContractForm({ ...contractForm, amount: e.target.value })}
                            placeholder="20000000"
                            required
                        />
                        <small>Amount to transfer (e.g., 20000000 = 2 tokens with 7 decimals)</small>
                    </div>

                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Creating Transaction...' : 'Create Contract Transaction'}
                    </button>
                </form>
            </div>

            {/* Signing Section */}
            {transactionState.unsignedXdr && (
                <div className="signing-section">
                    <h3>2️⃣ Sign Transaction with Freighter</h3>

                    <div className="transaction-info">
                        <p><strong>Transaction Hash:</strong> {transactionState.transactionHash}</p>
                        <p><strong>Current Signatures:</strong> {transactionState.signatures}/{transactionState.requiredSignatures}</p>
                        <p><strong>Status:</strong> {transactionState.isReadyToSubmit ? '✅ Ready to Submit' : '⏳ Needs More Signatures'}</p>
                    </div>

                    <div className="signing-controls">
                        <button
                            onClick={signWithFreighter}
                            disabled={isLoading || !isWalletConnected}
                            className="sign-btn"
                        >
                            {isLoading ? 'Signing...' : 'Sign with Freighter'}
                        </button>

                        {transactionState.isReadyToSubmit && (
                            <button
                                onClick={submitTransaction}
                                disabled={isLoading}
                                className="submit-btn"
                            >
                                {isLoading ? 'Submitting...' : 'Submit Transaction'}
                            </button>
                        )}
                    </div>

                    <div className="xdr-display">
                        <h4>Transaction XDR:</h4>
                        <textarea
                            readOnly
                            value={transactionState.signedXdr}
                            rows="4"
                            className="xdr-textarea"
                        />
                        <small>Share this XDR with other signers if needed</small>
                    </div>
                </div>
            )}

            {/* Information Section */}
            <div className="info-section">
                <h4>🔍 How It Works:</h4>
                <ol>
                    <li><strong>Create:</strong> Build a contract transfer transaction with proper parameters</li>
                    <li><strong>Prepare:</strong> Simulate the transaction and prepare it for signing</li>
                    <li><strong>Sign:</strong> Use Freighter to sign with authorized multi-sig accounts</li>
                    <li><strong>Submit:</strong> Once threshold is met, submit to the Stellar network</li>
                </ol>

                <h4>📋 Requirements:</h4>
                <ul>
                    <li>Multi-sig account must be properly configured with signers and thresholds</li>
                    <li>Contract must exist and be deployed on Stellar testnet</li>
                    <li>Freighter wallet must be connected with authorized signer accounts</li>
                    <li>Sufficient signatures must be collected before submission</li>
                </ul>

                <h4>🔧 Technical Details:</h4>
                <ul>
                    <li><strong>Network:</strong> Stellar Testnet</li>
                    <li><strong>RPC:</strong> soroban-testnet.stellar.org</li>
                    <li><strong>Method:</strong> contract.call("transfer", from, to, amount)</li>
                    <li><strong>Amount Type:</strong> i128 (BigInt)</li>
                </ul>
            </div>
        </div>
    );
};

export default PureMultiSigContract;