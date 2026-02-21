import { UserModel, type UserDocument } from '../models/user.model.js';
import type { UserUpdate } from '../schemas/user.schema.js';
import type { PaginatedResponse } from '../schemas/common.schema.js';
import { decodeCursor, encodeCursor } from '../utils/pagination.js';
import { NotFoundError } from '../utils/errors.js';

export class UserService {
  async findAll(
    filter: Record<string, unknown>,
    options: {
      cursor?: string | undefined;
      limit?: number | undefined;
      sort?: string | undefined;
      order?: 'asc' | 'desc' | undefined;
    }
  ): Promise<PaginatedResponse<UserDocument>> {
    const { cursor, limit = 20, sort = 'createdAt', order = 'desc' } = options;
    const cursorData = decodeCursor(cursor);

    const query: Record<string, unknown> = { ...filter };

    if (cursorData) {
      const direction = order === 'desc' ? '$lt' : '$gt';
      query['$or'] = [
        { [sort]: { [direction]: cursorData.sortValue } },
        { [sort]: cursorData.sortValue, _id: { [direction]: cursorData.id } },
      ];
    }

    const sortObj: Record<string, 1 | -1> = {
      [sort]: order === 'desc' ? -1 : 1,
      _id: order === 'desc' ? -1 : 1,
    };

    const users = await UserModel.find(query)
      .sort(sortObj)
      .limit(limit + 1);

    const hasNext = users.length > limit;
    if (hasNext) users.pop();

    const lastUser = users[users.length - 1];
    const nextCursor =
      hasNext && lastUser
        ? encodeCursor({
            id: lastUser._id.toString(),
            sortValue: String(lastUser.get(sort)),
          })
        : null;

    return {
      data: users,
      pagination: { hasNext, nextCursor },
    };
  }

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
