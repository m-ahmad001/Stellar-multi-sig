import { signTransaction } from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

class StellarService {
  constructor(networkType = "testnet") {
    this.networkType = networkType;

    if (networkType === "mainnet" || networkType === "PUBLIC") {
      this.server = new Server("https://soroban-testnet.stellar.org");
      this.rpc = new StellarSdk.Horizon.Server(
        "https://horizon-testnet.stellar.org"
      );
      this.networkPassphrase = StellarSdk.Networks.PUBLIC;
      this.networkName = "PUBLIC";
    } else {
      this.server = new Server("https://soroban-testnet.stellar.org");
      this.rpc = new StellarSdk.Horizon.Server(
        "https://horizon-testnet.stellar.org"
      );
      this.networkPassphrase = StellarSdk.Networks.TESTNET;
      this.networkName = "TESTNET";
    }
  }

  // Get account details
  async getAccount(publicKey) {
    try {
      // Try RPC first for Soroban compatibility, fallback to Horizon
      try {
        return await this.rpc.getAccount(publicKey);
      } catch (rpcError) {
        // Fallback to Horizon server
        return await this.rpc.loadAccount(publicKey);
      }
    } catch (error) {
      console.error("Error loading account:", error);
      throw error;
    }
  }

  // Get account balance
  async getAccountBalance(publicKey) {
    try {
      const account = await this.getAccount(publicKey);
      return account.balances;
    } catch (error) {
      console.error("Error getting account balance:", error);
      throw error;
    }
  }

