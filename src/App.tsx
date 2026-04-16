import React, { useEffect, useState } from 'react';
import { DatesheetGenerator } from './components/DatesheetGenerator';
import { Dashboard } from './components/Dashboard';
import { db, auth } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { createUserProfile } from './lib/db';
import { Lock, Mail, AlertCircle, Loader2, LayoutDashboard, LogOut } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  
  // View management
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [isStartingNew, setIsStartingNew] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          await createUserProfile(u);
          setUser(u);
        } catch (err) {
          console.error("Error creating user profile:", err);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const targetEmail = 'uraann4@gmail.com';
    const targetPassword = 'admin123';

    if (email.trim().toLowerCase() === targetEmail && password === targetPassword) {
      setIsLoggingIn(true);
      try {
        try {
          const result = await signInWithEmailAndPassword(auth, targetEmail, targetPassword);
          setUser(result.user);
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/invalid-login-credentials') {
            try {
              const result = await createUserWithEmailAndPassword(auth, targetEmail, targetPassword);
              setUser(result.user);
            } catch (createErr: any) {
              if (createErr.code === 'auth/operation-not-allowed') {
                setError('Email/Password login is not enabled in Firebase. Please enable it in the Firebase Console.');
              } else {
                throw createErr;
              }
            }
          } else {
            throw signInErr;
          }
        }
      } catch (err: any) {
        setError(err.message || 'Login failed.');
        console.error("Login Error:", err);
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      setError('Invalid email or password.');
    }
  };

  const handleSelectWorkspace = (id: string) => {
    setCurrentWorkspaceId(id);
    setIsStartingNew(false);
  };

  const handleStartNew = () => {
    setCurrentWorkspaceId(null);
    setIsStartingNew(true);
  };

  const handleGoBack = () => {
    setCurrentWorkspaceId(null);
    setIsStartingNew(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Starting application...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-center max-w-md w-full transition-all hover:shadow-2xl">
          <div className="w-20 h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 hover:rotate-0 transition-transform">
            <Lock className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Admin Login</h1>
          <p className="text-gray-500 mb-8 font-medium">Enter your credentials to access the Datesheet Generator.</p>
          
          <form onSubmit={handleLogin} className="space-y-5 text-left">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium"
                  placeholder="uraann4@gmail.com"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-blue-600 text-white px-6 py-4 rounded-2xl hover:bg-blue-700 active:scale-95 transition-all font-black text-lg shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl flex items-center justify-center font-black shadow-md">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider leading-none mb-1">Administrator</p>
              <p className="text-sm font-bold text-gray-900 leading-none">{user.email}</p>
            </div>
          </div>
          
          {(currentWorkspaceId || isStartingNew) && (
            <button
              onClick={handleGoBack}
              className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors px-4 py-2 rounded-xl hover:bg-blue-50"
            >
              <LayoutDashboard className="w-4 h-4" />
              History
            </button>
          )}
        </div>
        
        <button 
          onClick={() => signOut(auth)} 
          className="text-sm font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-xl transition-all flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {!currentWorkspaceId && !isStartingNew ? (
        <Dashboard onSelectWorkspace={handleSelectWorkspace} onStartNew={handleStartNew} />
      ) : (
        <DatesheetGenerator workspaceId={currentWorkspaceId} />
      )}
    </div>
  );
}
