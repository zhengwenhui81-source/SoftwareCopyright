const USER_KEY = 'plate-monitor-user'

export const roleLabels = {
  admin: '管理员',
  engineer: '工程师',
  operator: '操作员',
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export function login(username, role) {
  const user = { username, role, roleName: roleLabels[role] }
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

export function logout() {
  localStorage.removeItem(USER_KEY)
}

export function hasRole(roles = []) {
  const user = getUser()
  return roles.length === 0 || Boolean(user && roles.includes(user.role))
}
