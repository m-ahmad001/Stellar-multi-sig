import { useState } from 'react';
import { useFreighterWallet } from '../hooks/useFreighterWallet';
import StellarService from '../services/stellarService';

const ModernContractExample = () => {
    const { publicKey, signTransaction, isWalletConnected, network } = useFreighterWallet();
    const [stellarService] = useState(() => new StellarService('testnet'));
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    // Contract invocation form (writes to blockchain)
    const [contractForm, setContractForm] = useState({
        contractAddress: '',
        method: 'hello',
        parameter: ''
    });

    // Read-only contract call form
    const [readForm, setReadForm] = useState({
        contractAddress: '',
        method: 'get_count',
        parameter: ''
    });

    const invokeContract = async (e) => {
        e.preventDefault();
        if (!isWalletConnected) {
            setError('Please connect your wallet first');
            return;
        }

        if (!contractForm.contractAddress || !contractForm.method) {
            setError('Please fill in contract address and method');
            return;
        }

        try {
            setIsLoading(true);
            setError('');
            setResult('');

            // Prepare parameters
            const params = contractForm.parameter ? [contractForm.parameter] : [];

            // Create and prepare the contract transaction using modern SDK approach
            const preparedTransaction = await stellarService.invokeContract(
                publicKey,
                contractForm.contractAddress,
                contractForm.method,
                params
            );

            // Sign transaction with Freighter
            const signedTransactionXdr = await signTransaction(preparedTransaction.toXDR());

            // Submit transaction and wait for result
            const submitResult = await stellarService.submitContractTransaction(signedTransactionXdr);

            let resultMessage = `✅ Contract invocation successful!\nTransaction hash: ${submitResult.hash}`;
            if (submitResult.returnValue !== null) {
                resultMessage += `\nReturn value: ${JSON.stringify(submitResult.returnValue)}`;
            }

            setResult(resultMessage);
            setContractForm({ ...contractForm, parameter: '' });
        } catch (err) {
            setError(`Contract invocation failed: ${err.message}`);
            console.error('Contract invocation error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const readContract = async (e) => {
        e.preventDefault();

        if (!readForm.contractAddress || !readForm.method) {
            setError('Please fill in contract address and method');
            return;
        }

        try {
            setIsLoading(true);
            setError('');
            setResult('');

            const params = readForm.parameter ? [readForm.parameter] : [];

            // Read-only contract call (no transaction needed)
            const result = await stellarService.readContract(
                readForm.contractAddress,
                readForm.method,
                params
            );

            setResult(`📖 Read result: ${JSON.stringify(result)}`);
        } catch (err) {
            setError(`Contract read failed: ${err.message}`);
            console.error('Contract read error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isWalletConnected) {
        return (
            <div className="contract-example">
                <p>Please connect your Freighter wallet to interact with contracts.</p>
            </div>
        );
    }

    return (
        <div className="contract-example">
            <h2>Soroban Smart Contract Interaction</h2>
            <p className="network-info">Network: {network}</p>
            <p className="contract-description">
                Interact with Soroban smart contracts using the modern Stellar SDK approach.
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

            {/* Contract Invocation Form (Writes to blockchain) */}
            <div className="contract-form">
                <h3>📝 Contract Invocation (Write)</h3>
                <p className="form-description">
                    Invoke a contract method that modifies state (requires transaction fee).
                </p>
                <form onSubmit={invokeContract}>
                    <div className="form-group">
                        <label>Contract Address:</label>
                        <input
                            type="text"
                            value={contractForm.contractAddress}
                            onChange={(e) => setContractForm({ ...contractForm, contractAddress: e.target.value })}
                            placeholder="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                            required
                        />
                        <small>Enter the deployed contract address (starts with C)</small>
                    </div>

                    <div className="form-group">
                        <label>Method Name:</label>
                        <input
                            type="text"
                            value={contractForm.method}
                            onChange={(e) => setContractForm({ ...contractForm, method: e.target.value })}
                            placeholder="hello"
                            required
                        />
                        <small>Enter the contract method/function name to call</small>
                    </div>

                    <div className="form-group">
                        <label>Parameter (optional):</label>
                        <input
                            type="text"
                            value={contractForm.parameter}
                            onChange={(e) => setContractForm({ ...contractForm, parameter: e.target.value })}
                            placeholder="World"
                        />
                        <small>Enter a single parameter (string, number, or address)</small>
                    </div>

                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Invoking Contract...' : 'Invoke Contract'}
                    </button>
                </form>
            </div>

            {/* Read-Only Contract Call Form */}
            <div className="contract-form">
                <h3>📖 Contract Read (View)</h3>
                <p className="form-description">
                    Read contract state without creating a transaction (free).
                </p>
                <form onSubmit={readContract}>
                    <div className="form-group">
                        <label>Contract Address:</label>
                        <input
                            type="text"
                            value={readForm.contractAddress}
                            onChange={(e) => setReadForm({ ...readForm, contractAddress: e.target.value })}
                            placeholder="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                            required
                        />
                        <small>Enter the deployed contract address (starts with C)</small>
                    </div>

                    <div className="form-group">
                        <label>Method Name:</label>
                        <input
                            type="text"
                            value={readForm.method}
                            onChange={(e) => setReadForm({ ...readForm, method: e.target.value })}
                            placeholder="get_count"
                            required
                        />
                        <small>Enter a view/read method name</small>
                    </div>

                    <div className="form-group">
                        <label>Parameter (optional):</label>
                        <input
                            type="text"
                            value={readForm.parameter}
                            onChange={(e) => setReadForm({ ...readForm, parameter: e.target.value })}
                            placeholder=""
                        />
                        <small>Enter a parameter if the read method requires one</small>
                    </div>

                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Reading Contract...' : 'Read Contract'}
                    </button>
                </form>
            </div>

            <div className="contract-info">
                <h4>Example Contracts (Testnet)</h4>
                <div className="example-contracts">
                    <div className="example-contract">
                        <strong>Hello World Contract:</strong>
                        <p>Write Method: <code>hello</code> (parameter: your name)</p>
                        <p>Read Method: <code>get_greeting</code> (no parameter)</p>
                    </div>
                    <div className="example-contract">
                        <strong>Counter Contract:</strong>
                        <p>Write Methods: <code>increment</code>, <code>decrement</code></p>
                        <p>Read Method: <code>get_count</code> (no parameter)</p>
                    </div>
                    <div className="example-contract">
                        <strong>Token Contract:</strong>
                        <p>Write Method: <code>transfer</code> (parameters: to_address, amount)</p>
                        <p>Read Method: <code>balance</code> (parameter: address)</p>
                    </div>
                </div>

                <div className="contract-notes">
                    <h5>Modern SDK Features:</h5>
                    <ul>
                        <li>✅ Uses <code>prepareTransaction()</code> for automatic simulation and auth</li>
                        <li>✅ Proper parameter conversion with <code>nativeToScVal()</code></li>
                        <li>✅ Return value parsing with <code>scValToNative()</code></li>
                        <li>✅ Read-only calls don't require wallet signing</li>
                        <li>✅ Automatic transaction polling and result parsing</li>
                    </ul>

                    <h5>Parameter Types Supported:</h5>
                    <ul>
                        <li><strong>String:</strong> "hello world"</li>
                        <li><strong>Number:</strong> 42 (for u32, i32)</li>
                        <li><strong>BigInt:</strong> 1000000n (for u128, i128)</li>
                        <li><strong>Address:</strong> GXXXXXXX... (Stellar addresses)</li>
                        <li><strong>Boolean:</strong> true/false</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ModernContractExample;