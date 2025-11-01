// Backend API service for Stellar multi-sig operations
class BackendService {
    constructor(baseUrl = 'http://localhost:3001') {
        this.baseUrl = baseUrl;
    }

    // Helper method for API calls
    async apiCall(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        };

        try {
            console.log(`API Call: ${options.method || 'GET'} ${url}`);

            const response = await fetch(url, finalOptions);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // Health check
    async getHealth() {
        return this.apiCall('/health');
    }

    // Get account information
    async getAccount(publicKey) {
        return this.apiCall(`/api/account/${publicKey}`);
    }

    // Build contract transaction
    async buildContractTransaction(params) {
        return this.apiCall('/api/contract/build', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    // Build contract transfer transaction (specialized)
    async buildContractTransfer(params) {
        return this.apiCall('/api/contract/transfer', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    // Submit signed transaction
    async submitTransaction(signedTransactionXdr) {
        return this.apiCall('/api/transaction/submit', {
            method: 'POST',
            body: JSON.stringify({ signedTransactionXdr }),
        });
    }
}

export default BackendService;