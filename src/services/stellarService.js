import { signTransaction } from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';

class StellarService {
    constructor(networkType = 'testnet') {
        this.networkType = networkType;

        if (networkType === 'mainnet' || networkType === 'PUBLIC') {
            this.server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
            this.rpc = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
            this.networkPassphrase = StellarSdk.Networks.PUBLIC;
            this.networkName = 'PUBLIC';
        } else {
            this.server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
            this.rpc = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
            this.networkPassphrase = StellarSdk.Networks.TESTNET;
            this.networkName = 'TESTNET';
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
                return await this.server.loadAccount(publicKey);
            }
        } catch (error) {
            console.error('Error loading account:', error);
            throw error;
        }
    }

    // Get account balance
    async getAccountBalance(publicKey) {
        try {
            const account = await this.getAccount(publicKey);
            return account.balances;
        } catch (error) {
            console.error('Error getting account balance:', error);
            throw error;
        }
    }

    // Create a payment transaction
    async createPaymentTransaction(sourcePublicKey, destinationPublicKey, amount, assetCode = 'XLM', assetIssuer = null) {
        try {
            const sourceAccount = await this.getAccount(sourcePublicKey);

            let asset;
            if (assetCode === 'XLM') {
                asset = StellarSdk.Asset.native();
            } else {
                if (!assetIssuer) {
                    throw new Error('Asset issuer is required for non-native assets');
                }
                asset = new StellarSdk.Asset(assetCode, assetIssuer);
            }

            // Get base fee and add some buffer for network congestion
            const baseFee = await this.server.fetchBaseFee();
            const fee = Math.max(parseInt(baseFee) * 2, parseInt(StellarSdk.BASE_FEE)).toString();

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
            console.error('Error creating payment transaction:', error);
            throw error;
        }
    }

    // Submit a signed transaction
    async submitTransaction(signedTransactionXdr) {
        try {
            // Parse the signed transaction XDR
            const transaction = StellarSdk.TransactionBuilder.fromXDR(signedTransactionXdr, this.networkPassphrase);

            const result = await this.server.submitTransaction(transaction);
            return result;
        } catch (error) {
            console.error('Error submitting transaction:', error);

            // Enhanced error handling
            if (error.response && error.response.data && error.response.data.extras) {
                const { result_codes } = error.response.data.extras;
                console.error('Transaction result codes:', result_codes);

                // Provide more user-friendly error messages
                if (result_codes.transaction === 'tx_insufficient_balance') {
                    throw new Error('Insufficient balance to complete transaction');
                } else if (result_codes.transaction === 'tx_bad_seq') {
                    throw new Error('Transaction sequence number is invalid');
                } else if (result_codes.operations && result_codes.operations.includes('op_underfunded')) {
                    throw new Error('Account has insufficient funds for this operation');
                }
            }

            throw error;
        }
    }

    // Create and invoke a contract (modern approach)
    async invokeContract(sourcePublicKey, contractAddress, method, params = []) {
        try {
            // Get account from RPC server
            const sourceAccount = await this.rpc.accounts(sourcePublicKey);
            const contract = new StellarSdk.Contract(contractAddress);

            // Convert parameters to ScVal format
            const scValParams = params.map(param => {
                if (typeof param === 'string') {
                    return StellarSdk.nativeToScVal(param, { type: 'string' });
                } else if (typeof param === 'number') {
                    return StellarSdk.nativeToScVal(param, { type: 'u32' });
                } else if (typeof param === 'bigint') {
                    return StellarSdk.nativeToScVal(param, { type: 'i128' });
                } else if (typeof param === 'boolean') {
                    return StellarSdk.nativeToScVal(param, { type: 'bool' });
                } else {
                    // Try to handle as address if it looks like one
                    if (typeof param === 'string' && param.startsWith('G')) {
                        return StellarSdk.Address.fromString(param).toScVal();
                    }
                    return StellarSdk.nativeToScVal(param);
                }
            });

            // Build the contract call operation
            const operation = contract.call(method, ...scValParams);

            const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.networkPassphrase,
            })
                .addOperation(operation)
                .setTimeout(300)
                .build();

            // Prepare transaction (this handles simulation and auth)
            const preparedTransaction = await this.rpc.prepareTransaction(transaction);

            return preparedTransaction;
        } catch (error) {
            console.error('Error creating contract transaction:', error);
            throw error;
        }
    }

    // Submit a prepared contract transaction
    async submitContractTransaction(signedTransactionXdr) {
        try {
            // Parse the signed transaction XDR
            const transaction = StellarSdk.TransactionBuilder.fromXDR(signedTransactionXdr, this.networkPassphrase);

            // Send transaction
            const response = await this.rpc.submitTransaction(transaction);

            // Poll for result
            let txResponse = await this.rpc.getTransaction(response.hash);
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds timeout

            while (txResponse.status === "NOT_FOUND" && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));
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
                        console.warn('Could not parse return value:', e);
                    }
                }

                return {
                    hash: response.hash,
                    status: txResponse.status,
                    returnValue: returnValue,
                    successful: true
                };
            } else {
                throw new Error(`Transaction failed with status: ${txResponse.status}`);
            }
        } catch (error) {
            console.error('Error submitting contract transaction:', error);
            throw error;
        }
    }

    // Read-only contract call (no transaction needed)
    async readContract(contractAddress, method, params = []) {
        try {
            const contract = new StellarSdk.Contract(contractAddress);

            // We need any funded account for simulation
            // Using a well-known testnet account for simulation only
            const dummyAccount = await this.rpc.getAccount('GDAT5HWTGIU4TSSZ4752OUC4SABDLTLZFRPZUJ3D6LKBNEPA7V2CIG54');

            // Convert parameters
            const scValParams = params.map(param => {
                if (typeof param === 'string') {
                    return StellarSdk.nativeToScVal(param, { type: 'string' });
                } else if (typeof param === 'number') {
                    return StellarSdk.nativeToScVal(param, { type: 'u32' });
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
            const simulation = await this.rpc.simulateTransaction(tx);

            if (simulation.result) {
                const result = StellarSdk.scValToNative(simulation.result.retval);
                return result;
            } else {
                throw new Error('Simulation failed');
            }
        } catch (error) {
            console.error('Error reading contract:', error);
            throw error;
        }
    }

    // Get contract data (using modern RPC approach)
    async getContractData(contractAddress, key) {
        try {
            const response = await this.rpc.getContractData(contractAddress, key);
            return response;
        } catch (error) {
            console.error('Error getting contract data:', error);
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

    // Multi-signature account setup
    async setupMultisig(masterSecret, signerSecrets, thresholds = { low: 3, med: 3, high: 3 }) {
        try {
            const masterKeypair = StellarSdk.Keypair.fromSecret(masterSecret);

            // Create signer keypairs
            const signers = signerSecrets.map(secret => StellarSdk.Keypair.fromSecret(secret));

            console.log('Setting up multisig for account:', masterKeypair.publicKey());

            // Load the master account
            const masterAccount = await this.server.loadAccount(masterKeypair.publicKey());

            // Check if account is already multisig
            if (masterAccount.signers.length > 1 && masterAccount.thresholds.med_threshold > 1) {
                return {
                    success: true,
                    message: 'Account is already configured as multisig',
                    accountId: masterKeypair.publicKey(),
                    signers: masterAccount.signers,
                    thresholds: masterAccount.thresholds
                };
            }

            // Build transaction to add all signers and set thresholds
            let transactionBuilder = new StellarSdk.TransactionBuilder(masterAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.networkPassphrase
            });

            // Add all signers with weight 1
            signers.forEach(signer => {
                transactionBuilder = transactionBuilder.addOperation(
                    StellarSdk.Operation.setOptions({
                        signer: {
                            ed25519PublicKey: signer.publicKey(),
                            weight: 1
                        }
                    })
                );
            });

            // Set thresholds and master weight
            transactionBuilder = transactionBuilder.addOperation(
                StellarSdk.Operation.setOptions({
                    lowThreshold: thresholds.low,
                    medThreshold: thresholds.med,
                    highThreshold: thresholds.high,
                    masterWeight: 1
                })
            );

            const transaction = transactionBuilder.setTimeout(180).build();

            // Sign with master key
            transaction.sign(masterKeypair);

            // Submit transaction
            const result = await this.server.submitTransaction(transaction);

            // Wait for propagation
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Get updated account info
            const updatedAccount = await this.server.loadAccount(masterKeypair.publicKey());

            return {
                success: true,
                message: 'Multisig account setup successful',
                transactionHash: result.hash,
                accountId: masterKeypair.publicKey(),
                signers: updatedAccount.signers,
                thresholds: updatedAccount.thresholds
            };

        } catch (error) {
            console.error('Error setting up multisig:', error);
            throw error;
        }
    }

    // Create a multisig transaction (returns XDR for signing)
    async createMultisigTransaction(sourcePublicKey, operations) {
        try {
            const sourceAccount = await this.server.loadAccount(sourcePublicKey);

            let transactionBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.networkPassphrase
            });

            // Add all operations
            operations.forEach(op => {
                transactionBuilder = transactionBuilder.addOperation(op);
            });

            const transaction = transactionBuilder.setTimeout(1000).build();

            return {
                transaction: transaction,
                xdr: transaction.toXDR(),
                hash: transaction.hash().toString('hex'),
                networkPassphrase: this.networkPassphrase
            };

        } catch (error) {
            console.error('Error creating multisig transaction:', error);
            throw error;
        }
    }

    // Add a signature to an existing transaction
    async addSignatureToTransaction(transactionXdr, publicKey) {
        try {
            console.log("transactionXdr", transactionXdr)
            // const transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXdr, this.networkPassphrase);
            // const signerKeypair = StellarSdk.Keypair.fromSecret(signerSecret);
            // Create signature
            // const signature = signerKeypair.sign(transaction.hash());
            const signature = await signTransaction(transactionXdr, {
                networkPassphrase: StellarSdk.Networks.TESTNET,
                address: publicKey,
            });
            console.log("-->", signature)
            console.log("-->", signature.signedTxXdr.toString('base64'))


            // Add signature to transaction
            // transaction.addSignature(publicKey, signature.signedTxXdr.toString('base64'));
            const transaction = StellarSdk.TransactionBuilder.fromXDR(signature.signedTxXdr, this.networkPassphrase);
            console.log("hash", transaction)

            return {
                signedXdr: transaction.toXDR(),
                signerPublicKey: publicKey,
                signatures: transaction.signatures.length,
                signature: signature.signedTxXdr.toString('base64')
            };

        } catch (error) {
            console.error('Error adding signature:', error);
            throw error;
        }
    }

    // Submit a multisig transaction
    async submitMultisigTransaction(signedTransactionXdr) {
        try {
            const transaction = StellarSdk.TransactionBuilder.fromXDR(signedTransactionXdr, this.networkPassphrase);

            const result = await this.server.submitTransaction(transaction);

            return {
                success: true,
                hash: result.hash,
                ledger: result.ledger,
                signatures: transaction.signatures.length
            };

        } catch (error) {
            console.error('Error submitting multisig transaction:', error);

            // Enhanced error handling for multisig failures
            if (error.response && error.response.data && error.response.data.extras) {
                const { result_codes } = error.response.data.extras;

                if (result_codes.transaction === 'tx_bad_auth') {
                    throw new Error('Insufficient signatures or invalid signature weight');
                } else if (result_codes.transaction === 'tx_bad_auth_extra') {
                    throw new Error('Too many signatures or duplicate signatures');
                }
            }

            throw error;
        }
    }

    // Get account signers and thresholds
    async getAccountSigners(publicKey) {
        try {
            const account = await this.server.loadAccount(publicKey);

            return {
                accountId: publicKey,
                signers: account.signers.map(signer => ({
                    publicKey: signer.key,
                    weight: signer.weight,
                    type: signer.type
                })),
                thresholds: {
                    low: account.thresholds.low_threshold,
                    medium: account.thresholds.med_threshold,
                    high: account.thresholds.high_threshold
                },
                totalSigners: account.signers.length,
                isMultisig: account.signers.length > 1 && account.thresholds.med_threshold > 1
            };

        } catch (error) {
            console.error('Error getting account signers:', error);
            throw error;
        }
    }

    // Create payment operation for multisig
    createPaymentOperation(destination, amount, assetCode = 'XLM', assetIssuer = null) {
        let asset;
        if (assetCode === 'XLM') {
            asset = StellarSdk.Asset.native();
        } else {
            asset = new StellarSdk.Asset(assetCode, assetIssuer);
        }

        return StellarSdk.Operation.payment({
            destination: destination,
            asset: asset,
            amount: amount.toString()
        });
    }

    // Create account operation for multisig
    createAccountOperation(destination, startingBalance) {
        return StellarSdk.Operation.createAccount({
            destination: destination,
            startingBalance: startingBalance.toString()
        });
    }
}

export default StellarService;