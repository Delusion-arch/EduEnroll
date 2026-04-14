import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { deleteUser, signOut } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User as UserIcon, Trash2, AlertTriangle, Lock, Send } from 'lucide-react';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { addDoc, serverTimestamp } from 'firebase/firestore';

const Profile = () => {
  const { profile, user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [major, setMajor] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestDetails, setRequestDetails] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setStudentId(profile.studentId || '');
      setMajor(profile.major || '');
      setPhoneNumber(profile.phoneNumber || '');
    }
  }, [profile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    // Admins cannot change name or phone number directly
    if (profile.role === 'admin') {
      if (name !== profile.name || phoneNumber !== (profile.phoneNumber || '')) {
        toast.error("Admins cannot change personal details directly. Please submit a change request.");
        return;
      }
    }

    setIsUpdating(true);
    try {
      const updateData: any = {};
      
      if (profile.role === 'student') {
        updateData.name = name;
        updateData.phoneNumber = phoneNumber;
        updateData.studentId = studentId;
        updateData.major = major;
      } else {
        // Admins can only update minor fields if any (currently none allowed directly)
        toast.info("No changes detected that can be saved directly.");
        setIsUpdating(false);
        return;
      }

      await updateDoc(doc(db, 'users', profile.uid), updateData);
      toast.success("Profile updated successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!profile || !requestReason || !requestDetails) {
      toast.error("Please provide a reason and the details you wish to change.");
      return;
    }

    setIsRequesting(true);
    try {
      await addDoc(collection(db, 'change_requests'), {
        uid: profile.uid,
        userName: profile.name,
        userEmail: profile.email,
        role: profile.role,
        reason: requestReason,
        requestedChanges: requestDetails,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      
      toast.success("Change request submitted to the system administrator.");
      setIsRequestDialogOpen(false);
      setRequestReason('');
      setRequestDetails('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'change_requests');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !profile) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Delete enrollments if student
      if (profile.role === 'student') {
        const enrollmentsQ = query(collection(db, 'enrollments'), where('studentUid', '==', profile.uid));
        const enrollmentsSnap = await getDocs(enrollmentsQ);
        enrollmentsSnap.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }

      // 2. Delete notifications
      const notificationsQ = query(collection(db, 'notifications'), where('recipientUid', '==', profile.uid));
      const notificationsSnap = await getDocs(notificationsQ);
      notificationsSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 3. Delete user document
      batch.delete(doc(db, 'users', profile.uid));

      await batch.commit();

      // 4. Delete Auth user
      try {
        await deleteUser(user);
        toast.success("Account deleted successfully.");
      } catch (authError: any) {
        console.error("Auth deletion error:", authError);
        if (authError.code === 'auth/requires-recent-login') {
          toast.error("For security, please sign out and sign in again before deleting your account.");
          // We already deleted the Firestore data, so they are effectively gone from the app logic
          // but the auth record remains. We should probably sign them out anyway.
          await signOut(auth);
        } else {
          toast.error("Failed to delete authentication record. signing out.");
          await signOut(auth);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${profile.uid}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Profile Settings</h1>
        <p className="text-slate-500 mt-1">Manage your personal information and account status.</p>
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary" />
            Personal Details
          </CardTitle>
          <CardDescription>Update your profile information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Enter your full name"
                  required
                  disabled={profile?.role === 'admin'}
                  className={profile?.role === 'admin' ? 'pr-10 bg-slate-50' : ''}
                />
                {profile?.role === 'admin' && (
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                )}
              </div>
            </div>
            
            {profile?.role === 'student' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input 
                    id="studentId" 
                    value={studentId} 
                    disabled
                    className="bg-slate-50"
                  />
                  <p className="text-[10px] text-slate-400 italic">Student ID is system-generated and cannot be changed.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="major">Major / Program</Label>
                  <Input 
                    id="major" 
                    value={major} 
                    onChange={(e) => setMajor(e.target.value)} 
                    placeholder="Enter your major"
                  />
                </div>
              </>
            )}

            {profile?.role === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="adminId">Admin ID</Label>
                <Input 
                  id="adminId" 
                  value={profile.adminId || ''} 
                  disabled
                  className="bg-slate-50"
                />
                <p className="text-[10px] text-slate-400 italic">Admin ID is system-generated and cannot be changed.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <div className="relative">
                <Input 
                  id="phoneNumber" 
                  value={phoneNumber} 
                  onChange={(e) => setPhoneNumber(e.target.value)} 
                  placeholder="Enter your phone number"
                  disabled={profile?.role === 'admin'}
                  className={profile?.role === 'admin' ? 'pr-10 bg-slate-50' : ''}
                />
                {profile?.role === 'admin' && (
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Input value={profile?.email || ''} disabled className="bg-slate-50 pr-10" />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {profile?.role === 'admin' ? (
              <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
                <DialogTrigger render={
                  <Button type="button" variant="outline" className="w-full gap-2 border-primary/20 text-primary hover:bg-primary/5">
                    <Send size={18} />
                    Request Profile Changes
                  </Button>
                } />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Profile Changes</DialogTitle>
                    <DialogDescription>
                      Personal details for administrators are protected. Please provide the details you wish to change and the reason.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="reason">Reason for Change</Label>
                      <Input 
                        id="reason" 
                        value={requestReason} 
                        onChange={(e) => setRequestReason(e.target.value)} 
                        placeholder="e.g., Legal name change"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="details">Requested Changes</Label>
                      <Textarea 
                        id="details" 
                        value={requestDetails} 
                        onChange={(e) => setRequestDetails(e.target.value)} 
                        placeholder="e.g., Change name to Jane Doe, Change phone to +1..."
                        className="min-h-[100px]"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmitRequest} disabled={isRequesting}>
                      {isRequesting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Button type="submit" disabled={isUpdating} className="w-full">
                {isUpdating ? 'Updating...' : 'Save Changes'}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="border-red-100 shadow-sm bg-red-50/30">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">Delete Account</p>
              <p className="text-sm text-slate-500">Once you delete your account, there is no going back. Please be certain.</p>
            </div>
            
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogTrigger render={
                <Button variant="destructive" className="gap-2">
                  <Trash2 size={18} />
                  Delete Account
                </Button>
              } />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete your account
                    and remove your data from our servers, including all your enrollment history.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
