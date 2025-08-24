import React from 'react';
import '../css/SessionWarningModal.css';

const SessionWarningModal = ({ isOpen, timeLeft, onExtend, onLogout }) => {
  if (!isOpen) return null;

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="session-warning-overlay">
      <div className="session-warning-modal">
        <div className="session-warning-header">
          <h3>Session Timeout Warning</h3>
        </div>
        <div className="session-warning-content">
          <p>Your session will expire in:</p>
          <div className="session-timer">
            <span className="time-display">{formatTime(timeLeft)}</span>
          </div>
          <p>Would you like to extend your session or logout?</p>
        </div>
        <div className="session-warning-actions">
          <button 
            className="extend-session-btn"
            onClick={() => {
              // Show session extended toast
              window.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: 'Session extended successfully!', type: 'success' } 
              }));
              onExtend();
            }}
          >
            Extend Session
          </button>
          <button 
            className="logout-btn"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarningModal; 