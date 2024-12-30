/* eslint-disable import/prefer-default-export */
import { camelCaseObject, getConfig, modifyObjectKeys, snakeCaseObject } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { convertObjectToSnakeCase } from '../../utils';

const getApiBaseUrl = () => getConfig().STUDIO_BASE_URL;
export const getCourseAdvancedSettingsApiUrl = (courseId) => `${getApiBaseUrl()}/api/contentstore/v0/advanced_settings/${courseId}`;
const getProctoringErrorsApiUrl = () => `${getApiBaseUrl()}/api/contentstore/v1/proctoring_errors/`;

/**
 * Get's advanced setting for a course.
 * @param {string} courseId
 * @returns {Promise<Object>}
 */
export async function getCourseAdvancedSettings(courseId) {
  const { data } = await getAuthenticatedHttpClient()
    .get(`${getCourseAdvancedSettingsApiUrl(courseId)}?fetch_all=0`);
  const objectFormatted = camelCaseObject(data);
  return modifyObjectKeys(objectFormatted, (key) => {
    if (objectFormatted[key]) {
      objectFormatted[key]['value'] = snakeCaseObject(objectFormatted[key]['value'])
    }
    return key;
  });
}

/**
 * Updates advanced setting for a course.
 * @param {string} courseId
 * @param {object} settings
 * @returns {Promise<Object>}
 */
export async function updateCourseAdvancedSettings(courseId, settings) {
  const { data } = await getAuthenticatedHttpClient()
    .patch(`${getCourseAdvancedSettingsApiUrl(courseId)}`, convertObjectToSnakeCase(settings));
  const objectFormatted = camelCaseObject(data);
  return modifyObjectKeys(objectFormatted, (key) => {
    if (objectFormatted[key]) {
      objectFormatted[key]['value'] = snakeCaseObject(objectFormatted[key]['value'])
    }
    return key;
  });
}

/**
 * Gets proctoring exam errors.
 * @param {string} courseId
 * @returns {Promise<Object>}
 */
export async function getProctoringExamErrors(courseId) {
  const { data } = await getAuthenticatedHttpClient().get(`${getProctoringErrorsApiUrl()}${courseId}`);
  return camelCaseObject(data);
}
