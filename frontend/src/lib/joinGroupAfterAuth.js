import { competitionGroupsApi } from '../api/client.js';

/** Une al usuario a un grupo tras registro/login (enlace de invitación). */
export async function joinGroupAfterAuth(joinGroupId) {
  if (!joinGroupId) return null;
  const { group } = await competitionGroupsApi.join(joinGroupId);
  return group;
}
