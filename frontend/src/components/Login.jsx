import React, { useState, useEffect } from 'react';
import { firebaseService } from '../services';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('admin@carewurx.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  // Check if we're being rendered
  useEffect(() => {
    console.log("Login component rendered");
    
    // Add a visible DOM element in case the styles aren't applying correctly
    const body = document.getElementsByTagName('body')[0];
    body.style.backgroundColor = "#3498db";
    
    // Check if we're in Electron
    setIsElectron(firebaseService.isElectronAvailable);
    console.log("Running in environment:", firebaseService.isElectronAvailable ? "Electron" : "Browser");
    
    // Log to show we're in the real Login component
    console.log("React Login component initialized - ready for login");
    
    return () => {
      // No cleanup needed
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      console.log("Attempting login with:", email);
      const result = await firebaseService.signIn(email, password);
      console.log("Login successful:", result);
      
      if (result && result.user) {
        onLogin(result.user);
      } else {
        throw new Error("Invalid login response");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Login failed. Please try again.");
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    // Use the dedicated guest login method
    console.log("Guest login via Firebase service");
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the forceGuestLogin method which works in both Electron and browser environments
      const result = await firebaseService.forceGuestLogin();
      console.log("Guest login successful:", result);
      
      // Use the user directly from the result
      if (result && result.user) {
        onLogin(result.user);
      } else {
        throw new Error("Invalid guest login response");
      }
    } catch (err) {
      console.error("Guest login error:", err);
      setError("Guest login failed. Please try again or use regular login.");
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>CareWurx</h1>
          <h2>Login to Your Account</h2>
          {!isElectron && (
            <div className="environment-badge">
              Browser Mode
            </div>
          )}
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
          <div className="login-options">
            <button type="button" className="guest-button" onClick={handleGuestLogin} disabled={isLoading}>
              Continue as Guest
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .login-page {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #3498db, #8e44ad);
          padding: 20px;
        }
        
        .login-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          padding: 40px;
          width: 100%;
          max-width: 400px;
        }
        
        .login-header {
          text-align: center;
          margin-bottom: 30px;
          position: relative;
        }
        
        .login-header h1 {
          color: #3498db;
          margin: 0 0 10px 0;
          font-size: 36px;
        }
        
        .login-header h2 {
          color: #333;
          font-weight: 400;
          margin: 0;
          font-size: 18px;
        }
        
        .environment-badge {
          position: absolute;
          top: -10px;
          right: -10px;
          background: #e74c3c;
          color: white;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
        }
        
        .form-group input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          transition: border-color 0.3s;
        }
        
        .form-group input:focus {
          border-color: #3498db;
          outline: none;
        }
        
        .error-message {
          color: #e74c3c;
          background-color: #fceaea;
          padding: 10px;
          border-radius: 4px;
          font-size: 14px;
          margin-bottom: 20px;
        }
        
        .login-button {
          width: 100%;
          padding: 12px;
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .login-button:hover:not(:disabled) {
          background-color: #2980b9;
        }
        
        .login-button:disabled {
          background-color: #95a5a6;
          cursor: not-allowed;
        }
        
        .login-options {
          margin-top: 20px;
          text-align: center;
        }
        
        .guest-button {
          background: none;
          border: none;
          color: #3498db;
          cursor: pointer;
          font-size: 14px;
          text-decoration: underline;
          padding: 5px;
        }
        
        .guest-button:hover:not(:disabled) {
          color: #2980b9;
        }
        
        .guest-button:disabled {
          color: #95a5a6;
          cursor: not-allowed;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
};

export default Login;
