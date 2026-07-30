import { usePermissions } from '@openedx/frontend-authz';
import { useWaffleFlags } from '@src/data/apiHooks';
import type { PermissionValidationQuery } from '@src/authz/types';

export const useCourseUserPermissions = <Query extends PermissionValidationQuery>(
  courseId: string,
  permissions: Query,
) => {
  const waffleFlags = useWaffleFlags(courseId);
  const isWaffleFlagsLoading: boolean = waffleFlags?.isLoading ?? true;
  const isAuthzEnabled: boolean = waffleFlags?.enableAuthzCourseAuthoring ?? false;

  const result = usePermissions(
    permissions,
    isAuthzEnabled,
  );

  return {
    ...result,
    isLoading: isWaffleFlagsLoading || result.isLoading,
  };
};
