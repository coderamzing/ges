export interface SendMessageResponse {
    message: string;
    msg: {
        id: string;
        userId: number;
        senderUsername: string;
        receiverUsername: string;
        receiver: number;
        threadId: string;
        message: string;
        dt: string;
        tm: string;
        createdAt: string;
        clientContext: string;
    };
}
