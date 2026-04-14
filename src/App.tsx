import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { GraduationCap, LayoutDashboard, LogOut, User as UserIcon, BookOpen, ClipboardList, Bell, ShieldCheck, Mail, Lock, UserPlus, Check, BarChart3 } from 'lucide-react';
import StudentDashboard from '@/components/StudentDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import Register from '@/components/Register';
import Profile from '@/components/Profile';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showAuthWarning, setShowAuthWarning] = useState(false);

  const handleGoogleLogin = async () => {
    if (isGoogleLoading) return;
    const provider = new GoogleAuthProvider();
    setIsGoogleLoading(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // These are expected if the user closes the popup or clicks again
        return;
      }
      if (error.code === 'auth/invalid-credential') {
        toast.error("Invalid credentials. Please try again.");
        return;
      }
      console.error("Login error:", error);
      toast.error("Google login failed.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (isRegistering && !name) {
      toast.error("Please enter your name.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create profile immediately for email/password registration
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: name,
          email: email,
          role: role,
          isRegistered: true, // Mark as registered since we collected data here
          createdAt: serverTimestamp(),
        });
        toast.success("Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Logged in successfully!");
      }
    } catch (error: any) {
      let message = "Authentication failed. Please try again.";
      
      if (error.code === 'auth/email-already-in-use') {
        message = "This email is already registered. Please sign in instead.";
      } else if (error.code === 'auth/operation-not-allowed') {
        message = "Email/Password login is not enabled in Firebase. Please enable it in the Firebase Console.";
        setShowAuthWarning(true);
      } else if (error.code === 'auth/weak-password') {
        message = "The password is too weak. Please use at least 6 characters.";
      } else if (error.code === 'auth/invalid-email') {
        message = "Please enter a valid email address.";
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Invalid email or password. Please check your credentials and try again.";
      } else {
        console.error("Auth error:", error);
      }
      
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl border-none">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center text-primary">
              <GraduationCap size={40} />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight">EduEnroll</CardTitle>
              <CardDescription className="text-base mt-2">
                {isRegistering ? 'Create your account' : 'Student Registration & Enrollment System'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAuthWarning && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm space-y-2 animate-in fade-in slide-in-from-top-2">
                <p className="font-bold flex items-center gap-2">
                  <ShieldCheck size={16} />
                  Action Required: Enable Email Auth
                </p>
                <p>Email/Password login is disabled in your Firebase project settings.</p>
                <a 
                  href={`https://console.firebase.google.com/project/${auth.app.options.projectId}/authentication/providers`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center bg-amber-600 text-white py-2 rounded-lg font-medium hover:bg-amber-700 transition-colors"
                >
                  Open Firebase Console
                </a>
              </div>
            )}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isRegistering && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input 
                      id="name" 
                      placeholder="John Doe" 
                      className="pl-10"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Min. 6 characters" 
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {isRegistering && (
                <div className="space-y-2">
                  <Label>I am a...</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                        role === 'student' 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <UserIcon size={20} className="mb-1" />
                      <span className="text-xs font-bold">Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                        role === 'admin' 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <ShieldCheck size={20} className="mb-1" />
                      <span className="text-xs font-bold">Admin</span>
                    </button>
                  </div>
                </div>
              )}

              <Button className="w-full h-11 font-semibold" type="submit" disabled={isLoading}>
                {isLoading ? 'Processing...' : (isRegistering ? 'Create Account' : 'Sign In')}
              </Button>
            </form>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400">Or continue with</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full h-11" 
              onClick={handleGoogleLogin} 
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Signing in...
                </div>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                  </svg>
                  Google
                </>
              )}
            </Button>

            <p className="text-[10px] text-center text-slate-400 italic mt-2">
              * You will be asked to choose your role (Student/Admin) after signing in.
            </p>

            <div className="text-center pt-2">
              <button 
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm text-primary hover:underline font-medium"
              >
                {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register now"}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

const MainApp = () => {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!profile || !profile.isRegistered) {
    return <Register />;
  }

  const handleLogout = () => signOut(auth);

  const navItems = profile?.role === 'admin' ? [
    { id: 'dashboard', label: 'Admin Panel', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: UserIcon },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'enrollments', label: 'Requests', icon: ClipboardList },
    { id: 'attendance', label: 'Attendance', icon: Check },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'courses', label: 'Enrollment', icon: BookOpen },
    { id: 'attendance', label: 'Attendance', icon: Check },
    { id: 'status', label: 'My Status', icon: ClipboardList },
    { id: 'notifications', label: 'Alerts', icon: Bell },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col h-auto md:h-screen sticky top-0 z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <GraduationCap size={24} />
          </div>
          <span className="font-bold text-xl tracking-tight">EduEnroll</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={profile?.name} referrerPolicy="no-referrer" />
              ) : (
                profile?.name.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{profile?.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{profile?.role}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-600 hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
            <LogOut size={18} />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <ErrorBoundary>
              {activeTab === 'profile' ? (
                <Profile />
              ) : profile?.role === 'admin' ? (
                <AdminDashboard activeTab={activeTab} />
              ) : (
                <StudentDashboard activeTab={activeTab} />
              )}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}
