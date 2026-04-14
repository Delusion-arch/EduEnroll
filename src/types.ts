export type UserRole = 'student' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
  major?: string;
  phoneNumber?: string;
  isRegistered?: boolean;
  createdAt: any; // Firestore Timestamp
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description?: string;
  capacity: number;
  enrolledCount: number;
  prerequisites?: string[];
}

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected';

export interface Enrollment {
  id: string;
  studentUid: string;
  courseId: string;
  status: EnrollmentStatus;
  requestedAt: any;
  updatedAt: any;
}

export interface Notification {
  id: string;
  recipientUid: string;
  message: string;
  type: 'enrollment_update' | 'announcement';
  read: boolean;
  createdAt: any;
}
