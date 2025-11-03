import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import * as StellarSdk from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(morgan("combined"));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

// Stellar Configuration
const HORIZON_URL =
  process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";
const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;

// Initialize Stellar servers
const horizon = new StellarSdk.Horizon.Server(
  "https://horizon-testnet.stellar.org"
);
const rpc = new Server("https://soroban-testnet.stellar.org");

console.log("🚀 Stellar Backend Server Starting...");
console.log("📡 Horizon URL:", HORIZON_URL);
console.log("🔗 RPC URL:", RPC_URL);
console.log("🌐 Network:", NETWORK_PASSPHRASE);

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Test Horizon connection
    const horizonHealth = await horizon.ledgers().limit(1).call();

    // Test RPC connection
    const rpcHealth = await rpc.getHealth();

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        horizon: {
          url: HORIZON_URL,
          status: "connected",
          latestLedger: horizonHealth.records[0].sequence,
        },
        rpc: {
          url: RPC_URL,
          status: rpcHealth.status,
          ledgerNumber: rpcHealth.ledgerNumber,
        },
      },
      network: NETWORK_PASSPHRASE,
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get account information
app.get("/api/account/:publicKey", async (req, res) => {
  try {
    const { publicKey } = req.params;

    if (!publicKey || !publicKey.startsWith("G") || publicKey.length !== 56) {
      return res.status(400).json({
        error: "Invalid public key format",
      });
    }

    const account = await horizon.loadAccount(publicKey);

    res.json({
      accountId: publicKey,
      sequence: account.sequenceNumber(),
      balances: account.balances,
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
      isMultisig:
        account.signers.length > 1 && account.thresholds.med_threshold > 1,
    });
  } catch (error) {
    console.error("Error fetching account:", error);

    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        error: "Account not found",
        message: "Account does not exist or is not funded",
      });
    }

    res.status(500).json({
      error: "Failed to fetch account information",
      message: error.message,
    });
  }
});

// Build contract transaction
app.post("/api/contract/build", async (req, res) => {
  try {
    const { sourceAccount, contractId, method, parameters } = req.body;

    // Validation
    if (
      !sourceAccount ||
      !sourceAccount.startsWith("G") ||
      sourceAccount.length !== 56
    ) {
      return res.status(400).json({
        error: "Invalid source account format",
      });
    }

    if (
      !contractId ||
      !contractId.startsWith("C") ||
      contractId.length !== 56
    ) {
      return res.status(400).json({
        error: "Invalid contract ID format",
      });
    }

    if (!method) {
      return res.status(400).json({
        error: "Contract method is required",
      });
    }

    console.log("Building contract transaction:", {
      sourceAccount,
      contractId,
      method,
      parameters,
    });

    // Load account from RPC
    const account = await rpc.getAccount(sourceAccount);

    // Create contract instance
    const contract = new StellarSdk.Contract(contractId);

    // Convert parameters to ScVal format
    const scValParams = (parameters || []).map((param) => {
      if (param.type === "address") {
        return StellarSdk.Address.fromString(param.value).toScVal();
      } else if (param.type === "i128") {
        return StellarSdk.nativeToScVal(BigInt(param.value), { type: "i128" });
      } else if (param.type === "string") {
        return StellarSdk.nativeToScVal(param.value, { type: "string" });
      } else if (param.type === "u32") {
        return StellarSdk.nativeToScVal(parseInt(param.value), { type: "u32" });
      } else if (param.type === "bool") {
        return StellarSdk.nativeToScVal(param.value === "true", {
          type: "bool",
        });
      } else {
        return StellarSdk.nativeToScVal(param.value);
      }
    });

    console.log("Converted parameters:", scValParams);

    // Build contract call operation
    const operation = contract.call(method, ...scValParams);

    // Build transaction
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(3600)
      .build();

    console.log("Transaction built, preparing...");

    // Prepare transaction (includes simulation)
    const preparedTx = await rpc.prepareTransaction(transaction);

    console.log("Transaction prepared successfully");

    const transactionXdr = preparedTx.toXDR();
    const transactionHash = preparedTx.hash().toString("hex");

    res.json({
      success: true,
      transactionXdr: transactionXdr,
      transactionHash: transactionHash,
      networkPassphrase: NETWORK_PASSPHRASE,
      operation: {
        type: "contract_call",
        contractId: contractId,
        method: method,
        parameters: parameters,
      },
      fee: StellarSdk.BASE_FEE,
      timeout: 300,
    });
  } catch (error) {
    console.error("Error building contract transaction:", error);

    res.status(500).json({
      error: "Failed to build contract transaction",
      message: error.message,
      details: error.response?.data || null,
    });
  }
});

