import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, updateDoc, doc, getDocs, arrayUnion } from 'firebase/firestore';
import { Course, Enrollment, Notification } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BookOpen, CheckCircle2, Clock, XCircle, Bell, User as UserIcon, Search } from 'lucide-react';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';

interface Props {
  activeTab: string;
}

const StudentDashboard: React.FC<Props> = ({ activeTab }) => {
  const { profile, user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!profile) return;

    // Listen to courses
    const unsubscribeCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'courses'));

    // Listen to my enrollments
    const qEnrollments = query(
      collection(db, 'enrollments'), 
      where('studentUid', '==', profile.uid)
    );
    
    const unsubscribeEnrollments = onSnapshot(qEnrollments, (snapshot) => {
      console.log("Enrollment snapshot received, count:", snapshot.size);
      setEnrollments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment)));
    }, (error) => {
      console.error("Enrollment list error details:", error);
      handleFirestoreError(error, OperationType.LIST, 'enrollments');
    });

    // Listen to my notifications
    const qNotifications = query(collection(db, 'notifications'), where('recipientUid', '==', profile.uid));
    const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    // Listen to attendance
    const unsubscribeAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setAttendanceRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance'));

    return () => {
      unsubscribeCourses();
      unsubscribeEnrollments();
      unsubscribeNotifications();
      unsubscribeAttendance();
    };
  }, [profile]);

  const handleEnroll = async (course: Course) => {
    if (!profile) return;

    // Check if already enrolled or pending
    const existing = enrollments.find(e => e.courseId === course.id);
    if (existing) {
      toast.error(`You already have a ${existing.status} enrollment for this course.`);
      return;
    }

    // Check capacity
    if (course.enrolledCount >= course.capacity) {
      toast.error("Course is full.");
      return;
    }

    // Check prerequisites
    if (course.prerequisites && course.prerequisites.length > 0) {
      const approvedEnrollments = enrollments.filter(e => e.status === 'approved');
      const approvedCourseIds = approvedEnrollments.map(e => e.courseId);
      
      // We need to fetch course codes for approved enrollments to check prerequisites
      // For simplicity in this demo, we'll assume prerequisites are course codes
      // and we check if the student has approved enrollments for those codes
      const approvedCourseCodes = courses
        .filter(c => approvedCourseIds.includes(c.id))
        .map(c => c.code);

      const missingPrereqs = course.prerequisites.filter(p => !approvedCourseCodes.includes(p));
      if (missingPrereqs.length > 0) {
        toast.error(`Missing prerequisites: ${missingPrereqs.join(', ')}`);
        return;
      }
    }

    try {
      await addDoc(collection(db, 'enrollments'), {
        studentUid: profile.uid,
        courseId: course.id,
        status: 'pending',
        requestedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success(`Enrollment request for ${course.code} submitted.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'enrollments');
    }
  };

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (activeTab === 'dashboard') {
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome, {profile?.name}</h1>
            <p className="text-slate-500 mt-1">Manage your academic journey and course enrollments.</p>
          </div>
          <Badge variant="outline" className="px-3 py-1 text-sm bg-white shadow-sm border-slate-200">
            Student ID: {profile?.studentId || 'Not Set'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">Total Enrollments</CardTitle>
              <BookOpen className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enrollments.length}</div>
              <p className="text-xs text-slate-400 mt-1">Courses you've interacted with</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">Approved Courses</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enrollments.filter(e => e.status === 'approved').length}</div>
              <p className="text-xs text-slate-400 mt-1">Successfully enrolled</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">Pending Requests</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enrollments.filter(e => e.status === 'pending').length}</div>
              <p className="text-xs text-slate-400 mt-1">Awaiting administrator approval</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Recent Notifications
              </CardTitle>
              <CardDescription>Stay updated with your enrollment status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[300px] overflow-auto pr-2">
                {notifications.length === 0 ? (
                  <p className="text-center text-slate-400 py-8 italic">No notifications yet.</p>
                ) : (
                  notifications.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()).map((notif) => (
                    <div key={notif.id} className={`p-4 rounded-xl border transition-all ${notif.read ? 'bg-slate-50 border-slate-100' : 'bg-primary/5 border-primary/10 shadow-sm'}`}>
                      <p className="text-sm text-slate-700 font-medium">{notif.message}</p>
                      <p className="text-[10px] text-slate-400 mt-2">
                        {notif.createdAt?.toDate().toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Enrollment Summary
              </CardTitle>
              <CardDescription>Quick look at your current status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">Approved</span>
                  <Badge className="bg-green-500">{enrollments.filter(e => e.status === 'approved').length}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">Pending</span>
                  <Badge className="bg-amber-500">{enrollments.filter(e => e.status === 'pending').length}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">Rejected</span>
                  <Badge className="bg-red-500">{enrollments.filter(e => e.status === 'rejected').length}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (activeTab === 'courses') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Available Courses</h1>
          <p className="text-slate-500 mt-1">Browse and enroll in available academic offerings.</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search by course title or code..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const enrollment = enrollments.find(e => e.courseId === course.id);
            const isFull = course.enrolledCount >= course.capacity;
            
            return (
              <Card key={course.id} className="border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden flex flex-col">
                <div className="h-2 bg-primary/20" />
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <Badge variant="secondary" className="font-mono">{course.code}</Badge>
                    <Badge variant={isFull ? "destructive" : "outline"}>
                      {course.enrolledCount} / {course.capacity}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl mt-2">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  {course.prerequisites && course.prerequisites.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Prerequisites</p>
                      <div className="flex flex-wrap gap-1">
                        {course.prerequisites.map(p => (
                          <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
                <div className="p-6 pt-0 mt-auto">
                  {enrollment ? (
                    <Button className="w-full" variant="outline" disabled>
                      {enrollment.status === 'pending' && <Clock className="mr-2 h-4 w-4 text-amber-500" />}
                      {enrollment.status === 'approved' && <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />}
                      {enrollment.status === 'rejected' && <XCircle className="mr-2 h-4 w-4 text-red-500" />}
                      {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      onClick={() => handleEnroll(course)}
                      disabled={isFull}
                    >
                      {isFull ? 'Course Full' : 'Enroll Now'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (activeTab === 'attendance') {
    const myApprovedCourses = courses.filter(c => 
      enrollments.some(e => e.courseId === c.id && e.status === 'approved')
    );

    const handleMarkAttendance = async (courseId: string) => {
      if (!profile) return;
      const today = new Date().toISOString().split('T')[0];
      const id = `${courseId}_${today}`;
      
      try {
        await updateDoc(doc(db, 'attendance', id), {
          presentStudents: arrayUnion(profile.uid)
        });
        toast.success("Attendance marked successfully!");
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `attendance/${id}`);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Daily Attendance</h1>
          <p className="text-slate-500 mt-1">Mark your presence for today's lectures.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myApprovedCourses.length === 0 ? (
            <Card className="col-span-full border-none shadow-sm bg-white p-12 text-center">
              <p className="text-slate-400 italic">You are not enrolled in any courses yet.</p>
            </Card>
          ) : (
            myApprovedCourses.map(course => {
              const today = new Date().toISOString().split('T')[0];
              const record = attendanceRecords.find(r => r.courseId === course.id && r.date === today);
              const isPresent = record?.presentStudents.includes(profile?.uid);
              const isOpen = record?.isOpen;

              return (
                <Card key={course.id} className="border-none shadow-sm overflow-hidden">
                  <CardHeader className="pb-2">
                    <Badge variant="secondary" className="w-fit font-mono">{course.code}</Badge>
                    <CardTitle className="text-lg mt-2">{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Status:</span>
                      {isPresent ? (
                        <Badge className="bg-green-500">Present</Badge>
                      ) : isOpen ? (
                        <Badge className="bg-amber-500">Attendance Open</Badge>
                      ) : (
                        <Badge variant="outline">No Session</Badge>
                      )}
                    </div>
                    
                    <Button 
                      className="w-full" 
                      disabled={isPresent || !isOpen}
                      onClick={() => handleMarkAttendance(course.id)}
                    >
                      {isPresent ? "Attendance Marked" : isOpen ? "Mark Present" : "Attendance Closed"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Card className="border-none shadow-sm bg-white mt-8">
          <CardHeader>
            <CardTitle>My Attendance History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords
                  .filter(r => r.presentStudents.includes(profile?.uid))
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(record => {
                    const course = courses.find(c => c.id === record.courseId);
                    return (
                      <TableRow key={record.id}>
                        <TableCell>{record.date}</TableCell>
                        <TableCell>{course?.code} - {course?.title}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-500">Present</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {attendanceRecords.filter(r => r.presentStudents.includes(profile?.uid)).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-slate-400 italic">
                      No attendance records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeTab === 'status') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Enrollment Status</h1>
          <p className="text-slate-500 mt-1">Track the progress of your course applications.</p>
        </div>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="w-[150px]">Course Code</TableHead>
                  <TableHead>Course Title</TableHead>
                  <TableHead>Requested Date</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">
                      No enrollment requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  enrollments.sort((a, b) => b.requestedAt?.toMillis() - a.requestedAt?.toMillis()).map((enrollment) => {
                    const course = courses.find(c => c.id === enrollment.courseId);
                    return (
                      <TableRow key={enrollment.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-mono font-medium">{course?.code || '...'}</TableCell>
                        <TableCell className="font-medium text-slate-700">{course?.title || 'Unknown Course'}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {enrollment.requestedAt?.toDate().toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={
                              enrollment.status === 'approved' ? 'default' : 
                              enrollment.status === 'pending' ? 'secondary' : 'destructive'
                            }
                            className={
                              enrollment.status === 'approved' ? 'bg-green-500 hover:bg-green-600' : 
                              enrollment.status === 'pending' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-none' : ''
                            }
                          >
                            {enrollment.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default StudentDashboard;
