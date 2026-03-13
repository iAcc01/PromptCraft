import React from 'react'

interface ToastProps {
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[]
}

const Toast: React.FC<ToastProps> = ({ toasts }) => {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}

export default Toast
