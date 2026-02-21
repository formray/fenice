import { UserModel, type UserDocument } from '../models/user.model.js';
import type { UserUpdate } from '../schemas/user.schema.js';
import { NotFoundError } from '../utils/errors.js';

export class UserService {
  async findById(id: string): Promise<UserDocument> {
    const user = await UserModel.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async update(id: string, data: UserUpdate): Promise<UserDocument> {
    const user = await UserModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async delete(id: string): Promise<void> {
    const user = await UserModel.findByIdAndDelete(id);
    if (!user) throw new NotFoundError('User not found');
  }
}
