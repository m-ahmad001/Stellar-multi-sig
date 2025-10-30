// Example of using Stellar SDK with namespace imports
// This shows the pattern recommended in the official documentation

import * as StellarSdk from '@stellar/stellar-sdk';

// Example: Direct contract invocation using namespace imports
export async function exampleContractInvocation() {
    // Setup
    const RPC_URL = "https://soroban-testnet.stellar.org";
    const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
    const CONTRACT_ID = "YOUR_CONTRACT_ID";

    const rpc = new StellarSdk.SorobanRpc.Server(RPC_URL);

    // 1. Load your keypair (in real app, get from secure storage)
    const keypair = StellarSdk.Keypair.fromSecret("YOUR_SECRET_KEY");

    // 2. Get the account
    const account = await rpc.getAccount(keypair.publicKey());

    // 3. Create contract instance
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    // 4. Build the contract call operation
    // Example: calling a function named "hello" with a string parameter
    const operation = contract.call(
        "hello",
        StellarSdk.nativeToScVal("World", { type: "string" })
    );

    // 5. Build transaction
    const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(operation)
        .setTimeout(300)
        .build();

    // 6. Prepare transaction (simulates and adds auth)
    const preparedTx = await rpc.prepareTransaction(transaction);

    // 7. Sign transaction
    preparedTx.sign(keypair);

    // 8. Submit transaction
    const response = await rpc.sendTransaction(preparedTx);
    console.log("Transaction hash:", response.hash);

    // 9. Wait for confirmation
    let txResponse = await rpc.getTransaction(response.hash);
    while (txResponse.status === "NOT_FOUND") {
        await new Promise(resolve => setTimeout(resolve, 1000));
        txResponse = await rpc.getTransaction(response.hash);
    }

    if (txResponse.status === "SUCCESS") {
        console.log("Success!", txResponse);

        // Parse return value if available
        if (txResponse.returnValue) {
            const returnValue = StellarSdk.scValToNative(txResponse.returnValue);
            console.log("Return value:", returnValue);
            return returnValue;
        }
    } else {
        throw new Error("Transaction failed");
    }
}

// Example: Different parameter types
export function exampleParameterTypes() {
    // String
    const stringParam = StellarSdk.nativeToScVal("hello", { type: "string" });

    // Number (u32, u64, i32, i64)
    const numberParam = StellarSdk.nativeToScVal(42, { type: "u32" });

    // BigInt (u128, i128)
    const bigIntParam = StellarSdk.nativeToScVal(1000000n, { type: "i128" });

    // Address
    const addressParam = StellarSdk.Address.fromString("GADDRESS...").toScVal();

    // Boolean
    const boolParam = StellarSdk.nativeToScVal(true, { type: "bool" });

    // Bytes
    const bytesParam = StellarSdk.nativeToScVal(Buffer.from("data"), { type: "bytes" });

    // Vector (array)
    const vectorParam = StellarSdk.nativeToScVal([1, 2, 3], { type: "vec" });

    // Map
    const mapParam = StellarSdk.nativeToScVal(
        new Map([["key", "value"]]),
        { type: "map" }
    );

    return {
        stringParam,
        numberParam,
        bigIntParam,
        addressParam,
        boolParam,
        bytesParam,
        vectorParam,
        mapParam
    };
}

// Example: Read-only contract call
export async function exampleReadContract(contractId, method, params = []) {
    const rpc = new StellarSdk.SorobanRpc.Server("https://soroban-testnet.stellar.org");
    const contract = new StellarSdk.Contract(contractId);

    // Build a temporary transaction for simulation
    const account = await rpc.getAccount("ANY_FUNDED_ADDRESS");

    const operation = contract.call(method, ...params);

    const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
    })
        .addOperation(operation)
        .setTimeout(300)
        .build();

    // Simulate only (no signing/sending)
    const simulation = await rpc.simulateTransaction(tx);

    if (simulation.result) {
        // Parse the return value
        const result = StellarSdk.scValToNative(simulation.result.retval);
        console.log("Read result:", result);
        return result;
    } else {
        throw new Error("Simulation failed");
    }
}