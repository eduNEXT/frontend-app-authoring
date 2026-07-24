import { useWaffleFlags } from '@src/data/apiHooks';
import { useUserPermissions } from '@src/authz/data/apiHooks';
import { PermissionValidationAnswer, PermissionValidationQuery } from '@src/authz/types';

/**
 * Hook for platform-level (non-course-scoped) permission checks. Reads the authz
 * waffle flag internally — callers do not need to pass `isAuthzEnabled`. Has no
 * "authz disabled → allow" fallback: when authz is off, data is undefined.
 *
 * Use this for features that only make sense when authz is active (e.g. the
 * Roles & Permissions button in Studio Home). Pass `enabled` to add an extra
 * gate on top of the flag (e.g. whether the admin console URL is configured).
 *
 * For course-scoped checks with the legacy-allow fallback, use `useCourseUserPermissions`.
 * For low-level custom gating (e.g. library features), use `useUserPermissions` directly.
 */
export const usePlatformUserPermissions = <Query extends PermissionValidationQuery>(
  permissions: Query,
  enabled: boolean = true,
) => {
  const waffleFlags = useWaffleFlags();
  const isAuthzEnabled: boolean = waffleFlags?.enableAuthzCourseAuthoring ?? false;
  return useUserPermissions(permissions, isAuthzEnabled && enabled);
};

type UseCourseUserPermissionsReturn<Query extends PermissionValidationQuery> = {
  isLoading: boolean;
  isAuthzEnabled: boolean;
} & PermissionValidationAnswer<Query>;

/**
 * Custom hook to retrieve and evaluate user permissions for the current course using the openedx-authz service.
 *
 * The hook:
 * 1. Validate if authz is enabled via waffle flag
 * 2. Fetch user permissions when authz is enabled
 * 3. Fallback all permissions to 'true' when authz is disabled
 * 4. Provide fallback values for undefined permissions
 *
 * @param courseId - The course ID to check permissions for
 * @param permissions - Object mapping permission names to their action/scope definitions
 * @returns Object containing loading state, permissions results, and authz status
 *
 * @example
 * ```tsx
 * const { isLoading, canViewGradingSettings, canEditGradingSettings, isAuthzEnabled } = useCourseUserPermissions(
 *   courseId,
 *   {
 *     canViewGradingSettings: {
 *       action: COURSE_PERMISSIONS.VIEW_GRADING_SETTINGS,
 *       scope: courseId,
 *     },
 *     canEditGradingSettings: {
 *       action: COURSE_PERMISSIONS.EDIT_GRADING_SETTINGS,
 *       scope: courseId,
 *     },
 *   }
 * );
 * ```
 */
export const useCourseUserPermissions = <Query extends PermissionValidationQuery>(
  courseId: string,
  permissions: Query,
): UseCourseUserPermissionsReturn<Query> => {
  const waffleFlags = useWaffleFlags(courseId);
  const isWaffleFlagsLoading: boolean = waffleFlags?.isLoading ?? true;
  const isAuthzEnabled: boolean = waffleFlags?.enableAuthzCourseAuthoring ?? false;

  const {
    isLoading: isLoadingUserPermissions,
    data: userPermissions,
  } = useUserPermissions(permissions, isAuthzEnabled && !!courseId);

  const isLoading = isWaffleFlagsLoading || (isAuthzEnabled && isLoadingUserPermissions);

  const resolvePermission = (key: string): boolean => {
    if (!isAuthzEnabled) {
      return true;
    }
    return userPermissions?.[key] ?? false;
  };

  const permissionResults: Record<string, boolean> = isLoading
    ? Object.keys(permissions).reduce<Record<string, boolean>>((acc, key) => {
      acc[key] = false;
      return acc;
    }, {})
    : Object.keys(permissions).reduce<Record<string, boolean>>((acc, key) => {
      acc[key] = resolvePermission(key);
      return acc;
    }, {});

  return {
    isLoading,
    isAuthzEnabled,
    ...permissionResults as PermissionValidationAnswer<Query>,
  };
};
