const LOGIN_PATTERN = /^[A-Za-z0-9._@-]+$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function requireSiteId(input: string | undefined): string {
  const id = (input || '').trim()
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Missing site id'
    })
  }
  return id
}

export function requireUserLogin(value: unknown, fieldName = 'userLogin'): string {
  if (typeof value !== 'string') {
    throw createError({
      statusCode: 400,
      message: `${fieldName} is required`
    })
  }

  const login = value.trim()
  if (!login) {
    throw createError({
      statusCode: 400,
      message: `${fieldName} is required`
    })
  }

  if (login.length > 60) {
    throw createError({
      statusCode: 400,
      message: `${fieldName} is too long`
    })
  }

  if (!LOGIN_PATTERN.test(login)) {
    throw createError({
      statusCode: 400,
      message: `${fieldName} contains invalid characters`
    })
  }

  return login
}

export function requireEmail(value: unknown, fieldName = 'email'): string {
  if (typeof value !== 'string') {
    throw createError({
      statusCode: 400,
      message: `${fieldName} is required`
    })
  }

  const email = value.trim().toLowerCase()
  if (!email) {
    throw createError({
      statusCode: 400,
      message: `${fieldName} is required`
    })
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw createError({
      statusCode: 400,
      message: `${fieldName} must be a valid email address`
    })
  }

  return email
}

export function requirePassword(value: unknown): string {
  if (typeof value !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'password is required'
    })
  }

  const password = value.trim()
  if (!password) {
    throw createError({
      statusCode: 400,
      message: 'password is required'
    })
  }

  if (password.length > 256) {
    throw createError({
      statusCode: 400,
      message: 'password is too long'
    })
  }

  if (/[\r\n]/.test(password)) {
    throw createError({
      statusCode: 400,
      message: 'password contains invalid characters'
    })
  }

  return password
}

export function optionalUserLogin(value: unknown, fieldName = 'username'): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    throw createError({
      statusCode: 400,
      message: `${fieldName} must be a string or null`
    })
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return requireUserLogin(trimmed, fieldName)
}
