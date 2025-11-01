#!/usr/bin/env node

// Simple API test script
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testAPI() {
    console.log('🧪 Testing Stellar Multi-Sig Backend API...\n');

    try {
        // Test health endpoint
        console.log('1️⃣ Testing health endpoint...');
        const healthResponse = await fetch(`${BASE_URL}/health`);
        const healthData = await healthResponse.json();

        if (healthData.status === 'healthy') {
            console.log('✅ Health check passed');
            console.log(`   Horizon: ${healthData.services.horizon.status}`);
            console.log(`   RPC: ${healthData.services.rpc.status}`);
        } else {
            console.log('❌ Health check failed');
            return;
        }

        // Test account endpoint (using a known testnet account)
        console.log('\n2️⃣ Testing account endpoint...');
        const testAccount = 'GDAT5HWTGIU4TSSZ4752OUC4SABDLTLZFRPZUJ3D6LKBNEPA7V2CIG54';

        try {
            const accountResponse = await fetch(`${BASE_URL}/api/account/${testAccount}`);
            const accountData = await accountResponse.json();

            if (accountResponse.ok) {
                console.log('✅ Account endpoint working');
                console.log(`   Account: ${accountData.accountId.substring(0, 10)}...`);
                console.log(`   Signers: ${accountData.signers.length}`);
                console.log(`   Multi-sig: ${accountData.isMultisig ? 'Yes' : 'No'}`);
            } else {
                console.log('⚠️  Account endpoint returned error (expected for unfunded account)');
                console.log(`   Error: ${accountData.error}`);
            }
        } catch (err) {
            console.log('⚠️  Account test failed (this is normal if account doesn\'t exist)');
        }

        // Test contract build endpoint (will fail without valid params, but tests the endpoint)
        console.log('\n3️⃣ Testing contract build endpoint...');
        try {
            const contractResponse = await fetch(`${BASE_URL}/api/contract/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceAccount: 'GCA3XIQAK2JKH7SDTVEEALP4HIMS4HULVMK3QCH5GQH4KLIWQW4CSCKF',
                    contractId: 'CAEXRD3SNZLUWO4IYURRVLC7OHEICIV73XJNBY5DFRMVKILXD5S6AUQV',
                    fromAddress: 'GCA3XIQAK2JKH7SDTVEEALP4HIMS4HULVMK3QCH5GQH4KLIWQW4CSCKF',
                    toAddress: 'GA7QSXFU4Z6MBA656RHPJVBHSV6SFVVRLOO4CE3XN5SIFOMLN7VV3X53',
                    amount: '1000000'
                })
            });

            const contractData = await contractResponse.json();

            if (contractResponse.status === 400) {
                console.log('✅ Contract endpoint responding (validation working)');
                console.log(`   Expected error: ${contractData.error}`);
            } else {
                console.log('⚠️  Unexpected response from contract endpoint');
            }
        } catch (err) {
            console.log('❌ Contract endpoint test failed');
        }

        console.log('\n🎉 API tests completed!');
        console.log('\n📋 Next steps:');
        console.log('   1. Start the frontend: npm run dev (in the main directory)');
        console.log('   2. Connect your Freighter wallet');
        console.log('   3. Use the Backend Multi-Sig Contract component');
        console.log('   4. Test with real contract addresses and accounts');

    } catch (error) {
        console.error('❌ API test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Make sure the backend server is running: npm run dev');
        console.log('   2. Check the server is accessible at http://localhost:3001');
        console.log('   3. Verify your .env configuration');
    }
}

// Run tests
testAPI();