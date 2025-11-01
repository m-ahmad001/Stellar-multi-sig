# Stellar Multi-Sig Backend API

A Node.js Express backend for handling Stellar multi-signature contract operations. This backend separates the complex Soroban RPC operations from the frontend, providing a clean API for transaction building and submission.

## Features

- 🏗️ **Transaction Building**: Server-side contract transaction preparation
- 🔐 **Multi-Sig Support**: Handles multi-signature account operations
- 📡 **RPC Integration**: Direct connection to Soroban RPC servers
- ✅ **Transaction Simulation**: Automatic transaction preparation and validation
- 🚀 **Submission Handling**: Network submission with result polling
- 🔍 **Account Information**: Detailed account and signer information

## Installation

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Environment setup:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Variables

```env
# Stellar Network Configuration
HORIZON_URL=https://horizon-testnet.stellar.org
RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:5173
```

## API Endpoints

### Health Check
```http
GET /health
```
Returns backend and Stellar network status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "horizon": {
      "url": "https://horizon-testnet.stellar.org",
      "status": "connected",
      "latestLedger": 12345
    },
    "rpc": {
      "url": "https://soroban-testnet.stellar.org",
      "status": "healthy",
      "ledgerNumber": 12345
    }
  },
  "network": "Test SDF Network ; September 2015"
}
```

### Get Account Information
```http
GET /api/account/:publicKey
```
Returns detailed account information including signers and thresholds.

**Response:**
```json
{
  "accountId": "GXXXXXXX...",
  "sequence": "123456789",
  "balances": [...],
  "signers": [
    {
      "publicKey": "GXXXXXXX...",
      "weight": 1,
      "type": "ed25519_public_key"
    }
  ],
  "thresholds": {
    "low": 1,
    "medium": 2,
    "high": 3
  },
  "isMultisig": true
}
```

### Build Contract Transfer
```http
POST /api/contract/transfer
```
Builds and prepares a contract transfer transaction.

**Request:**
```json
{
  "sourceAccount": "GXXXXXXX...",
  "contractId": "CXXXXXXX...",
  "fromAddress": "GXXXXXXX...",
  "toAddress": "GXXXXXXX...",
  "amount": "20000000"
}
```

**Response:**
```json
{
  "success": true,
  "transactionXdr": "AAAAAgAAAAA...",
  "transactionHash": "abc123...",
  "networkPassphrase": "Test SDF Network ; September 2015",
  "operation": {
    "type": "contract_transfer",
    "contractId": "CXXXXXXX...",
    "fromAddress": "GXXXXXXX...",
    "toAddress": "GXXXXXXX...",
    "amount": "20000000"
  }
}
```

### Build Generic Contract Call
```http
POST /api/contract/build
```
Builds any contract method call with custom parameters.

**Request:**
```json
{
  "sourceAccount": "GXXXXXXX...",
  "contractId": "CXXXXXXX...",
  "method": "transfer",
  "parameters": [
    { "type": "address", "value": "GXXXXXXX..." },
    { "type": "address", "value": "GXXXXXXX..." },
    { "type": "i128", "value": "20000000" }
  ]
}
```

### Submit Signed Transaction
```http
POST /api/transaction/submit
```
Submits a signed transaction to the Stellar network.

**Request:**
```json
{
  "signedTransactionXdr": "AAAAAgAAAAA..."
}
```

**Response:**
```json
{
  "success": true,
  "hash": "abc123...",
  "status": "SUCCESS",
  "ledger": 12345,
  "returnValue": null,
  "signatures": 2
}
```

## Parameter Types

The backend supports automatic parameter conversion for contract calls:

- **`address`**: Stellar addresses (G... format)
- **`i128`**: Large integers (converted to BigInt)
- **`u32`**: 32-bit unsigned integers
- **`string`**: Text strings
- **`bool`**: Boolean values

## Error Handling

The API provides detailed error responses:

```json
{
  "error": "Transaction submission failed",
  "message": "Insufficient signatures or invalid signature weight",
  "resultCodes": {
    "transaction": "tx_bad_auth"
  }
}
```

## Architecture

```
Frontend (React)          Backend (Node.js)         Stellar Network
     │                          │                         │
     ├─ UI & Wallet ────────────┼─ Transaction Building ──┤
     ├─ Freighter Signing ──────┼─ RPC Communication ─────┤
     └─ Display Results ────────┼─ Network Submission ────┘
                                │
                         ┌─────────────┐
                         │   Express   │
                         │   Server    │
                         └─────────────┘
```

## Security

- ✅ **No Private Keys**: Backend never handles private keys
- ✅ **CORS Protection**: Configurable CORS for frontend access
- ✅ **Input Validation**: All inputs validated before processing
- ✅ **Error Sanitization**: Sensitive information filtered from responses
- ✅ **Rate Limiting**: Built-in Express security middleware

## Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Test API endpoints
curl http://localhost:3001/health
```

## Production Deployment

1. **Environment**: Set `NODE_ENV=production`
2. **Port**: Configure `PORT` environment variable
3. **CORS**: Set `FRONTEND_URL` to your production frontend URL
4. **SSL**: Use reverse proxy (nginx) for HTTPS termination
5. **Monitoring**: Add logging and monitoring solutions

## Troubleshooting

### Common Issues

1. **RPC Connection Failed**
   - Check `RPC_URL` in environment
   - Verify network connectivity to Soroban RPC

2. **Transaction Malformed**
   - Validate contract address format (starts with C)
   - Check parameter types and values
   - Ensure account exists and is funded

3. **CORS Errors**
   - Set correct `FRONTEND_URL` in environment
   - Check browser console for specific CORS issues

### Debug Mode

Enable detailed logging:
```bash
NODE_ENV=development npm run dev
```

This will show:
- All API requests and responses
- Stellar SDK operations
- Transaction building steps
- Error details and stack traces