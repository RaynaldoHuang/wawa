const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Email atau password salah',
};

type AuthErrorLike = {
  code?: string;
  message?: string;
};

export function getSignInErrorMessage(error: unknown): string {
  const authError = (error ?? {}) as AuthErrorLike;

  if (authError.code && SIGN_IN_ERROR_MESSAGES[authError.code]) {
    return SIGN_IN_ERROR_MESSAGES[authError.code];
  }

  if (authError.message) {
    return authError.message;
  }

  return 'Terjadi kesalahan saat login';
}
