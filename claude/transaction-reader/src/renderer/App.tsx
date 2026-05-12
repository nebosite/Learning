import { useState } from 'react'

export default function App(): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  async function handleImport(): Promise<void> {
    const filePath = await window.api.openTsvDialog()
    if (filePath) setSelectedFile(filePath)
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Transaction Reader</h1>
      <button onClick={handleImport}>Import</button>
      {selectedFile && (
        <p style={{ marginTop: '1rem', color: '#555' }}>Selected: {selectedFile}</p>
      )}
    </div>
  )
}
