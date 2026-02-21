import jwt, { type SignOptions } from 'jsonwebtoken';
import { UserModel, type UserDocument } from '../models/user.model.js';
import type { Signup, Login, AuthTokens } from '../schemas/auth.schema.js';
import { NotAuthorizedError, AppError } from '../utils/errors.js';

export class AuthService {
  constructor(
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
    private readonly accessExpiry: string,
    private readonly refreshExpiry: string
  ) {}

  async signup(data: Signup): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    const existingUser = await UserModel.findOne({
      $or: [{ email: data.email }, { username: data.username }],
    });

    if (existingUser) {
      throw new AppError(409, 'CONFLICT', 'User with this email or username already exists');
    }

    const user = await UserModel.create(data);
    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

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
