import { useState } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';

const KeypairGenerator = () => {
    const [keypairs, setKeypairs] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const generateKeypairs = (count = 6) => {
        setIsGenerating(true);

        const newKeypairs = [];
        for (let i = 0; i < count; i++) {
            const keypair = StellarSdk.Keypair.random();
            newKeypairs.push({
                id: i + 1,
                publicKey: keypair.publicKey(),
                secretKey: keypair.secret(),
                purpose: i === 0 ? 'Master Account' : `Signer ${i}`
            });
        }

        setKeypairs(newKeypairs);
        setIsGenerating(false);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            // Could add a toast notification here
        });
    };

    const fundAccount = (publicKey) => {
        const friendbotUrl = `https://friendbot.stellar.org?addr=${publicKey}`;
        window.open(friendbotUrl, '_blank');
    };

    return (
        <div className="keypair-generator">
            <h3>🔑 Test Keypair Generator</h3>
            <p className="description">
                Generate test keypairs for multi-sig setup. Remember to fund accounts on testnet!
            </p>

            <div className="generator-controls">
                <button
                    onClick={() => generateKeypairs(3)}
                    disabled={isGenerating}
                    className="generate-btn"
                >
                    {isGenerating ? 'Generating...' : 'Generate 3 Test Keypairs'}
                </button>

                {keypairs.length > 0 && (
                    <button
                        onClick={() => setKeypairs([])}
                        className="clear-btn"
                    >
                        Clear All
                    </button>
                )}
            </div>

            {keypairs.length > 0 && (
                <div className="keypairs-list">
                    <div className="keypairs-header">
                        <h4>Generated Keypairs:</h4>
                        <p className="warning">
                            ⚠️ These are test keys only! Never use generated keys for real funds.
                        </p>
                    </div>

                    {keypairs.map((keypair) => (
                        <div key={keypair.id} className="keypair-item">
                            <div className="keypair-header">
                                <h5>{keypair.purpose}</h5>
                                <button
                                    onClick={() => fundAccount(keypair.publicKey)}
                                    className="fund-btn"
                                    title="Fund this account on testnet"
                                >
                                    💰 Fund
                                </button>
                            </div>

                            <div className="keypair-field">
                                <label>Public Key:</label>
                                <div className="key-display">
                                    <code>{keypair.publicKey}</code>
                                    <button
                                        onClick={() => copyToClipboard(keypair.publicKey)}
                                        className="copy-btn"
                                        title="Copy to clipboard"
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>

                            <div className="keypair-field">
                                <label>Secret Key:</label>
                                <div className="key-display">
                                    <code className="secret-key">{keypair.secretKey}</code>
                                    <button
                                        onClick={() => copyToClipboard(keypair.secretKey)}
                                        className="copy-btn"
                                        title="Copy to clipboard"
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="bulk-actions">
                        <h5>Bulk Copy (for multi-sig setup):</h5>
                        <div className="bulk-copy-section">
                            <label>All Secret Keys (JSON format):</label>
                            <textarea
                                readOnly
                                value={JSON.stringify({
                                    masterSecret: keypairs[0]?.secretKey || '',
                                    signer1Secret: keypairs[1]?.secretKey || '',
                                    signer2Secret: keypairs[2]?.secretKey || '',
                                    signer3Secret: keypairs[3]?.secretKey || '',
                                    signer4Secret: keypairs[4]?.secretKey || '',
                                    signer5Secret: keypairs[5]?.secretKey || ''
                                }, null, 2)}
                                rows="8"
                                className="bulk-textarea"
                            />
                            <button
                                onClick={() => copyToClipboard(JSON.stringify({
                                    masterSecret: keypairs[0]?.secretKey || '',
                                    signer1Secret: keypairs[1]?.secretKey || '',
                                    signer2Secret: keypairs[2]?.secretKey || '',
                                    signer3Secret: keypairs[3]?.secretKey || '',
                                    signer4Secret: keypairs[4]?.secretKey || '',
                                    signer5Secret: keypairs[5]?.secretKey || ''
                                }, null, 2))}
                                className="copy-btn"
                            >
                                📋 Copy All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="generator-info">
                <h5>Usage Instructions:</h5>
                <ol>
                    <li>Generate 6 test keypairs (1 master + 2 signers)</li>
                    <li>Fund the master account using the "Fund" button</li>
                    <li>Copy the secret keys to the multi-sig setup form</li>
                    <li>Configure your multi-sig account with desired thresholds</li>
                </ol>

                <div className="security-note">
                    <h5>🔒 Security Note:</h5>
                    <p>
                        These keypairs are generated client-side and are suitable for testing only.
                        For production use, generate keypairs securely and never share secret keys.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default KeypairGenerator;