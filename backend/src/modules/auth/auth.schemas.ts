import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// O próprio usuário edita só nome e celular (null remove); disciplinas e status são definidos pela gestão.
export const updateMeSchema = z
  .object({
    name: z.string().min(1).optional(),
    celular: z.string().min(1).nullable().optional()
  })
  .strict();

export const setupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  celular: z.string().min(1).optional(),
  password: z.string().min(8)
});

export const confirmEmailSchema = z.object({
  token: z.string().min(1)
});

export const changePasswordSchema = z
  .object({
    email: z.string().email(),
    senhaAtual: z.string().min(1),
    novaSenha: z.string().min(8)
  })
  .refine((input) => input.novaSenha !== input.senhaAtual, {
    message: "A nova senha deve ser diferente da atual",
    path: ["novaSenha"]
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  novaSenha: z.string().min(8)
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type SetupInput = z.infer<typeof setupSchema>;
export type ConfirmEmailInput = z.infer<typeof confirmEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