  // Create a payment transaction
  async createPaymentTransaction(
    sourcePublicKey,
    destinationPublicKey,
    amount,
    assetCode = "XLM",
    assetIssuer = null
  ) {
    try {
      const sourceAccount = await this.getAccount(sourcePublicKey);

      let asset;
      if (assetCode === "XLM") {
        asset = StellarSdk.Asset.native();
      } else {
        if (!assetIssuer) {
          throw new Error("Asset issuer is required for non-native assets");
        }
        asset = new StellarSdk.Asset(assetCode, assetIssuer);
      }

      // Get base fee and add some buffer for network congestion
      const baseFee = await this.server.fetchBaseFee();
      const fee = Math.max(
        parseInt(baseFee) * 2,
        parseInt(StellarSdk.BASE_FEE)
      ).toString();

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: fee,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationPublicKey,
            asset: asset,
            amount: amount.toString(),
          })
        )
        .setTimeout(300) // 5 minutes
        .build();

      return transaction;
    } catch (error) {
      console.error("Error creating payment transaction:", error);
      throw error;
    }
  }

  // Submit a signed transaction
  async submitTransaction(signedTransactionXdr) {
    try {
      // Parse the signed transaction XDR
      const transaction = StellarSdk.TransactionBuilder.fromXDR(
        signedTransactionXdr,
        this.networkPassphrase
      );

      const result = await this.server.submitTransaction(transaction);
      return result;
    } catch (error) {
      console.error("Error submitting transaction:", error);

      // Enhanced error handling
      if (error.response && error.response.data && error.response.data.extras) {
        const { result_codes } = error.response.data.extras;
        console.error("Transaction result codes:", result_codes);

        // Provide more user-friendly error messages
        if (result_codes.transaction === "tx_insufficient_balance") {
          throw new Error("Insufficient balance to complete transaction");
        } else if (result_codes.transaction === "tx_bad_seq") {
          throw new Error("Transaction sequence number is invalid");
        } else if (
          result_codes.operations &&
          result_codes.operations.includes("op_underfunded")
        ) {
          throw new Error("Account has insufficient funds for this operation");
        }
      }

      throw error;
    }
  }

  // Create and invoke a contract (modern approach)
  async invokeContract(sourcePublicKey, contractAddress, method, params = []) {
    try {
      // Get account from RPC server
      const sourceAccount = await this.server.getAccount(sourcePublicKey);
      console.log(
        "🚀 ~ StellarService ~ invokeContract ~ sourceAccount:",
        sourceAccount
      );
      const contract = new StellarSdk.Contract(contractAddress);

      // Convert params properly
      const scValParams = params.map((param) => {
        if (typeof param === "string" && param.startsWith("G")) {
          return StellarSdk.Address.fromString(param).toScVal();
        }
        if (typeof param === "bigint" || typeof param === "number") {
          return StellarSdk.nativeToScVal(BigInt(param), { type: "i128" });
        }
        return StellarSdk.nativeToScVal(param);
      });
      console.log("🚀 ~ StellarService  ~ scValParams:", scValParams);

      // Build the contract call operation
      const operation = contract.call("set_name", ...scValParams);

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(300)
        .build();
      console.log(
        "🚀 ~ StellarService ~ invokeContract ~ transaction:",
        transaction
      );

      // Prepare transaction (this handles simulation and auth)
      const preparedTransaction = await this.server.prepareTransaction(
        transaction
      );
      console.log(
        "🚀 ~ StellarService ~ invokeContract ~ preparedTransaction:",
        preparedTransaction
      );

      return preparedTransaction;
    } catch (error) {
      // Enhanced error handling for contract preparation
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        console.error("Stellar error response:", errorData);

        // Handle simulation errors
        if (errorData.extras && errorData.extras.result_codes) {
          const { result_codes } = errorData.extras;
          console.error("Transaction result codes:", result_codes);

          if (result_codes.transaction === "tx_insufficient_balance") {
            throw new Error("Insufficient balance to pay for transaction fees");
          } else if (result_codes.transaction === "tx_bad_seq") {
            throw new Error(
              "Invalid sequence number - account may have pending transactions"
            );
          } else if (result_codes.operations) {
            const opErrors = result_codes.operations;
            if (
              opErrors.includes("op_invoke_host_function_insufficient_balance")
            ) {
              throw new Error(
                "Insufficient balance to execute contract function"
              );
            } else if (
              opErrors.includes("op_invoke_host_function_entry_expired")
            ) {
              throw new Error("Contract function entry has expired");
            } else if (
              opErrors.includes(
                "op_invoke_host_function_resource_limit_exceeded"
              )
            ) {
              throw new Error("Contract execution exceeded resource limits");
            } else if (opErrors.includes("op_invoke_host_function_trapped")) {
              throw new Error("Contract function execution failed or panicked");
            } else {
              throw new Error(
                `Contract operation failed: ${opErrors.join(", ")}`
              );
            }
          }
        }

        // Handle RPC-specific errors
        if (errorData.code) {
          switch (errorData.code) {
            case -32602:
              throw new Error("Invalid contract parameters or method name");
            case -32603:
              throw new Error(
                "Internal server error during contract preparation"
              );
            case -32001:
              throw new Error("Contract not found or invalid contract address");
            default:
              throw new Error(
                `RPC Error (${errorData.code}): ${
                  errorData.message || "Unknown error"
                }`
              );
          }
        }

        // Generic error message extraction
        if (errorData.message) {
          throw new Error(`Contract preparation failed: ${errorData.message}`);
        }
      }

      // Handle network or connection errors
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        throw new Error(
          "Unable to connect to Stellar network - please check your internet connection"
        );
      }

      // Handle timeout errors
      if (error.code === "ETIMEDOUT") {
        throw new Error(
          "Request timed out - Stellar network may be experiencing high load"
        );
      }

      console.error("Error creating contract transaction:", error);
      throw error;
    }
  }

  // Submit a prepared contract transaction
  async submitContractTransaction(signedTransactionXdr) {
    try {
      // Parse the signed transaction XDR
      const transaction = StellarSdk.TransactionBuilder.fromXDR(
        signedTransactionXdr,
        this.networkPassphrase
      );

      // Send transaction
      const response = await this.rpc.submitTransaction(transaction);

      // Poll for result
      let txResponse = await this.rpc.getTransaction(response.hash);
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (txResponse.status === "NOT_FOUND" && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        txResponse = await this.rpc.getTransaction(response.hash);
        attempts++;
      }

      if (txResponse.status === "SUCCESS") {
        // Parse return value if available
        let returnValue = null;
        if (txResponse.returnValue) {
          try {
            returnValue = StellarSdk.scValToNative(txResponse.returnValue);
          } catch (e) {
            console.warn("Could not parse return value:", e);
          }
        }

        return {
          hash: response.hash,
          status: txResponse.status,
          returnValue: returnValue,
          successful: true,
        };
      } else {
        throw new Error(`Transaction failed with status: ${txResponse.status}`);
      }
    } catch (error) {
      console.error("Error submitting contract transaction:", error);
      throw error;
    }
  }

  // Read-only contract call (no transaction needed)
  async readContract(contractAddress, method, params = []) {
    try {
      const contract = new StellarSdk.Contract(contractAddress);

      // We need any funded account for simulation
      // Using a well-known testnet account for simulation only
      const dummyAccount = await this.server.getAccount(
        "GCA3XIQAK2JKH7SDTVEEALP4HIMS4HULVMK3QCH5GQH4KLIWQW4CSCKF"
      );

      // Convert parameters
      const scValParams = params.map((param) => {
        if (typeof param === "string") {
          return StellarSdk.nativeToScVal(param, { type: "string" });
        } else if (typeof param === "number") {
          return StellarSdk.nativeToScVal(param, { type: "u32" });
        } else {
          return StellarSdk.nativeToScVal(param);
        }
      });

      const operation = contract.call(method, ...scValParams);

      const tx = new StellarSdk.TransactionBuilder(dummyAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(300)
        .build();

      // Simulate only (no signing/sending)
      const simulation = await this.server._simulateTransaction(tx);
      console.log(
        "🚀 ~ StellarService ~ readContract ~ simulation:",
        simulation
      );

      if (simulation.results) {
        const result = StellarSdk.scValToNative(simulation.results.retval);
        return result;
      } else {
        throw new Error("Simulation failed");
      }
    } catch (error) {
      console.error("Error reading contract:", error);
      throw error;
    }
  }

  // Get contract data (using modern RPC approach)
  async getContractData(contractAddress, key) {
    try {
      const response = await this.rpc.getContractData(contractAddress, key);
      return response;
    } catch (error) {
      console.error("Error getting contract data:", error);
      throw error;
    }
  }

  // Helper method to convert XLM to stroops
  static xlmToStroops(xlmAmount) {
    return (parseFloat(xlmAmount) * 10000000).toString();
  }

  // Helper method to convert stroops to XLM
  static stroopsToXlm(stroopsAmount) {
    return (parseInt(stroopsAmount) / 10000000).toString();
  }

  // Multi-signature account setup with Freighter wallet
  async setupMultisigWithWallet(
    masterPublicKey,
    signerPublicKeys,
    thresholds = { low: 3, med: 3, high: 3 },
    connectedPublicKey
  ) {
    try {
      // Verify the connected account matches the master account
      if (masterPublicKey !== connectedPublicKey) {
        throw new Error(
          "Connected wallet account does not match master account"
        );
      }

      console.log("Setting up multisig for account:", masterPublicKey);

      // Load the master account
      const masterAccount = await this.rpc.loadAccount(masterPublicKey);

      // Check if account is already multisig
      if (
        masterAccount.signers.length > 1 &&
        masterAccount.thresholds.med_threshold > 1
      ) {
        return {
          success: true,
          message: "Account is already configured as multisig",
          accountId: masterPublicKey,
          signers: masterAccount.signers,
          thresholds: masterAccount.thresholds,
        };
      }

      // Build transaction to add all signers and set thresholds
      let transactionBuilder = new StellarSdk.TransactionBuilder(
        masterAccount,
        {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: this.networkPassphrase,
        }
      );

      // Add all signers with weight 1
      signerPublicKeys.forEach((signerPublicKey) => {
        transactionBuilder = transactionBuilder.addOperation(
          StellarSdk.Operation.setOptions({
            signer: {
              ed25519PublicKey: signerPublicKey,
              weight: 1,
            },
          })
        );
      });

      // Set thresholds and master weight
      transactionBuilder = transactionBuilder.addOperation(
        StellarSdk.Operation.setOptions({
          lowThreshold: thresholds.low,
          medThreshold: thresholds.med,
          highThreshold: thresholds.high,
          masterWeight: 1,
        })
      );

      const transaction = transactionBuilder.setTimeout(180).build();

      // Sign with Freighter wallet
      const signedTransaction = await signTransaction(transaction.toXDR(), {
        networkPassphrase: this.networkPassphrase,
        address: connectedPublicKey,
      });

      // Create transaction from signed XDR
      const finalTransaction = StellarSdk.TransactionBuilder.fromXDR(
        signedTransaction.signedTxXdr,
        this.networkPassphrase
      );

      // Submit transaction
      const result = await this.rpc.submitTransaction(finalTransaction);

      // Wait for propagation
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Get updated account info
      const updatedAccount = await this.rpc.loadAccount(masterPublicKey);

      return {
        success: true,
        message: "Multisig account setup successful",
        transactionHash: result.hash,
        accountId: masterPublicKey,
        signers: updatedAccount.signers,
        thresholds: updatedAccount.thresholds,
      };
    } catch (error) {
      console.error("Error setting up multisig:", error);
      throw error;
    }
  }

  // Original Multi-signature account setup (deprecated - kept for backward compatibility)
  async setupMultisig(
    masterSecret,
    signerSecrets,
    thresholds = { low: 3, med: 3, high: 3 }
  ) {
    try {
      const masterKeypair = StellarSdk.Keypair.fromSecret(masterSecret);

      // Create signer keypairs
      const signers = signerSecrets.map((secret) =>
        StellarSdk.Keypair.fromSecret(secret)
      );

      console.log(
        "Setting up multisig for account:",
        masterKeypair.publicKey()
      );

      // Load the master account
      const masterAccount = await this.rpc.loadAccount(
        masterKeypair.publicKey()
      );

      // Check if account is already multisig
      if (
        masterAccount.signers.length > 1 &&
        masterAccount.thresholds.med_threshold > 1
      ) {
        return {
          success: true,
          message: "Account is already configured as multisig",
          accountId: masterKeypair.publicKey(),
          signers: masterAccount.signers,
          thresholds: masterAccount.thresholds,
        };
      }

      // Build transaction to add all signers and set thresholds
      let transactionBuilder = new StellarSdk.TransactionBuilder(
        masterAccount,
        {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: this.networkPassphrase,
        }
      );

      // Add all signers with weight 1
      signers.forEach((signer) => {
        transactionBuilder = transactionBuilder.addOperation(
          StellarSdk.Operation.setOptions({
            signer: {
              ed25519PublicKey: signer.publicKey(),
              weight: 1,
            },
          })
        );
      });

      // Set thresholds and master weight
      transactionBuilder = transactionBuilder.addOperation(
        StellarSdk.Operation.setOptions({
          lowThreshold: thresholds.low,
          medThreshold: thresholds.med,
          highThreshold: thresholds.high,
          masterWeight: 1,
        })
      );

      const transaction = transactionBuilder.setTimeout(180).build();

      // Sign with master key
      transaction.sign(masterKeypair);

      // Submit transaction
      const result = await this.rpc.submitTransaction(transaction);

      // Wait for propagation
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Get updated account info
      const updatedAccount = await this.rpc.loadAccount(
        masterKeypair.publicKey()
      );

      return {
        success: true,
        message: "Multisig account setup successful",
        transactionHash: result.hash,
        accountId: masterKeypair.publicKey(),
        signers: updatedAccount.signers,
        thresholds: updatedAccount.thresholds,
      };
    } catch (error) {
      console.error("Error setting up multisig:", error);
      throw error;
    }
  }

  // Create a multisig transaction (returns XDR for signing)
  async createMultisigTransaction(sourcePublicKey, operations) {
    try {
      const sourceAccount = await this.rpc.loadAccount(sourcePublicKey);

      let transactionBuilder = new StellarSdk.TransactionBuilder(
        sourceAccount,
        {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: this.networkPassphrase,
        }
      );

      // Add all operations
      operations.forEach((op) => {
        transactionBuilder = transactionBuilder.addOperation(op);
      });

      const transaction = transactionBuilder.setTimeout(1000).build();

      return {
        transaction: transaction,
        xdr: transaction.toXDR(),
        hash: transaction.hash().toString("hex"),
        networkPassphrase: this.networkPassphrase,
      };
    } catch (error) {
      console.error("Error creating multisig transaction:", error);
      throw error;
    }
  }

  // Add a signature to an existing transaction using Freighter wallet
  async addSignatureToTransactionWithWallet(transactionXdr, publicKey) {
    try {
      console.log("Adding signature for:", publicKey);
      console.log("Transaction XDR length:", transactionXdr.length);

      const signature = await signTransaction(transactionXdr, {
        networkPassphrase: this.networkPassphrase,
        address: publicKey,
      });
      console.log("Freighter signature result:", signature);

      const transaction = StellarSdk.TransactionBuilder.fromXDR(
        signature.signedTxXdr,
        this.networkPassphrase
      );

      console.log("Transaction after signing:");
      console.log("- Source account:", transaction.source);
      console.log("- Signatures count:", transaction.signatures.length);
      console.log("- Network passphrase:", this.networkPassphrase);

      return {
        signedXdr: transaction.toXDR(),
        signerPublicKey: publicKey,
        signatures: transaction.signatures.length,
        signature: signature.signedTxXdr.toString("base64"),
      };
    } catch (error) {
      console.error("Error adding signature:", error);

      // Provide more helpful error messages for common Freighter issues
      if (error.message.includes("User declined")) {
        throw new Error(
          "User declined to sign the transaction in Freighter wallet"
        );
      } else if (error.message.includes("Wallet is locked")) {
        throw new Error(
          "Freighter wallet is locked - please unlock it and try again"
        );
      } else if (error.message.includes("Account not found")) {
        throw new Error(
          "The connected account is not authorized to sign this transaction"
        );
      }

      throw error;
    }
  } // Add a signature to an existing transaction (deprecated - kept for backward compatibility)
  async addSignatureToTransaction(transactionXdr, publicKey) {
    try {
      console.log("transactionXdr", transactionXdr);
      // const transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXdr, this.networkPassphrase);
      // const signerKeypair = StellarSdk.Keypair.fromSecret(signerSecret);
      // Create signature
      // const signature = signerKeypair.sign(transaction.hash());
      const signature = await signTransaction(transactionXdr, {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        address: publicKey,
      });
      console.log("-->", signature);
      console.log("-->", signature.signedTxXdr.toString("base64"));

      // Add signature to transaction
      // transaction.addSignature(publicKey, signature.signedTxXdr.toString('base64'));
      const transaction = StellarSdk.TransactionBuilder.fromXDR(
        signature.signedTxXdr,
        this.networkPassphrase
      );
      console.log("hash", transaction);

      return {
        signedXdr: transaction.toXDR(),
        signerPublicKey: publicKey,
        signatures: transaction.signatures.length,
        signature: signature.signedTxXdr.toString("base64"),
      };
    } catch (error) {
      console.error("Error adding signature:", error);
      throw error;
    }
  }

  // Validate transaction signatures before submission
  async validateTransactionSignatures(signedTransactionXdr, sourcePublicKey) {
    try {
      const transaction = StellarSdk.TransactionBuilder.fromXDR(
        signedTransactionXdr,
        this.networkPassphrase
      );

      const sourceAccount = await this.rpc.loadAccount(sourcePublicKey);
      const currentSignatures = transaction.signatures.length;
      const requiredThreshold = sourceAccount.thresholds.med_threshold;

      // Calculate total signature weight
      let totalWeight = 0;
      // Note: In a full implementation, you would verify the actual signers
      // against the account's authorized signers list

      return {
        isValid: currentSignatures >= requiredThreshold,
        currentSignatures,
        requiredThreshold,
        totalWeight,
        signers: sourceAccount.signers,
        message:
          currentSignatures >= requiredThreshold
            ? "Transaction has sufficient signatures"
            : `Need at least ${requiredThreshold} signatures, currently have ${currentSignatures}`,
      };
    } catch (error) {
      console.error("Error validating transaction signatures:", error);
      throw error;
    }
  }

  // Submit a multisig transaction
  async submitMultisigTransaction(signedTransactionXdr) {
    try {
      const transaction = StellarSdk.TransactionBuilder.fromXDR(
        signedTransactionXdr,
        this.networkPassphrase
      );

      // Log transaction details for debugging
      console.log(
        "Submitting transaction with signatures:",
        transaction.signatures.length
      );
      console.log("Transaction source:", transaction.source);

      const result = await this.rpc.submitTransaction(transaction);

      return {
        success: true,
        hash: result.hash,
        ledger: result.ledger,
        signatures: transaction.signatures.length,
      };
    } catch (error) {
      console.error("Error submitting multisig transaction:", error);

      // Log the full error for debugging
      if (error.response && error.response.data) {
        console.log(
          "Full error response:",
          JSON.stringify(error.response.data, null, 2)
        );
      }

      // Enhanced error handling for multisig failures
      if (error.response && error.response.data && error.response.data.extras) {
        const { result_codes } = error.response.data.extras;

        if (result_codes.transaction === "tx_bad_auth") {
          // Get more specific information about the authentication failure
          const transaction = StellarSdk.TransactionBuilder.fromXDR(
            signedTransactionXdr,
            this.networkPassphrase
          );

          throw new Error(
            `Insufficient signatures: Transaction has ${transaction.signatures.length} signature(s) but may need more weight or different signers. Check that all required signers have signed and the signature weight meets the account thresholds.`
          );
        } else if (result_codes.transaction === "tx_bad_auth_extra") {
          throw new Error("Too many signatures or duplicate signatures");
        } else if (result_codes.transaction === "tx_bad_seq") {
          throw new Error(
            "Invalid sequence number - the account may have other pending transactions"
          );
        }
      }

      throw error;
    }
  }

  // Get account signers and thresholds
  async getAccountSigners(publicKey) {
    try {
      const account = await this.rpc.loadAccount(publicKey);

      return {
        accountId: publicKey,
        signers: account.signers.map((signer) => ({
          publicKey: signer.key,
          weight: signer.weight,
          type: signer.type,
        })),
        thresholds: {
          low: account.thresholds.low_threshold,
          medium: account.thresholds.med_threshold,
          high: account.thresholds.high_threshold,
        },
        totalSigners: account.signers.length,
        isMultisig:
          account.signers.length > 1 && account.thresholds.med_threshold > 1,
      };
    } catch (error) {
      console.error("Error getting account signers:", error);
      throw error;
    }
  }

  // Calculate required signatures for a transaction type
  getRequiredSignatures(accountInfo, operationType = "payment") {
    if (!accountInfo || !accountInfo.thresholds) {
      return 1; // Default fallback
    }

    // Most operations (payment, createAccount, etc.) use medium threshold
    // High threshold is typically for account management operations
    // Low threshold is for trust lines and other low-risk operations
    switch (operationType) {
      case "payment":
      case "createAccount":
      case "pathPayment":
        return accountInfo.thresholds.medium;
      case "setOptions":
      case "manageSigner":
        return accountInfo.thresholds.high;
      case "changeTrust":
      case "allowTrust":
        return accountInfo.thresholds.low;
      default:
        return accountInfo.thresholds.medium;
    }
  }

  // Create payment operation for multisig
  createPaymentOperation(
    destination,
    amount,
    assetCode = "XLM",
    assetIssuer = null
  ) {
    let asset;
    if (assetCode === "XLM") {
      asset = StellarSdk.Asset.native();
    } else {
      asset = new StellarSdk.Asset(assetCode, assetIssuer);
    }

    return StellarSdk.Operation.payment({
      destination: destination,
      asset: asset,
      amount: amount.toString(),
    });
  }

  // Create account operation for multisig
  createAccountOperation(destination, startingBalance) {
    return StellarSdk.Operation.createAccount({
      destination: destination,
      startingBalance: startingBalance.toString(),
    });
  }
}

export default StellarService;
