import { describe, it, expect } from 'vitest';
import { getEnrollmentBlocker } from '../src/lib/enrollment';
import type { Course, Enrollment } from '../src/types';

const course = (over: Partial<Course> = {}): Course => ({
  id: 'c1',
  code: 'CS101',
  title: 'Intro to Programming',
  capacity: 30,
  enrolledCount: 0,
  ...over,
});

const enrollment = (over: Partial<Enrollment> = {}): Enrollment => ({
  id: 'e1',
  studentUid: 'u1',
  courseId: 'c1',
  status: 'pending',
  requestedAt: null,
  updatedAt: null,
  ...over,
});

describe('getEnrollmentBlocker', () => {
  it('allows a request for an open course with no prerequisites', () => {
    expect(getEnrollmentBlocker(course(), [], [])).toBeNull();
  });

  it('blocks a duplicate request, whatever the earlier status was', () => {
    for (const status of ['pending', 'approved', 'rejected'] as const) {
      const result = getEnrollmentBlocker(course(), [enrollment({ status })], []);
      expect(result).toBe(`You already have a ${status} enrollment for this course.`);
    }
  });

  it('blocks a full course', () => {
    const full = course({ capacity: 2, enrolledCount: 2 });
    expect(getEnrollmentBlocker(full, [], [])).toBe('Course is full.');
  });

  it('allows the last free seat', () => {
    const almost = course({ capacity: 2, enrolledCount: 1 });
    expect(getEnrollmentBlocker(almost, [], [])).toBeNull();
  });

  describe('prerequisites', () => {
    const intro = course({ id: 'c0', code: 'CS100' });
    const advanced = course({ id: 'c1', code: 'CS200', prerequisites: ['CS100'] });

    it('blocks when the prerequisite was never taken', () => {
      expect(getEnrollmentBlocker(advanced, [], [intro, advanced])).toBe(
        'Missing prerequisites: CS100'
      );
    });

    it('blocks when the prerequisite is only pending', () => {
      const pending = enrollment({ courseId: 'c0', status: 'pending' });
      expect(getEnrollmentBlocker(advanced, [pending], [intro, advanced])).toBe(
        'Missing prerequisites: CS100'
      );
    });

    it('allows when the prerequisite is approved', () => {
      const approved = enrollment({ courseId: 'c0', status: 'approved' });
      expect(getEnrollmentBlocker(advanced, [approved], [intro, advanced])).toBeNull();
    });

    it('lists every missing prerequisite', () => {
      const multi = course({ id: 'c3', code: 'CS300', prerequisites: ['CS100', 'MA101'] });
      expect(getEnrollmentBlocker(multi, [], [intro, multi])).toBe(
        'Missing prerequisites: CS100, MA101'
      );
    });
  });
});
