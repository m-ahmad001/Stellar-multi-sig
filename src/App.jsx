import WalletConnect from './components/WalletConnect'
import AccountInfo from './components/AccountInfo'
import StellarTransactions from './components/StellarTransactions'
import ModernContractExample from './components/ModernContractExample'
import MultiSigManager from './components/MultiSigManager'
import './App.css'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Stellar Freighter Wallet Integration</h1>
        <p>Connect your Freighter wallet to interact with the Stellar network</p>
      </header>

      <main>
        <WalletConnect />
        <AccountInfo />
        {/* <StellarTransactions /> */}
        {/* <ModernContractExample /> */}
        <MultiSigManager />
      </main>
    </div>
  )
}

export default App
