import { useState } from "react";
import { useFreighterWallet } from "../hooks/useFreighterWallet";
import BackendService from "../services/backendService";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getAddress, isAllowed } from "@stellar/freighter-api";

const BackendMultiSigContract = () => {
  const { publicKey, signTransaction, isWalletConnected } =
    useFreighterWallet();
  console.log("🚀 ~ BackendMultiSigContract ~ publicKey:", publicKey);
  const [backendService] = useState(() => new BackendService());
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  // Contract transfer form
  const [contractForm, setContractForm] = useState({
    sourceAccount: "GCA3XIQAK2JKH7SDTVEEALP4HIMS4HULVMK3QCH5GQH4KLIWQW4CSCKF",
    contractId: "CAEXRD3SNZLUWO4IYURRVLC7OHEICIV73XJNBY5DFRMVKILXD5S6AUQV",
    fromAddress: "GCA3XIQAK2JKH7SDTVEEALP4HIMS4HULVMK3QCH5GQH4KLIWQW4CSCKF",
    toAddress: "GA7QSXFU4Z6MBA656RHPJVBHSV6SFVVRLOO4CE3XN5SIFOMLN7VV3X53",
    amount: "20000000",
  });

  // Transaction state
  const [transactionState, setTransactionState] = useState({
    transactionXdr: "",
    transactionHash: "",
    signatures: 0,
    requiredSignatures: 2,
    isReadyToSubmit: false,
    accountInfo: null,
  });

  // Test backend connection
  const testBackend = async () => {
    try {
      setIsLoading(true);
      setError("");

      const health = await backendService.getHealth();

      setResult(`🔗 Backend connection successful!

Status: ${health.status}
Timestamp: ${health.timestamp}

Services:
• Horizon: ${health.services.horizon.status} (Ledger: ${health.services.horizon.latestLedger})
• RPC: ${health.services.rpc.status} (Ledger: ${health.services.rpc.ledgerNumber})

Network: ${health.network}`);
    } catch (err) {
      setError(`Backend connection failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load account information
  const loadAccountInfo = async () => {
    if (!contractForm.sourceAccount) {
      setError("Please enter a source account first");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const accountInfo = await backendService.getAccount(
        contractForm.sourceAccount
      );

      setTransactionState({
        ...transactionState,
        accountInfo: accountInfo,
        requiredSignatures: accountInfo.thresholds.medium,
      });

      setResult(`📋 Account Information Loaded:

Account: ${accountInfo.accountId}
Multi-sig: ${accountInfo.isMultisig ? "✅ Yes" : "❌ No"}
Signers: ${accountInfo.signers.length}
Required Signatures: ${accountInfo.thresholds.medium}

Signers:
${accountInfo.signers
  .map(
    (signer, i) =>
      `${i + 1}. ${signer.publicKey.substring(
        0,
        10
      )}...${signer.publicKey.substring(
        signer.publicKey.length - 10
      )} (Weight: ${signer.weight})`
  )
  .join("\n")}

Balances:
${accountInfo.balances
  .map(
    (balance) =>
      `• ${
        balance.asset_type === "native" ? "XLM" : balance.asset_code
      }: ${parseFloat(balance.balance).toFixed(7)}`
  )
  .join("\n")}`);
    } catch (err) {
      setError(`Failed to load account: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Create contract transaction
  const createTransaction = async (e) => {
    e.preventDefault();

    if (
      !contractForm.sourceAccount ||
      !contractForm.contractId ||
      !contractForm.fromAddress ||
      !contractForm.toAddress
    ) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setResult("");

      console.log("Creating contract transaction via backend...");

      // const txResult = await backendService.buildContractTransfer({
      //     sourceAccount: contractForm.sourceAccount,
      //     contractId: contractForm.contractId,
      //     fromAddress: contractForm.fromAddress,
      //     toAddress: contractForm.toAddress,
      //     amount: contractForm.amount
      // });
      const txResult = await backendService.buildContractTransfer({
        sourceAccount: contractForm.sourceAccount,
        contractId: contractForm.contractId,
        fromAddress: contractForm.fromAddress,
        toAddress: contractForm.toAddress,
        amount: contractForm.amount,
      });

      setTransactionState({
        ...transactionState,
        transactionXdr: txResult.transactionXdr,
        transactionHash: txResult.transactionHash,
        signatures: 0,
        isReadyToSubmit: false,
      });

      setResult(`📝 Contract transaction created successfully!

Transaction Hash: ${txResult.transactionHash}
Contract: ${txResult.operation.contractId}
From: ${txResult.operation.fromAddress}
To: ${txResult.operation.toAddress}
Amount: ${txResult.operation.amount} stroops

✅ Transaction prepared and simulated by backend
⚠️ Ready for signing with Freighter wallet

Required Signatures: ${transactionState.requiredSignatures || 2}`);
    } catch (err) {
      setError(`Transaction creation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign transaction with Freighter
  const signWithFreighter = async () => {
    if (!transactionState.transactionXdr) {
      setError("No transaction to sign");
      return;
    }

    if (!isWalletConnected) {
      setError("Please connect your Freighter wallet first");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      console.log("Signing with Freighter...");

      // Sign with Freighter
      const allowed = await isAllowed();
      const pubKey = await getAddress();
      console.log("🚀 ~ signWithFreighter ~ pubKey:", pubKey);

      const signedXdr = await signTransaction(transactionState.transactionXdr, {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        accountToSign: pubKey.address,
      });
      console.log("🚀 ~ 💥SIGNED XDR :", signedXdr);

      // Parse to count signatures
      const signedTx = await StellarSdk.TransactionBuilder.fromXDR(
        signedXdr.signedTxXdr,
        StellarSdk.Networks.TESTNET
      );
      console.log("🚀 ~ signWithFreighter ~ signedTx:", signedTx);

      const signatureCount = signedTx.signatures.length;
      const isReady = true;
      setTransactionState({
        ...transactionState,
        transactionXdr: signedXdr.signedTxXdr,
        signatures: signatureCount,
        isReadyToSubmit: true,
      });

      setResult(`✍️ Transaction signed successfully!

Signer: ${publicKey}
Total Signatures: ${signatureCount}/${transactionState.requiredSignatures || 2}

${
  isReady
    ? "✅ Transaction has enough signatures and can be submitted!"
    : `⏳ Need ${
        (transactionState.requiredSignatures || 2) - signatureCount
      } more signature(s)`
}

Updated Transaction XDR:
...`);
    } catch (err) {
      setError(`Signing failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit transaction via backend
  const submitTransaction = async () => {
    if (!transactionState.isReadyToSubmit) {
      setError("Transaction does not have enough signatures");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      console.log("Submitting transaction via backend...");

      const submitResult = await backendService.submitTransaction(
        transactionState.transactionXdr
      );

      if (submitResult.success) {
        setResult(`🎉 Multi-sig contract transfer executed successfully!

Transaction Hash: ${submitResult.hash}
Status: ${submitResult.status}
Ledger: ${submitResult.ledger}
Signatures Used: ${submitResult.signatures}
${
  submitResult.returnValue
    ? `Return Value: ${JSON.stringify(submitResult.returnValue)}`
    : ""
}

View on Stellar Expert: https://stellar.expert/explorer/testnet/tx/${
          submitResult.hash
        }

Contract: ${contractForm.contractId}
Transfer: ${contractForm.amount} stroops from ${contractForm.fromAddress} to ${
          contractForm.toAddress
        }`);

        // Reset transaction state
        setTransactionState({
          transactionXdr: "",
          transactionHash: "",
          signatures: 0,
          requiredSignatures: 2,
          isReadyToSubmit: false,
          accountInfo: null,
        });
      } else {
        setError(`Transaction failed: ${submitResult.error}`);
      }
    } catch (err) {
      setError(`Transaction submission failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="backend-multisig-contract">
      <h2>🏗️ Backend-Powered Multi-Sig Contract</h2>
      <p className="description">
        Multi-signature contract transfers using backend API for transaction
        building and submission.
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

      {/* Backend Test */}
      <div className="test-section">
        <h3>🔧 Test Backend Connection</h3>
        <button onClick={testBackend} disabled={isLoading} className="test-btn">
          {isLoading ? "Testing..." : "Test Backend API"}
        </button>
      </div>

      {/* Contract Transfer Form */}
      <div className="contract-form">
        <h3>1️⃣ Contract Transfer Setup</h3>
        <form onSubmit={createTransaction}>
          <div className="form-group">
            <label>Source Account (Multi-sig):</label>
            <div className="input-with-button">
              <input
                type="text"
                value={contractForm.sourceAccount}
                onChange={(e) =>
                  setContractForm({
                    ...contractForm,
                    sourceAccount: e.target.value,
                  })
                }
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                required
              />
              <button
                type="button"
                onClick={loadAccountInfo}
                disabled={isLoading}
                className="info-btn"
              >
                Load Info
              </button>
            </div>
            <small>
              The multi-signature account that will send the transfer
            </small>
          </div>

          <div className="form-group">
            <label>Contract ID:</label>
            <input
              type="text"
              value={contractForm.contractId}
              onChange={(e) =>
                setContractForm({ ...contractForm, contractId: e.target.value })
              }
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
              onChange={(e) =>
                setContractForm({
                  ...contractForm,
                  fromAddress: e.target.value,
                })
              }
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              required
            />
            <small>
              Address sending tokens (usually the multi-sig account)
            </small>
          </div>

          <div className="form-group">
            <label>To Address:</label>
            <input
              type="text"
              value={contractForm.toAddress}
              onChange={(e) =>
                setContractForm({ ...contractForm, toAddress: e.target.value })
              }
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
              onChange={(e) =>
                setContractForm({ ...contractForm, amount: e.target.value })
              }
              placeholder="20000000"
              required
            />
            <small>
              Amount to transfer (e.g., 20000000 = 2 tokens with 7 decimals)
            </small>
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading
              ? "Creating Transaction..."
              : "Create Contract Transaction"}
          </button>
        </form>
      </div>

      {/* Signing and Submission */}
      {transactionState.transactionXdr && (
        <div className="signing-section">
          <h3>2️⃣ Sign & Submit Transaction</h3>

          <div className="transaction-info">
            <p>
              <strong>Transaction Hash:</strong>{" "}
              {transactionState.transactionHash}
            </p>
            <p>
              <strong>Transaction Hash:</strong>{" "}
              {transactionState.transactionXdr}
            </p>
            <p>
              <strong>Current Signatures:</strong> {transactionState.signatures}
              /{transactionState.requiredSignatures}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              {transactionState.isReadyToSubmit
                ? "✅ Ready to Submit"
                : "⏳ Needs More Signatures"}
            </p>
          </div>

          <div className="signing-controls">
            <button
              onClick={signWithFreighter}
              disabled={isLoading || !isWalletConnected}
              className="sign-btn"
            >
              {isLoading ? "Signing..." : "Sign with Freighter"}
            </button>

            {transactionState.isReadyToSubmit && (
              <button
                onClick={submitTransaction}
                disabled={isLoading}
                className="submit-btn"
              >
                {isLoading ? "Submitting..." : "Submit via Backend"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Information */}
      <div className="info-section">
        <h4>🏗️ Backend Architecture:</h4>
        <ul>
          <li>
            <strong>Frontend:</strong> Handles UI, wallet connection, and
            transaction signing
          </li>
          <li>
            <strong>Backend:</strong> Builds transactions, simulates, and
            submits to network
          </li>
          <li>
            <strong>Security:</strong> No private keys stored, only XDR exchange
          </li>
          <li>
            <strong>Multi-sig:</strong> Supports distributed signing workflow
          </li>
        </ul>

        <h4>📋 API Endpoints:</h4>
        <ul>
          <li>
            <code>GET /health</code> - Backend health check
          </li>
          <li>
            <code>GET /api/account/:publicKey</code> - Account information
          </li>
          <li>
            <code>POST /api/contract/transfer</code> - Build contract transfer
          </li>
          <li>
            <code>POST /api/transaction/submit</code> - Submit signed
            transaction
          </li>
        </ul>

        <h4>🔄 Workflow:</h4>
        <ol>
          <li>Backend builds and prepares contract transaction</li>
          <li>Frontend receives unsigned transaction XDR</li>
          <li>Freighter signs the transaction client-side</li>
          <li>Backend submits signed transaction to Stellar network</li>
          <li>Backend polls for result and returns status</li>
        </ol>
      </div>
    </div>
  );
};

export default BackendMultiSigContract;
