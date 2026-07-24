import { useQuery } from '@tanstack/react-query';
import { PermissionValidationAnswer, PermissionValidationQuery } from '@src/authz/types';
import { validateUserPermissions } from './api';

const adminConsoleQueryKeys = {
  all: ['authz'],
  permissions: (permissions: PermissionValidationQuery) =>
    [...adminConsoleQueryKeys.all, 'validatePermissions', permissions] as const,
};

/**
 * React Query hook to validate if the current user has permissions over a certain object in the instance.
 * Low-level data hook — does not read the authz waffle flag. Use `useCourseUserPermissions`
 * for course-scoped checks (includes the "authz disabled → allow" fallback) or pass
 * `isAuthzEnabled` explicitly via the `enabled` param for other contexts.
 *
 * @param permissions - A key/value map of objects and actions to validate.
 * The key is an arbitrary string to identify the permission check,
 * and the value is an object containing the action and optional scope.
 *
 * @example
 * const { isLoading, data } = useUserPermissions({
 *     canRead: {
 *         action: "content_libraries.view_library",
 *         scope: "lib:OpenedX:CSPROB"
 *      }
 *    });
 * if (data.canRead) { ... }
 */
export const useUserPermissions = (
  permissions: PermissionValidationQuery,
  enabled: boolean = true,
) =>
  useQuery<PermissionValidationAnswer, Error>({
    queryKey: adminConsoleQueryKeys.permissions(permissions),
    queryFn: () => validateUserPermissions(permissions),
    enabled,
    retry: false,
  });
