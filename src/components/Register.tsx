import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { GraduationCap, UserPlus, User as UserIcon, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

const Register = () => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.displayName || '',
    major: '',
    phoneNumber: '',
    role: (user?.email === "2004situ@gmail.com" ? 'admin' : '') as 'student' | 'admin' | '',
  });

  const generateUniqueId = (role: 'student' | 'admin') => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = role === 'student' ? 'STU' : 'ADM';
    return `${prefix}-${year}-${timestamp}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.role) {
      toast.error("Please select whether you are a Student or an Admin.");
      return;
    }

    if (!formData.name || (formData.role === 'student' && !formData.major)) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const uniqueId = generateUniqueId(formData.role as 'student' | 'admin');
      
      const userData: any = {
        uid: user.uid,
        name: formData.name,
        email: user.email,
        role: formData.role,
        isRegistered: true,
        createdAt: serverTimestamp(),
      };

      if (formData.role === 'student') {
        userData.studentId = uniqueId;
        userData.major = formData.major;
      } else {
        userData.adminId = uniqueId;
      }

      if (formData.phoneNumber) {
        userData.phoneNumber = formData.phoneNumber;
      }

      await setDoc(doc(db, 'users', user.uid), userData);
      
      const idLabel = formData.role === 'student' ? 'Student ID' : 'Admin ID';
      toast.success(`Registration complete! Your ${idLabel} is ${uniqueId}. Welcome to EduEnroll.`);
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to complete registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg"
      >
        <Card className="shadow-xl border-none">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center text-primary mb-2">
              <UserPlus size={28} />
            </div>
            <CardTitle className="text-2xl font-bold">Complete Your Registration</CardTitle>
            <CardDescription>
              Please provide a few more details to set up your student account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold">I am registering as a... *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, role: 'student'})}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      formData.role === 'student' 
                        ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20' 
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <UserIcon size={24} className="mb-2" />
                    <span className="text-sm font-bold">Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, role: 'admin'})}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      formData.role === 'admin' 
                        ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20' 
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <ShieldCheck size={24} className="mb-2" />
                    <span className="text-sm font-bold">Admin</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  placeholder="John Doe"
                  required
                />
              </div>
              
              {formData.role === 'student' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium flex items-center gap-2">
                      <GraduationCap size={14} />
                      A unique Student ID will be generated for you automatically.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="major">Major / Program *</Label>
                    <Input 
                      id="major" 
                      value={formData.major} 
                      onChange={(e) => setFormData({...formData, major: e.target.value})} 
                      placeholder="Computer Science"
                      required
                    />
                  </div>
                </div>
              )}

              {formData.role === 'admin' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-2">
                      <ShieldCheck size={14} />
                      A unique Admin ID will be generated for you automatically.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                <Input 
                  id="phoneNumber" 
                  value={formData.phoneNumber} 
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} 
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Completing Registration...' : 'Complete Registration'}
                </Button>
              </div>
              
              <p className="text-center text-xs text-slate-400 mt-4">
                By completing registration, you agree to our terms of service.
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Register;
