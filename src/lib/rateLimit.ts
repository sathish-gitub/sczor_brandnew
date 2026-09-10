import { prisma } from "./prisma";

interface RateLimitConfig {
  maxAttempts: number;
  windowMinutes: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  LOGIN: { maxAttempts: 5, windowMinutes: 15 },
  OTP_VERIFY: { maxAttempts: 5, windowMinutes: 10 },
  OTP_RESEND: { maxAttempts: 3, windowMinutes: 10 },
  PASSWORD_RESET: { maxAttempts: 3, windowMinutes: 15 },
};

export async function checkRateLimit(
  identifier: string,
  action: keyof typeof LIMITS,
): Promise<{ allowed: boolean; retryAfterMinutes?: number }> {
  // Small random chance to prune old rows instead of running cleanup on every call.
  if (Math.random() < 0.05) {
    cleanupOldAttempts().catch(() => {});
  }

  const config = LIMITS[action];
  const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000);

  const attemptCount = await prisma.rateLimitAttempt.count({
    where: {
      identifier,
      action,
      createdAt: { gte: windowStart },
    },
  });

  if (attemptCount >= config.maxAttempts) {
    return { allowed: false, retryAfterMinutes: config.windowMinutes };
  }

  return { allowed: true };
}

export async function recordAttempt(identifier: string, action: keyof typeof LIMITS): Promise<void> {
  await prisma.rateLimitAttempt.create({
    data: { identifier, action },
  });
}

export async function cleanupOldAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.rateLimitAttempt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}
