import { skipToken, useQuery } from '@tanstack/react-query';
import { PermissionValidationAnswer, PermissionValidationQuery } from '@src/authz/types';
import { CONTENT_LIBRARY_PERMISSIONS } from '@src/authz/constants';
import { validateUserPermissions } from './api';

const adminConsoleQueryKeys = {
  all: ['authz'],
  permissions: (permissions: PermissionValidationQuery) =>
    [...adminConsoleQueryKeys.all, 'validatePermissions', permissions] as const,
};

/**
 * React Query hook to validate if the current user has permissions over a certain object in the instance.
 * It helps to:
 * - Determine whether the current user can access certain object.
 * - Provide role-based rendering logic for UI components.
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
    queryFn: enabled ? () => validateUserPermissions(permissions) : skipToken,
    retry: false,
  });

/**
 * Batch-checks `view_library` permission for one or more library keys.
 * Returns a map of `{ [libraryKey]: boolean }` via React Query.
 * Defaults each key to `true` while loading (`data` is `undefined`),
 * so callers should use `data?.[key] !== false` to avoid hiding content during load.
 */
export const useLibraryViewPermissions = (libraryKeys: (string | undefined)[]) => {
  const validKeys = libraryKeys.filter((k): k is string => !!k);
  return useUserPermissions(
    Object.fromEntries(
      validKeys.map((key) => [key, { action: CONTENT_LIBRARY_PERMISSIONS.VIEW_LIBRARY, scope: key }]),
    ),
    validKeys.length > 0,
  );
};

