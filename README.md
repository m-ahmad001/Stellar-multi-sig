# Stellar Freighter Wallet Integration

A comprehensive React application demonstrating integration with Stellar Freighter wallet for wallet connection, account management, payments, and smart contract interactions.

## Features

- **Freighter Wallet Connection**: Connect and disconnect from Freighter browser extension
- **Wallet Status Display**: Shows connection status, public key, and network
- **Account Information**: Display account balances and details
- **Payment Transactions**: Send XLM and custom asset payments
- **Smart Contract Interactions**: Call Soroban smart contracts
- **Transaction Signing**: Sign transactions using Freighter wallet
- **Network Support**: Works with both Testnet and Mainnet

## Prerequisites

1. **Freighter Wallet Extension**: Install the [Freighter browser extension](https://freighter.app/)
2. **Node.js**: Version 16 or higher
3. **Stellar Account**: A funded Stellar account (use [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test) for testnet)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to the local development URL (usually http://localhost:5173)

3. Install and set up Freighter wallet extension if you haven't already

4. Connect your Freighter wallet by clicking "Connect Freighter Wallet"

5. Fund your testnet account using [Stellar Friendbot](https://friendbot.stellar.org)

6. Use the application features:
   - View account information and balances
   - Send XLM payments to other accounts
   - Interact with smart contracts

## Components Overview

### Core Components

- **`useFreighterWallet`** - Custom React hook for wallet state management
- **`StellarService`** - Service class for Stellar blockchain operations (modern SDK v14.3.0)
- **`WalletConnect`** - Wallet connection/disconnection interface
- **`AccountInfo`** - Display account details and balances
- **`StellarTransactions`** - Payment transaction forms
- **`ModernContractExample`** - Modern Soroban smart contract interactions
- **`MultiSigManager`** - Complete multi-signature account management
- **`KeypairGenerator`** - Test keypair generation utility

### Key Features

#### Wallet Connection
```javascript
const { 
  isWalletConnected, 
  publicKey, 
  network, 
  connectWallet, 
  signTransaction 
} = useFreighterWallet();
```

#### Payment Transactions
- Send XLM to any Stellar account
- Automatic fee calculation
- Transaction validation and error handling

#### Smart Contract Interactions (Modern SDK v14.3.0)
- **Contract Invocation**: Write operations that modify blockchain state
- **Read-Only Calls**: View contract state without transactions (free)
- **Automatic Preparation**: Uses `prepareTransaction()` for simulation and auth
- **Parameter Conversion**: Automatic conversion with `nativeToScVal()`
- **Return Value Parsing**: Automatic parsing with `scValToNative()`
- **Transaction Polling**: Automatic result polling and confirmation

#### Multi-Signature Account Management
- **Account Setup**: Convert regular accounts to multi-sig with custom thresholds
- **Transaction Creation**: Build transactions requiring multiple signatures
- **Distributed Signing**: Support for remote/offline signing workflows
- **Signature Collection**: Add signatures from multiple parties
- **Threshold Validation**: Automatic validation of signature requirements
- **Test Utilities**: Keypair generation and account funding tools

## Dependencies

- `@stellar/freighter-api`: Official Freighter wallet integration (v5.0.0)
- `@stellar/stellar-sdk`: Stellar blockchain SDK (v14.3.0)
- `react`: UI framework (v19.1.1)
- `vite`: Build tool and development server (v7.1.7)

## Modern SDK Usage Pattern

The application uses the recommended namespace import pattern:

```javascript
import * as StellarSdk from '@stellar/stellar-sdk';

// Usage examples:
const rpc = new StellarSdk.SorobanRpc.Server("https://soroban-testnet.stellar.org");
const keypair = StellarSdk.Keypair.fromSecret("SECRET_KEY");
const contract = new StellarSdk.Contract("CONTRACT_ID");
const param = StellarSdk.nativeToScVal("value", { type: "string" });
```

## Network Configuration

The application uses Stellar Testnet by default. To switch to Mainnet:

1. Update the `StellarService` constructor in components
2. Change `'testnet'` to `'mainnet'` or `'PUBLIC'`

```javascript
const [stellarService] = useState(() => new StellarService('mainnet'));
```

## API Reference

### Freighter API Methods Used

- `isConnected()` - Check if wallet is connected
- `isAllowed()` - Check if app has permission
- `requestAccess()` - Request wallet access
- `getPublicKey()` - Get user's public key
- `getNetwork()` - Get current network
- `signTransaction()` - Sign transactions

### Modern Stellar SDK Features (v14.3.0)

- **RPC Integration**: Uses Soroban RPC for contract operations
- **Automatic Preparation**: `prepareTransaction()` handles simulation and auth
- **Modern Submission**: `sendTransaction()` and `getTransaction()` for results
- **Type Safety**: Proper parameter conversion and return value parsing
- **Read Operations**: Simulation-based reads without transaction costs
- **Network Support**: Full Testnet and Mainnet compatibility

## Error Handling

The application includes comprehensive error handling for:
- Wallet not installed
- User declining access
- Insufficient funds
- Invalid addresses
- Network errors
- Contract call failures

## Security Best Practices

- ✅ Never expose secret keys in client-side code
- ✅ Always verify transaction details before signing
- ✅ Use testnet for development and testing
- ✅ Validate user inputs
- ✅ Handle errors gracefully
- ✅ Use proper network configurations

## Development Tips

1. **Testing**: Use Stellar Testnet for all development
2. **Funding**: Use [Friendbot](https://friendbot.stellar.org) to fund testnet accounts
3. **Debugging**: Check browser console for detailed error messages
4. **Contracts**: Deploy test contracts using [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools)

## Troubleshooting

### Common Issues

1. **"Freighter not installed"**
   - Install the Freighter browser extension
   - Refresh the page after installation

2. **"Account not found"**
   - Fund your account using Friendbot (testnet)
   - Ensure you're on the correct network

3. **"Transaction failed"**
   - Check account balance
   - Verify destination address format
   - Ensure sufficient XLM for fees

4. **Contract call errors**
   - Verify contract address is correct
   - Check contract method names and parameters
   - Ensure contract is deployed on the current network

## Code Examples

### Basic Contract Invocation

```javascript
import * as StellarSdk from '@stellar/stellar-sdk';

const rpc = new StellarSdk.SorobanRpc.Server("https://soroban-testnet.stellar.org");
const contract = new StellarSdk.Contract("CONTRACT_ID");

// Build operation with parameters
const operation = contract.call(
  "method_name",
  StellarSdk.nativeToScVal("parameter", { type: "string" })
);

// Build and prepare transaction
const transaction = new StellarSdk.TransactionBuilder(account, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
}).addOperation(operation).setTimeout(300).build();

const preparedTx = await rpc.prepareTransaction(transaction);
```

### Parameter Types

```javascript
// String parameter
StellarSdk.nativeToScVal("hello", { type: "string" })

// Number parameter
StellarSdk.nativeToScVal(42, { type: "u32" })

// BigInt parameter
StellarSdk.nativeToScVal(1000000n, { type: "i128" })

// Address parameter
StellarSdk.Address.fromString("GADDRESS...").toScVal()

// Boolean parameter
StellarSdk.nativeToScVal(true, { type: "bool" })
```

### Multi-Signature Setup

```javascript
// Setup multi-sig account
const result = await stellarService.setupMultisig(
  masterSecret,
  [signer1Secret, signer2Secret, signer3Secret, signer4Secret, signer5Secret],
  { low: 3, med: 3, high: 3 }
);

// Create multi-sig transaction
const txResult = await stellarService.createMultisigTransaction(
  sourcePublicKey,
  [StellarSdk.Operation.payment({
    destination: "GADDRESS...",
    asset: StellarSdk.Asset.native(),
    amount: "100"
  })]
);

// Add signature (can be done on different computers)
const signResult = stellarService.addSignatureToTransaction(
  transactionXdr,
  signerSecret
);

// Submit when enough signatures collected
const submitResult = await stellarService.submitMultisigTransaction(
  signedTransactionXdr
);
```

### Read-Only Contract Call

```javascript
// Simulate transaction for read-only operations
const simulation = await rpc.simulateTransaction(transaction);
const result = StellarSdk.scValToNative(simulation.result.retval);
```

## Resources

- [Freighter Documentation](https://docs.freighter.app/)
- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Stellar Developer Portal](https://developers.stellar.org/)
- [Soroban Smart Contracts](https://soroban.stellar.org/)
- [Stellar Laboratory](https://laboratory.stellar.org/)

## License

MIT License - feel free to use this code for your own projects!