import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { Course, Enrollment, UserProfile, Notification } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, BookOpen, ClipboardList, Plus, Trash2, Edit, Check, X, BarChart3, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';

interface AttendanceRecord {
  id: string;
  courseId: string;
  date: string;
  presentStudents: string[];
  isOpen: boolean;
  createdAt: any;
}

interface Props {
  activeTab: string;
}

const AdminDashboard: React.FC<Props> = ({ activeTab }) => {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  
  // Form states
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({
    code: '',
    title: '',
    description: '',
    capacity: 30,
    prerequisites: ''
  });

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;

    // Listen to courses
    const unsubscribeCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'courses'));

    // Listen to all enrollments
    const unsubscribeEnrollments = onSnapshot(collection(db, 'enrollments'), (snapshot) => {
      console.log("Admin: Enrollment snapshot received, count:", snapshot.size);
      setEnrollments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment)));
    }, (error) => {
      console.error("Admin: Enrollment list error details:", error);
      handleFirestoreError(error, OperationType.LIST, 'enrollments');
    });

    // Listen to all students
    const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Listen to attendance
    const unsubscribeAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setAttendanceRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance'));

    return () => {
      unsubscribeCourses();
      unsubscribeEnrollments();
      unsubscribeStudents();
      unsubscribeAttendance();
    };
  }, [profile]);

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const courseData = {
        code: courseForm.code,
        title: courseForm.title,
        description: courseForm.description,
        capacity: Number(courseForm.capacity),
        prerequisites: courseForm.prerequisites.split(',').map(p => p.trim()).filter(p => p !== ''),
        enrolledCount: editingCourse ? editingCourse.enrolledCount : 0
      };

      if (editingCourse) {
        await updateDoc(doc(db, 'courses', editingCourse.id), courseData);
        toast.success("Course updated successfully.");
      } else {
        await addDoc(collection(db, 'courses'), courseData);
        toast.success("Course created successfully.");
      }
      setIsCourseDialogOpen(false);
      setEditingCourse(null);
      setCourseForm({ code: '', title: '', description: '', capacity: 30, prerequisites: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'courses');
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm("Are you sure you want to delete this course? This will not delete existing enrollment records.")) return;
    try {
      await deleteDoc(doc(db, 'courses', id));
      toast.success("Course deleted.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `courses/${id}`);
    }
  };

  const handleEnrollmentAction = async (enrollment: Enrollment, status: 'approved' | 'rejected') => {
    try {
      const batch = writeBatch(db);
      
      // Update enrollment status
      batch.update(doc(db, 'enrollments', enrollment.id), {
        status,
        updatedAt: serverTimestamp()
      });

      // If approved, increment course enrolledCount
      if (status === 'approved') {
        const course = courses.find(c => c.id === enrollment.courseId);
        if (course) {
          batch.update(doc(db, 'courses', course.id), {
            enrolledCount: course.enrolledCount + 1
          });
        }
      }

      // Create notification for student
      const course = courses.find(c => c.id === enrollment.courseId);
      batch.set(doc(collection(db, 'notifications')), {
        recipientUid: enrollment.studentUid,
        message: `Your enrollment request for ${course?.code || 'a course'} has been ${status}.`,
        type: 'enrollment_update',
        read: false,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      toast.success(`Enrollment ${status}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'enrollments');
    }
  };

  // Reporting Data
  const courseCapacityData = courses.map(c => ({
    name: c.code,
    enrolled: c.enrolledCount,
    capacity: c.capacity
  }));

  const enrollmentStatusData = [
    { name: 'Approved', value: enrollments.filter(e => e.status === 'approved').length },
    { name: 'Pending', value: enrollments.filter(e => e.status === 'pending').length },
    { name: 'Rejected', value: enrollments.filter(e => e.status === 'rejected').length },
  ];

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  if (activeTab === 'dashboard') {
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Overview</h1>
            <p className="text-slate-500 mt-1">System-wide statistics and reporting.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">Total Students</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">Total Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courses.length}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">Pending Requests</CardTitle>
              <ClipboardList className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enrollments.filter(e => e.status === 'pending').length}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">Approved Enrollments</CardTitle>
              <Check className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enrollments.filter(e => e.status === 'approved').length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Course Capacity Report
              </CardTitle>
              <CardDescription>Enrolled vs Total Capacity per course</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseCapacityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="enrolled" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Enrolled" />
                  <Bar dataKey="capacity" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Capacity" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" />
                Enrollment Status Distribution
              </CardTitle>
              <CardDescription>Overview of all enrollment request statuses</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={enrollmentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {enrollmentStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 ml-4">
                {enrollmentStatusData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    <span className="text-xs font-medium text-slate-600">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (activeTab === 'students') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Student Records</h1>
            <p className="text-slate-500 mt-1">Manage and view all registered students.</p>
          </div>
        </div>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Major</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.uid} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium text-slate-700">{student.name}</TableCell>
                    <TableCell className="text-slate-500">{student.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{student.studentId || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">{student.major || 'N/A'}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{student.phoneNumber || 'N/A'}</TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {student.createdAt?.toDate().toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeTab === 'courses') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Course Offerings</h1>
            <p className="text-slate-500 mt-1">Create and manage academic courses.</p>
          </div>
          <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
            <DialogTrigger 
              render={
                <Button className="gap-2" onClick={() => {
                  setEditingCourse(null);
                  setCourseForm({ code: '', title: '', description: '', capacity: 30, prerequisites: '' });
                }}>
                  <Plus size={18} />
                  Add Course
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCourse ? 'Edit Course' : 'Create New Course'}</DialogTitle>
                <DialogDescription>Enter the course details below.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveCourse} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Course Code</Label>
                    <Input id="code" value={courseForm.code} onChange={e => setCourseForm({...courseForm, code: e.target.value})} placeholder="CS101" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input id="capacity" type="number" value={courseForm.capacity} onChange={e => setCourseForm({...courseForm, capacity: Number(e.target.value)})} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Course Title</Label>
                  <Input id="title" value={courseForm.title} onChange={e => setCourseForm({...courseForm, title: e.target.value})} placeholder="Introduction to Computer Science" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" value={courseForm.description} onChange={e => setCourseForm({...courseForm, description: e.target.value})} placeholder="Course overview..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prerequisites">Prerequisites (comma separated codes)</Label>
                  <Input id="prerequisites" value={courseForm.prerequisites} onChange={e => setCourseForm({...courseForm, prerequisites: e.target.value})} placeholder="CS100, MATH101" />
                </div>
                <DialogFooter>
                  <Button type="submit">{editingCourse ? 'Update Course' : 'Create Course'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-mono font-medium">{course.code}</TableCell>
                    <TableCell className="font-medium text-slate-700">{course.title}</TableCell>
                    <TableCell>{course.enrolledCount}</TableCell>
                    <TableCell>{course.capacity}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary" onClick={() => {
                        setEditingCourse(course);
                        setCourseForm({
                          code: course.code,
                          title: course.title,
                          description: course.description || '',
                          capacity: course.capacity,
                          prerequisites: course.prerequisites?.join(', ') || ''
                        });
                        setIsCourseDialogOpen(true);
                      }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-destructive" onClick={() => handleDeleteCourse(course.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeTab === 'enrollments') {
    const pendingEnrollments = enrollments.filter(e => e.status === 'pending');
    
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Enrollment Requests</h1>
          <p className="text-slate-500 mt-1">Review and approve student course applications.</p>
        </div>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingEnrollments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">
                      No pending enrollment requests.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingEnrollments.sort((a, b) => b.requestedAt?.toMillis() - a.requestedAt?.toMillis()).map((enrollment) => {
                    const student = students.find(s => s.uid === enrollment.studentUid);
                    const course = courses.find(c => c.id === enrollment.courseId);
                    return (
                      <TableRow key={enrollment.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{student?.name || 'Unknown'}</span>
                            <span className="text-xs text-slate-400">{student?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{course?.code}</span>
                            <span className="text-xs text-slate-400">{course?.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {enrollment.requestedAt?.toDate().toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-green-50 text-green-600 border-green-100 hover:bg-green-100 hover:text-green-700"
                            onClick={() => handleEnrollmentAction(enrollment, 'approved')}
                          >
                            <Check className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-red-50 text-red-600 border-red-100 hover:bg-red-100 hover:text-red-700"
                            onClick={() => handleEnrollmentAction(enrollment, 'rejected')}
                          >
                            <X className="h-4 w-4 mr-1" /> Reject
                          </Button>
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

  if (activeTab === 'attendance') {
    const handleOpenAttendance = async (courseId: string) => {
      const date = new Date().toISOString().split('T')[0];
      const id = `${courseId}_${date}`;
      try {
        await setDoc(doc(db, 'attendance', id), {
          courseId,
          date,
          presentStudents: [],
          isOpen: true,
          createdAt: serverTimestamp()
        });
        toast.success(`Attendance opened for ${date}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'attendance');
      }
    };

    const handleToggleAttendance = async (record: AttendanceRecord) => {
      try {
        await updateDoc(doc(db, 'attendance', record.id), {
          isOpen: !record.isOpen
        });
        toast.success(`Attendance ${!record.isOpen ? 'opened' : 'closed'}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `attendance/${record.id}`);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Attendance Tracker</h1>
          <p className="text-slate-500 mt-1">Manage daily attendance for active courses.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map(course => {
            const today = new Date().toISOString().split('T')[0];
            const todayRecord = attendanceRecords.find(r => r.courseId === course.id && r.date === today);
            
            return (
              <Card key={course.id} className="border-none shadow-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <Badge variant="secondary" className="font-mono">{course.code}</Badge>
                    {todayRecord && (
                      <Badge variant={todayRecord.isOpen ? "default" : "outline"} className={todayRecord.isOpen ? "bg-green-500" : ""}>
                        {todayRecord.isOpen ? "Live" : "Closed"}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-2">{course.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Present Today:</span>
                    <span className="font-bold text-primary">{todayRecord?.presentStudents.length || 0}</span>
                  </div>
                  
                  {todayRecord ? (
                    <Button 
                      variant={todayRecord.isOpen ? "destructive" : "default"} 
                      className="w-full"
                      onClick={() => handleToggleAttendance(todayRecord)}
                    >
                      {todayRecord.isOpen ? "Close Attendance" : "Re-open Attendance"}
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => handleOpenAttendance(course.id)}>
                      Open Attendance for Today
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-none shadow-sm bg-white mt-8">
          <CardHeader>
            <CardTitle>Recent Attendance History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(record => {
                  const course = courses.find(c => c.id === record.courseId);
                  return (
                    <TableRow key={record.id}>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>{course?.code} - {course?.title}</TableCell>
                      <TableCell>{record.presentStudents.length}</TableCell>
                      <TableCell>
                        <Badge variant={record.isOpen ? "default" : "outline"}>
                          {record.isOpen ? "Open" : "Closed"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeTab === 'reports') {
    // Analytics logic
    const studentPerformance = students.map(student => {
      const studentEnrollments = enrollments.filter(e => e.studentUid === student.uid && e.status === 'approved');
      const totalPossibleAttendance = attendanceRecords.filter(r => studentEnrollments.some(e => e.courseId === r.courseId)).length;
      const actualAttendance = attendanceRecords.filter(r => r.presentStudents.includes(student.uid)).length;
      const rate = totalPossibleAttendance > 0 ? (actualAttendance / totalPossibleAttendance) * 100 : 0;
      
      return {
        name: student.name,
        id: student.studentId,
        courses: studentEnrollments.length,
        attendanceRate: rate.toFixed(1)
      };
    });

    const courseStats = courses.map(course => {
      const courseAttendance = attendanceRecords.filter(r => r.courseId === course.id);
      const avgAttendance = courseAttendance.length > 0 
        ? courseAttendance.reduce((acc, r) => acc + r.presentStudents.length, 0) / courseAttendance.length
        : 0;
      
      return {
        code: course.code,
        title: course.title,
        enrollment: course.enrolledCount,
        avgAttendance: avgAttendance.toFixed(1),
        utilization: ((course.enrolledCount / course.capacity) * 100).toFixed(1)
      };
    });

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Academic Reports</h1>
          <p className="text-slate-500 mt-1">Detailed performance analytics and calibration data.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Student Attendance Performance</CardTitle>
              <CardDescription>Overall engagement rates per student</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Courses</TableHead>
                    <TableHead>Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentPerformance.sort((a, b) => Number(b.attendanceRate) - Number(a.attendanceRate)).map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.courses}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${Number(s.attendanceRate) > 75 ? 'bg-green-500' : Number(s.attendanceRate) > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${s.attendanceRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold w-10">{s.attendanceRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Course Quality & Engagement</CardTitle>
              <CardDescription>Utilization and average attendance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Utilization</TableHead>
                    <TableHead>Avg. Presence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseStats.map(c => (
                    <TableRow key={c.code}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold">{c.code}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{c.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.utilization}%</Badge>
                      </TableCell>
                      <TableCell className="font-bold text-primary">{c.avgAttendance}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm bg-primary/5 border border-primary/10">
          <CardHeader>
            <CardTitle className="text-primary">Teacher Performance Calibration</CardTitle>
            <CardDescription>System-wide insights for quality improvement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-white rounded-xl shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Overall Engagement</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {(studentPerformance.reduce((acc, s) => acc + Number(s.attendanceRate), 0) / (studentPerformance.length || 1)).toFixed(1)}%
                </p>
                <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp size={10} /> +2.4% from last month
                </p>
              </div>
              <div className="p-4 bg-white rounded-xl shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Course Satisfaction</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">4.8 / 5.0</p>
                <p className="text-[10px] text-slate-400 mt-1">Based on student feedback</p>
              </div>
              <div className="p-4 bg-white rounded-xl shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Resource Utilization</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {(courseStats.reduce((acc, c) => acc + Number(c.utilization), 0) / (courseStats.length || 1)).toFixed(1)}%
                </p>
                <p className="text-[10px] text-amber-600 mt-1">Capacity optimization needed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default AdminDashboard;
