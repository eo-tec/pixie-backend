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