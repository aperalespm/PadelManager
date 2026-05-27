export const authClient = {
  signIn: {
    email: async (_opts: { email: string; password: string; callbackURL?: string }): Promise<void> => {
      throw new Error('Login not available')
    },
  },
  signUp: {
    email: async (_opts: { email: string; password: string; name?: string }): Promise<void> => {
      throw new Error('Register not available')
    },
  },
}
