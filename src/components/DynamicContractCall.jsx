import { useEffect, useState } from "react";
import { useFreighterWallet } from "../hooks/useFreighterWallet";
import BackendService from "../services/backendService";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getAddress, isAllowed } from "@stellar/freighter-api";

const DynamicContractCall = () => {
  const { publicKey, signTransaction, isWalletConnected } =
    useFreighterWallet();
  const [backendService] = useState(() => new BackendService());
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  // Contract invocation form
  const [contractForm, setContractForm] = useState({
    sourceAccount: "GBIWYETBQUVV2VMARCWOO52GWJPV6JM3IPCWLO6NBZHTJRAOY7KOEUFK",
    contractAddress: "CDDMNSMJCJCQH5VGGENQ4KOIZFBPYW2OWICBMWSELLRHJW6N2P47IEIQ",
    method: "set_name",
    params: '[{"type":"string","value":"One_Hour_Later"}]',
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

  // Build contract transaction
  const buildContractTransaction = async (e) => {
    e.preventDefault();

    if (
      !contractForm.sourceAccount ||
      !contractForm.contractAddress ||
      !contractForm.method
    ) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setResult("");

      // Parse parameters
      let parameters = [];
      if (contractForm.params.trim()) {
        try {
          parameters = JSON.parse(contractForm.params);
        } catch (parseErr) {
          setError(`Invalid JSON in parameters: ${parseErr.message}`);
          setIsLoading(false);
          return;
        }
      }

      console.log("Building contract transaction via backend...", {
        sourceAccount: contractForm.sourceAccount,
        contractId: contractForm.contractAddress,
        method: contractForm.method,
        parameters,
      });

      const txResult = await backendService.buildContractTransaction({
        sourceAccount: contractForm.sourceAccount,
        contractId: contractForm.contractAddress,
        method: contractForm.method,
        parameters: parameters,
      });

      setTransactionState({
        ...transactionState,
        transactionXdr: txResult.transactionXdr,
        transactionHash: txResult.transactionHash,
        signatures: 0,
        isReadyToSubmit: false,
      });

      const paramsDisplay =
        parameters.length > 0
          ? parameters
              .map((p, i) => `  ${i + 1}. Type: ${p.type}, Value: ${p.value}`)
              .join("\n")
          : "  (No parameters)";

      setResult(`📝 Contract transaction built successfully!

Transaction Hash: ${txResult.transactionHash}
Contract: ${txResult.contractId}
Method: ${contractForm.method}
Parameters:
${paramsDisplay}

✅ Transaction prepared and simulated by backend
⚠️ Ready for signing with Freighter wallet

Required Signatures: ${transactionState.requiredSignatures || 2}`);
    } catch (err) {
      setError(`Transaction building failed: ${err.message}`);
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
      const allowed = await isAllowed();
      const pubKey = await getAddress();
      // Sign with Freighter
      const signedXdr = await signTransaction(transactionState.transactionXdr, {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        accountToSign: pubKey.address,
      });

      console.log("✅ Transaction signed");

      // Parse to count signatures
      const signedTx = await StellarSdk.TransactionBuilder.fromXDR(
        signedXdr.signedTxXdr,
        StellarSdk.Networks.TESTNET
      );

      const signatureCount = signedTx.signatures.length;
      const isReady =
        signatureCount >= (transactionState.requiredSignatures || 2);

      setTransactionState({
        ...transactionState,
        transactionXdr: signedXdr.signedTxXdr,
        signatures: signatureCount,
        isReadyToSubmit: isReady,
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
}`);
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

      console.log("Submitting contract call via backend...");

      const submitResult = await backendService.submitTransaction(
        transactionState.transactionXdr
      );

      if (submitResult.success) {
        setResult(`🎉 Contract call executed successfully!

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

Contract: ${contractForm.contractAddress}
Method: ${contractForm.method}`);

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
    <div className="dynamic-contract-call">
      <h2>🔧 Dynamic Contract Call</h2>
      <p className="description">
        Call any Soroban contract method with custom parameters. Build, sign,
        and submit transactions dynamically.
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

      {/* Contract Invocation Form */}
      <div className="contract-form">
        <h3>1️⃣ Contract Invocation Setup</h3>
        <form onSubmit={buildContractTransaction}>
          <div className="form-group">
            <label>Source Account:</label>
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
              The account that will invoke the contract (must be funded)
            </small>
          </div>

          <div className="form-group">
            <label>Contract Address:</label>
            <input
              type="text"
              value={contractForm.contractAddress}
              onChange={(e) =>
                setContractForm({
                  ...contractForm,
                  contractAddress: e.target.value,
                })
              }
              placeholder="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              required
            />
            <small>Soroban contract address (starts with C)</small>
          </div>

          <div className="form-group">
            <label>Method Name:</label>
            <input
              type="text"
              value={contractForm.method}
              onChange={(e) =>
                setContractForm({ ...contractForm, method: e.target.value })
              }
              placeholder="transfer"
              required
            />
            <small>Name of the contract method to invoke</small>
          </div>

          <div className="form-group">
            <label>Parameters (JSON Array):</label>
            <textarea
              value={contractForm.params}
              onChange={(e) =>
                setContractForm({ ...contractForm, params: e.target.value })
              }
              placeholder='[{"type":"address","value":"GXXXX..."},{"type":"i128","value":"1000000"}]'
              rows="6"
            />
            <small>
              Parameters as JSON array. Each parameter object must have:
              <br />• <code>type</code>: address, i128, string, u32, bool, etc.
              <br />• <code>value</code>: The parameter value
              <br />
              Example:{" "}
              <code>{`[{"type":"address","value":"GA7QSF..."},{"type":"i128","value":"20000000"}]`}</code>
            </small>
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Building Transaction..." : "Build Contract Call"}
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

          <div className="transaction-xdr">
            <p>
              <strong>Transaction XDR:</strong>
            </p>
            <textarea
              readOnly
              value={transactionState.transactionXdr}
              rows="4"
            />
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
        <h4>🔍 Parameter Types:</h4>
        <ul>
          <li>
            <strong>address:</strong> Stellar account address (starts with G or
            C)
          </li>
          <li>
            <strong>i128:</strong> 128-bit signed integer (use string for large
            numbers)
          </li>
          <li>
            <strong>u32:</strong> 32-bit unsigned integer
          </li>
          <li>
            <strong>string:</strong> UTF-8 string value
          </li>
          <li>
            <strong>bool:</strong> Boolean value (true/false)
          </li>
        </ul>

        <h4>📋 Workflow:</h4>
        <ol>
          <li>Fill in the contract details and method parameters</li>
          <li>Backend builds and prepares the contract call transaction</li>
          <li>Sign the transaction with your Freighter wallet</li>
          <li>Submit the signed transaction via the backend</li>
          <li>Backend polls for confirmation and returns the result</li>
        </ol>

        <h4>💡 Example: Transfer Method</h4>
        <p>For a token transfer method, use parameters like:</p>
        <code
          style={{
            display: "block",
            padding: "10px",
            backgroundColor: "#f5f5f5",
            marginTop: "5px",
            borderRadius: "4px",
          }}
        >
          {`[
  {"type": "address", "value": "GCA3XIQAK2JKH7SDTVEEALP4HIMS4HULVMK3QCH5GQH4KLIWQW4CSCKF"},
  {"type": "address", "value": "GA7QSXFU4Z6MBA656RHPJVBHSV6SFVVRLOO4CE3XN5SIFOMLN7VV3X53"},
  {"type": "i128", "value": "20000000"}
]`}
        </code>
      </div>
    </div>
  );
};

export default DynamicContractCall;
