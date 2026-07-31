import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'
import App from './App.tsx'
import { Toaster } from 'react-hot-toast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="bottom-center"
      toastOptions={{
        duration: 5000,
        style: {
          background: "#1f2933",
          color: "#f8fafc",
          border: "1px solid #3c4a56",
        },
        error: {
          style: {
            background: "#2b1b1b",
            color: "#fecaca",
            border: "1px solid #7f1d1d",
          },
        },
      }}
    />
  </StrictMode>,
)
