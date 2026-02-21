import jwt, { type SignOptions } from 'jsonwebtoken';
import { UserModel, type UserDocument } from '../models/user.model.js';
import type { Signup, Login, AuthTokens } from '../schemas/auth.schema.js';
import { NotAuthorizedError, AppError, NotFoundError } from '../utils/errors.js';
import { generateToken, hashToken } from '../utils/crypto.js';
import type { EmailAdapter } from '../adapters/index.js';

export class AuthService {
  constructor(
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
    private readonly accessExpiry: string,
    private readonly refreshExpiry: string,
    private readonly emailAdapter?: EmailAdapter | undefined,
    private readonly clientUrl?: string | undefined
  ) {}

  async signup(data: Signup): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    const existingUser = await UserModel.findOne({
      $or: [{ email: data.email }, { username: data.username }],
    });

    if (existingUser) {
      throw new AppError(409, 'CONFLICT', 'User with this email or username already exists');
    }

    const user = await UserModel.create(data);

    // Generate email verification token
    const token = generateToken();
    user.emailVerificationToken = hashToken(token);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    // Send verification email
    if (this.emailAdapter) {
      await this.emailAdapter.send({
        to: user.email,
        subject: 'Verify your email — FENICE',
        html: `<p>Verify your email: <a href="${this.clientUrl ?? ''}/verify-email?token=${token}">Click here</a></p>`,
      });
    }

    return { user, tokens };
  }

  async login(data: Login): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    const user = await UserModel.findOne({ email: data.email });
    if (!user || !user.active) {
      throw new NotAuthorizedError('Invalid credentials');
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      throw new NotAuthorizedError('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before logging in');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (user as any).lastLoginDate = new Date();
    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as { userId: string };
      const user = await UserModel.findById(payload.userId);

      if (!user || user.refreshToken !== refreshToken) {
        throw new NotAuthorizedError('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return tokens;
    } catch {
      throw new NotAuthorizedError('Invalid refresh token');
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const hashedToken = hashToken(token);
    const user = await UserModel.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken');

    if (!user) throw new NotAuthorizedError('Invalid or expired verification token');

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.emailVerified) throw new AppError(400, 'ALREADY_VERIFIED', 'Email already verified');

    const token = generateToken();
    user.emailVerificationToken = hashToken(token);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await user.save();

    if (this.emailAdapter) {
      await this.emailAdapter.send({
        to: user.email,
        subject: 'Verify your email — FENICE',
        html: `<p>Verify your email: <a href="${this.clientUrl ?? ''}/verify-email?token=${token}">Click here</a></p>`,
      });
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await UserModel.findOne({ email });
    // Always return success (don't leak email existence)
    if (!user) return;

    const token = generateToken();
    user.resetPasswordToken = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save();

    if (this.emailAdapter) {
      await this.emailAdapter.send({
        to: user.email,
        subject: 'Reset your password — FENICE',
        html: `<p>Reset password: <a href="${this.clientUrl ?? ''}/reset-password?token=${token}">Click here</a></p>`,
      });
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = hashToken(token);
    const user = await UserModel.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) throw new NotAuthorizedError('Invalid or expired reset token');

    user.password = newPassword; // pre-save hook will hash
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshToken = undefined; // Force re-login on all devices
    await user.save();
  }

  private generateTokens(user: UserDocument): AuthTokens {
    const userId = user._id.toString();

    const accessToken = jwt.sign({ userId, email: user.email, role: user.role }, this.jwtSecret, {
      expiresIn: this.accessExpiry,
    } as SignOptions);

    const refreshToken = jwt.sign({ userId }, this.jwtRefreshSecret, {
      expiresIn: this.refreshExpiry,
    } as SignOptions);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }
}
