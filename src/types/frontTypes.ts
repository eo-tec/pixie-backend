import { FriendStatus } from "@prisma/client";

// Tipado en el frontend
export type Friend = {
    user: User;
    status: FriendStatus;
};

export type User = {
    id: number;
    username: string;
    picture: string;
};

export type Pagination = {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
};

export type PaginatedFriendsResponse = {
    data: Friend[];
    pagination: Pagination;
};