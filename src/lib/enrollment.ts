import { Course, Enrollment } from '@/types';

/**
 * Checks whether a student may request enrollment in a course.
 * Returns the reason they can't, or null when the request is allowed.
 */
export function getEnrollmentBlocker(
  course: Course,
  enrollments: Enrollment[],
  courses: Course[]
): string | null {
  const existing = enrollments.find((e) => e.courseId === course.id);
  if (existing) {
    return `You already have a ${existing.status} enrollment for this course.`;
  }

  if (course.enrolledCount >= course.capacity) {
    return 'Course is full.';
  }

  if (course.prerequisites && course.prerequisites.length > 0) {
    const approvedCourseIds = enrollments
      .filter((e) => e.status === 'approved')
      .map((e) => e.courseId);

    // Prerequisites are course codes, so look up the codes of approved courses
    const approvedCodes = courses
      .filter((c) => approvedCourseIds.includes(c.id))
      .map((c) => c.code);

    const missing = course.prerequisites.filter((p) => !approvedCodes.includes(p));
    if (missing.length > 0) {
      return `Missing prerequisites: ${missing.join(', ')}`;
    }
  }

  return null;
}