// Build contract transfer transaction (specialized endpoint)
app.post("/api/contract/transfer", async (req, res) => {
  try {
    const { sourceAccount, contractId, fromAddress, toAddress, amount } =
      req.body;

    // Validation
    if (
      !sourceAccount ||
      !contractId ||
      !fromAddress ||
      !toAddress ||
      !amount
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: sourceAccount, contractId, fromAddress, toAddress, amount",
      });
    }

    console.log("Building contract transfer:", {
      sourceAccount,
      contractId,
      fromAddress,
      toAddress,
      amount,
    });

    // Use the generic contract build endpoint logic
    const parameters = [
      { type: "address", value: fromAddress },
      { type: "address", value: toAddress },
      { type: "i128", value: amount },
    ];

    // Load account from RPC
    const account = await rpc.getAccount(sourceAccount);

    // Create contract instance
    const contract = new StellarSdk.Contract(contractId);

    // Build contract call operation
    const operation = contract.call(
      "transfer",
      StellarSdk.Address.fromString(fromAddress).toScVal(),
      StellarSdk.Address.fromString(toAddress).toScVal(),
      StellarSdk.nativeToScVal(BigInt(amount), { type: "i128" })
    );

    // Build transaction
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(3600)
      .build();

    // Prepare transaction

    const preparedTx = await rpc.prepareTransaction(transaction);

    const transactionXdr = preparedTx.toXDR();
    const transactionHash = preparedTx.hash().toString("hex");

    res.json({
      success: true,
      transactionXdr: transactionXdr,
      transactionHash: transactionHash,
      networkPassphrase: NETWORK_PASSPHRASE,
      operation: {
        type: "contract_transfer",
        contractId: contractId,
        fromAddress: fromAddress,
        toAddress: toAddress,
        amount: amount,
      },
    });
  } catch (error) {
    console.error("Error building contract transfer:", error);

    res.status(500).json({
      error: "Failed to build contract transfer",
      message: error.message,
    });
  }
});

// Submit signed transaction
app.post("/api/transaction/submit", async (req, res) => {
  try {
    const { signedTransactionXdr } = req.body;

    if (!signedTransactionXdr) {
      return res.status(400).json({
        error: "Signed transaction XDR is required",
      });
    }

    console.log("Submitting signed transaction...");

    // Parse the signed transaction
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedTransactionXdr,
      NETWORK_PASSPHRASE
    );

    console.log("Transaction signatures:", transaction.signatures.length);

    // Submit to network
    const response = await rpc.sendTransaction(transaction);

    console.log("Transaction submitted:", response);

    // Poll for result if pending
    if (response.status === "PENDING") {
      console.log("Transaction pending, polling for result...");

      let txResponse = await rpc.getTransaction(response.hash);
      let attempts = 0;
      const maxAttempts = 30;

      while (txResponse.status === "NOT_FOUND" && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        txResponse = await rpc.getTransaction(response.hash);
        attempts++;
      }

      if (txResponse.status === "SUCCESS") {
        console.log("Transaction successful!");

        // Parse return value if available
        let returnValue = null;
        if (txResponse.returnValue) {
          try {
            returnValue = StellarSdk.scValToNative(txResponse.returnValue);
          } catch (e) {
            console.warn("Could not parse return value:", e);
          }
        }

        res.json({
          success: true,
          hash: response.hash,
          status: txResponse.status,
          ledger: txResponse.ledger,
          returnValue: returnValue,
          signatures: transaction.signatures.length,
        });
      } else if (txResponse.status === "FAILED") {
        console.error("Transaction failed:", txResponse);
        res.status(400).json({
          success: false,
          hash: response.hash,
          status: txResponse.status,
          error: "Transaction failed",
          details: txResponse,
        });
      } else {
        console.error("Transaction timeout or unknown status");
        res.status(408).json({
          success: false,
          hash: response.hash,
          status: txResponse.status,
          error: "Transaction timeout or unknown status",
        });
      }
    } else {
      // Immediate response
      res.json({
        success: true,
        hash: response,
        status: response.status,
        signatures: transaction.signatures.length,
      });
    }
  } catch (error) {
    console.error("Error submitting transaction:", error);

    // Enhanced error handling
    if (error.response && error.response.data) {
      const errorData = error.response.data;

      if (errorData.extras && errorData.extras.result_codes) {
        const { result_codes } = errorData.extras;

        let errorMessage = "Transaction submission failed";

        if (result_codes.transaction === "tx_bad_auth") {
          errorMessage = "Insufficient signatures or invalid signature weight";
        } else if (result_codes.transaction === "tx_bad_auth_extra") {
          errorMessage = "Too many signatures or duplicate signatures";
        } else if (result_codes.transaction === "tx_malformed") {
          errorMessage = "Transaction is malformed";
        }

        return res.status(400).json({
          success: false,
          error: errorMessage,
          resultCodes: result_codes,
          details: errorData,
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to submit transaction",
      message: error.message,
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stellar Multi-Sig Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(
    `🔗 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`
  );
});

export default app;
