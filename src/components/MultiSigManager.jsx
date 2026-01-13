import { useState } from "react";
import { useFreighterWallet } from "../hooks/useFreighterWallet";
import StellarService from "../services/stellarService";
import KeypairGenerator from "./KeypairGenerator";
import * as StellarSdk from "@stellar/stellar-sdk";

const MultiSigManager = () => {
  const { publicKey, isWalletConnected } = useFreighterWallet();
  const [stellarService] = useState(() => new StellarService("testnet"));
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  // Multi-sig setup state
  const [setupForm, setSetupForm] = useState({
    masterPublicKey: "",
    signerPublicKeys: ["", "", "", ""],
    lowThreshold: 4,
    medThreshold: 4,
    highThreshold: 4,
  });

  // Transaction creation state
  const [transactionForm, setTransactionForm] = useState({
    sourceAccount: "",
    operationType: "payment",
    destination: "",
    amount: "",
    startingBalance: "",
  });

  // Signing state
  const [signingForm, setSigningForm] = useState({
    transactionXdr: "",
    currentSignatures: 0,
    requiredSignatures: 3,
  });

  // Account info state
  const [accountInfo, setAccountInfo] = useState(null);

  const setupMultiSig = async (e) => {
    e.preventDefault();

    if (
      !setupForm.masterPublicKey ||
      setupForm.signerPublicKeys.some((s) => !s.trim())
    ) {
      setError("Please provide master public key and all signer public keys");
      return;
    }

    if (!isWalletConnected || publicKey !== setupForm.masterPublicKey) {
      setError(
        "Please connect your Freighter wallet with the master account to setup multi-sig"
      );
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setResult("");

      const signerPublicKeys = setupForm.signerPublicKeys.filter((s) =>
        s.trim()
      );

      const result = await stellarService.setupMultisigWithWallet(
        setupForm.masterPublicKey,
        signerPublicKeys,
        {
          low: setupForm.lowThreshold,
          med: setupForm.medThreshold,
          high: setupForm.highThreshold,
        },
        publicKey
      );
      console.log("🚀 ~ setupMultiSig ~ result:", result);

      setResult(`✅ Multi-sig setup successful!
Account ID: ${result.accountId}
Transaction Hash: ${result.transactionHash || "N/A"}
Total Signers: ${result.signers.length}
Thresholds: Low=${result.thresholds.low_threshold}, Med=${
        result.thresholds.med_threshold
      }, High=${result.thresholds.high_threshold}

Signers:
${result.signers
  .map(
    (signer, i) =>
      `${i + 1}. ${signer.key.substring(0, 10)}...${signer.key.substring(
        signer.key.length - 10
      )} (Weight: ${signer.weight})`
  )
  .join("\n")}`);
    } catch (err) {
      setError(`Multi-sig setup failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createTransaction = async (e) => {
    e.preventDefault();

    if (!transactionForm.sourceAccount) {
      setError("Please provide source account public key");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setResult("");

      let operations = [];

      if (transactionForm.operationType === "payment") {
        if (!transactionForm.destination || !transactionForm.amount) {
          setError("Please provide destination and amount for payment");
          return;
        }

        operations.push(
          stellarService.createPaymentOperation(
            transactionForm.destination,
            transactionForm.amount
          )
        );
      } else if (transactionForm.operationType === "createAccount") {
        if (!transactionForm.destination || !transactionForm.startingBalance) {
          setError(
            "Please provide destination and starting balance for account creation"
          );
          return;
        }

        operations.push(
          stellarService.createAccountOperation(
            transactionForm.destination,
            transactionForm.startingBalance
          )
        );
      }

      const txResult = await stellarService.createMultisigTransaction(
        transactionForm.sourceAccount,
        operations
      );

      setResult(`📝 Transaction created successfully!

Transaction XDR (copy this to share with signers):
${txResult.xdr}

Transaction Hash: ${txResult.hash}

⚠️ This transaction needs to be signed by multiple parties before submission.
Share the XDR above with the required signers.`);

      // Auto-populate signing form
      setSigningForm({
        ...signingForm,
        transactionXdr: txResult.xdr,
      });
    } catch (err) {
      setError(`Transaction creation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const signTransaction = async (e) => {
    e.preventDefault();

    if (!signingForm.transactionXdr) {
      setError("Please provide transaction XDR");
      return;
    }

    if (!isWalletConnected) {
      setError("Please connect your Freighter wallet to sign the transaction");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setResult("");
      console.log("running addSignatureToTransactionWithWallet");
      const signResult =
        await stellarService.addSignatureToTransactionWithWallet(
          signingForm.transactionXdr,
          publicKey
        );

      setResult(`✍️ Transaction signed successfully!

Signer: ${signResult.signerPublicKey}
Total Signatures: ${signResult.signatures}
Required: ${signingForm.requiredSignatures}

Updated Transaction XDR:
${signResult.signedXdr}

${
  signResult.signatures >= signingForm.requiredSignatures
    ? "✅ Transaction has enough signatures and can be submitted!"
    : `⏳ Need ${
        signingForm.requiredSignatures - signResult.signatures
      } more signature(s)`
}`);

      // Update the XDR with the new signature
      setSigningForm({
        ...signingForm,
        transactionXdr: signResult.signedXdr,
        currentSignatures: signResult.signatures,
      });
    } catch (err) {
      setError(`Transaction signing failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const submitTransaction = async () => {
    if (!signingForm.transactionXdr) {
      setError("No transaction XDR to submit");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setResult("");

      const submitResult = await stellarService.submitMultisigTransaction(
        signingForm.transactionXdr
      );

      setResult(`🎉 Multi-sig transaction submitted successfully!

Transaction Hash: ${submitResult.hash}
Ledger: ${submitResult.ledger}
Signatures Used: ${submitResult.signatures}

View on Stellar Expert: https://stellar.expert/explorer/testnet/tx/${submitResult.hash}`);
    } catch (err) {
      setError(`Transaction submission failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAccountInfo = async () => {
    if (!transactionForm.sourceAccount) {
      setError("Please enter an account public key to check");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const info = await stellarService.getAccountSigners(
        transactionForm.sourceAccount
      );
      setAccountInfo(info);

      // Update required signatures based on account configuration
      const requiredSigs = stellarService.getRequiredSignatures(
        info,
        transactionForm.operationType
      );
      setSigningForm((prev) => ({
        ...prev,
        requiredSignatures: requiredSigs,
      }));
    } catch (err) {
      setError(`Failed to load account info: ${err.message}`);
      setAccountInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="multisig-manager">
      <h2>🔐 Multi-Signature Account Manager</h2>
      <p className="description">
        Create and manage multi-signature Stellar accounts for enhanced
        security.
      </p>

      {/* Wallet Connection Status */}
      <div className="wallet-status">
        <h3>🔗 Wallet Connection</h3>
        {isWalletConnected ? (
          <div className="connected">
            <p>
              ✅ Connected: {publicKey?.substring(0, 10)}...
              {publicKey?.substring(publicKey.length - 10)}
            </p>
          </div>
        ) : (
          <div className="disconnected">
            <p>❌ Wallet not connected</p>
            <small>
              Please connect your Freighter wallet to sign transactions
            </small>
          </div>
        )}
      </div>

      {/* Keypair Generator */}
      {/* <KeypairGenerator /> */}

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

      {/* Multi-sig Setup */}
      <div className="multisig-form">
        <h3>1️⃣ Setup Multi-Signature Account</h3>
        <form onSubmit={setupMultiSig}>
          <div className="form-group">
            <label>Master Account Public Key:</label>
            <input
              type="text"
              value={setupForm.masterPublicKey}
              onChange={(e) =>
                setSetupForm({ ...setupForm, masterPublicKey: e.target.value })
              }
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              required
            />
            <small>
              The account that will become multi-sig (must be connected in
              Freighter)
            </small>
            {isWalletConnected && (
              <button
                type="button"
                onClick={() =>
                  setSetupForm({ ...setupForm, masterPublicKey: publicKey })
                }
                className="use-connected-btn"
              >
                Use Connected Account
              </button>
            )}
          </div>

          <div className="signers-section">
            <label>Signer Public Keys:</label>
            {setupForm.signerPublicKeys.map((publicKey, index) => (
              <div key={index} className="signer-input">
                <input
                  type="text"
                  value={publicKey}
                  onChange={(e) => {
                    const newPublicKeys = [...setupForm.signerPublicKeys];
                    newPublicKeys[index] = e.target.value;
                    setSetupForm({
                      ...setupForm,
                      signerPublicKeys: newPublicKeys,
                    });
                  }}
                  placeholder={`Signer ${index + 1} Public Key (GXXX...)`}
                  required
                />
              </div>
            ))}
            <small>All 5 signer accounts (each will have weight 1)</small>
          </div>

          <div className="thresholds-section">
            <h4>Signature Thresholds:</h4>
            <div className="threshold-inputs">
              <div className="threshold-input">
                <label>Low:</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={setupForm.lowThreshold}
                  onChange={(e) =>
                    setSetupForm({
                      ...setupForm,
                      lowThreshold: parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div className="threshold-input">
                <label>Medium:</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={setupForm.medThreshold}
                  onChange={(e) =>
                    setSetupForm({
                      ...setupForm,
                      medThreshold: parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div className="threshold-input">
                <label>High:</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={setupForm.highThreshold}
                  onChange={(e) =>
                    setSetupForm({
                      ...setupForm,
                      highThreshold: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <small>
              Required signature weight for different operation types
            </small>
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Setting up..." : "Setup Multi-Sig Account"}
          </button>
        </form>
      </div>

      {/* Transaction Creation */}
      {/* <div className="multisig-form">
        <h3>2️⃣ Create Multi-Sig Transaction</h3>

        <div className="account-check">
          <div className="form-group">
            <label>Source Account (Multi-sig):</label>
            <div className="input-with-button">
              <input
                type="text"
                value={transactionForm.sourceAccount}
                onChange={(e) =>
                  setTransactionForm({
                    ...transactionForm,
                    sourceAccount: e.target.value,
                  })
                }
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              />
              <button
                type="button"
                onClick={checkAccountInfo}
                disabled={isLoading}
              >
                Check Account
              </button>
            </div>
          </div>

          {accountInfo && (
            <div className="account-info-display">
              <h4>Account Information:</h4>
              <p>
                <strong>Multi-sig:</strong>{" "}
                {accountInfo.isMultisig ? "✅ Yes" : "❌ No"}
              </p>
              <p>
                <strong>Signers:</strong> {accountInfo.totalSigners}
              </p>
              <p>
                <strong>Thresholds:</strong> Low={accountInfo.thresholds.low},
                Med={accountInfo.thresholds.medium}, High=
                {accountInfo.thresholds.high}
              </p>
              <p>
                <strong>
                  Required Signatures for {transactionForm.operationType}:
                </strong>{" "}
                {signingForm.requiredSignatures}
              </p>

              <div className="signers-list">
                <strong>Signers:</strong>
                {accountInfo.signers.map((signer, index) => (
                  <div key={index} className="signer-item">
                    {signer.publicKey.substring(0, 10)}...
                    {signer.publicKey.substring(signer.publicKey.length - 10)}
                    (Weight: {signer.weight})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={createTransaction}>
          <div className="form-group">
            <label>Operation Type:</label>
            <select
              value={transactionForm.operationType}
              onChange={(e) =>
                setTransactionForm({
                  ...transactionForm,
                  operationType: e.target.value,
                })
              }
            >
              <option value="payment">Payment</option>
              <option value="createAccount">Create Account</option>
            </select>
          </div>

          <div className="form-group">
            <label>Destination:</label>
            <input
              type="text"
              value={transactionForm.destination}
              onChange={(e) =>
                setTransactionForm({
                  ...transactionForm,
                  destination: e.target.value,
                })
              }
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              required
            />
          </div>

          {transactionForm.operationType === "payment" && (
            <div className="form-group">
              <label>Amount (XLM):</label>
              <input
                type="number"
                step="0.0000001"
                value={transactionForm.amount}
                onChange={(e) =>
                  setTransactionForm({
                    ...transactionForm,
                    amount: e.target.value,
                  })
                }
                placeholder="10.5"
                required
              />
            </div>
          )}

          {transactionForm.operationType === "createAccount" && (
            <div className="form-group">
              <label>Starting Balance (XLM):</label>
              <input
                type="number"
                step="0.0000001"
                value={transactionForm.startingBalance}
                onChange={(e) =>
                  setTransactionForm({
                    ...transactionForm,
                    startingBalance: e.target.value,
                  })
                }
                placeholder="100"
                required
              />
            </div>
          )}

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Transaction"}
          </button>
        </form>
      </div> */}

      {/* Transaction Signing */}
      {/* <div className="multisig-form">
        <h3>3️⃣ Sign Transaction</h3>
        <form onSubmit={signTransaction}>
          <div className="form-group">
            <label>Transaction XDR:</label>
            <textarea
              value={signingForm.transactionXdr}
              onChange={(e) =>
                setSigningForm({
                  ...signingForm,
                  transactionXdr: e.target.value,
                })
              }
              placeholder="Paste transaction XDR here..."
              rows="4"
              required
            />
            <small>
              Copy the XDR from step 2 or receive it from another signer
            </small>
          </div>

          <div className="wallet-signer-info">
            <p>
              <strong>Current Signer:</strong>{" "}
              {isWalletConnected
                ? `${publicKey?.substring(0, 10)}...${publicKey?.substring(
                    publicKey.length - 10
                  )}`
                : "No wallet connected"}
            </p>
            <small>
              Make sure your connected wallet is one of the authorized signers
            </small>
          </div>

          <div className="signature-status">
            <p>Current Signatures: {signingForm.currentSignatures}</p>
            <p>Required Signatures: {signingForm.requiredSignatures}</p>
          </div>

          <div className="signing-buttons">
            <button type="submit" disabled={isLoading || !isWalletConnected}>
              {isLoading ? "Signing..." : "Add Signature with Freighter"}
            </button>

            {signingForm.currentSignatures >=
              signingForm.requiredSignatures && (
              <button
                type="button"
                onClick={submitTransaction}
                disabled={isLoading}
                className="submit-btn"
              >
                {isLoading ? "Submitting..." : "Submit Transaction"}
              </button>
            )}

            {signingForm.currentSignatures > 0 &&
              signingForm.currentSignatures <
                signingForm.requiredSignatures && (
                <p className="signature-warning">
                  ⚠️ Need{" "}
                  {signingForm.requiredSignatures -
                    signingForm.currentSignatures}{" "}
                  more signature(s) before submission
                </p>
              )}
          </div>
        </form>
      </div> */}

      {/* <div className="multisig-info">
        <h4>Multi-Signature Workflow with Freighter:</h4>
        <ol>
          <li>
            <strong>Connect Wallet:</strong> Connect your Freighter wallet that
            contains the master account
          </li>
          <li>
            <strong>Setup:</strong> Convert a regular account to multi-sig by
            adding signer public keys and setting thresholds (requires master
            account signature)
          </li>
          <li>
            <strong>Create:</strong> Build a transaction that requires multiple
            signatures
          </li>
          <li>
            <strong>Sign:</strong> Each required signer connects their Freighter
            wallet and adds their signature to the transaction
          </li>
          <li>
            <strong>Submit:</strong> Once enough signatures are collected,
            submit to the network
          </li>
        </ol>

        <h4>Security Benefits:</h4>
        <ul>
          <li>🔒 No private keys exposed in the interface</li>
          <li>🦺 Freighter wallet provides secure key management</li>
          <li>👥 Distributed control among multiple parties</li>
          <li>🛡️ Protection against key compromise</li>
          <li>📋 Audit trail of all signers</li>
          <li>⚖️ Customizable signature thresholds</li>
        </ul>
      </div> */}
    </div>
  );
};

export default MultiSigManager;
