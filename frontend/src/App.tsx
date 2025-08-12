import './App.css'
import DrawingCanvas from './components/DrawingCanvas'

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>KrakelOrakel</h1>
        <p>The collaborative drawing game</p>
      </header>
      
      <main className="main-container">
        <div className="canvas-container">
          <DrawingCanvas />
        </div>
      </main>
    </div>
  )
}

export default App
