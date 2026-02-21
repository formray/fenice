import mongoose, { Schema, type Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { User } from '../schemas/user.schema.js';
import { RoleEnum } from '../schemas/user.schema.js';

export interface UserDocument extends Omit<User, 'id'>, Document {
  password: string;
  refreshToken?: string | undefined;
  resetPasswordToken?: string | undefined;
  resetPasswordExpires?: Date | undefined;
  emailVerified: boolean;
  emailVerificationToken?: string | undefined;
  emailVerificationExpires?: Date | undefined;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      enum: RoleEnum.options,
      default: 'user',
    },
    active: {
      type: Boolean,
      default: true,
    },
    pictureUrl: String,
    lastLoginDate: Date,
    refreshToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>): Record<string, unknown> => {
        ret['id'] = String(ret['_id']);
        delete ret['_id'];
        delete ret['__v'];
        delete ret['password'];
        delete ret['refreshToken'];
        delete ret['resetPasswordToken'];
        delete ret['resetPasswordExpires'];
        delete ret['emailVerificationToken'];
        delete ret['emailVerificationExpires'];
        return ret;
      },
    },
  }
);

userSchema.index({ email: 1, username: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const hashed = await bcrypt.hash(this.password, 12);
  this.password = hashed;
});

userSchema.methods['comparePassword'] = async function (
  candidatePassword: string
): Promise<boolean> {
  const result = await bcrypt.compare(candidatePassword, this.password as string);
  return result;
};

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
