import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function updateUserTpStatus({
    userId,
    talentPoolId,
    statusId,
}: {
    userId: bigint;
    talentPoolId: string;
    statusId: number;
}) {
    const status = await prisma.tpStatus.findUnique({
        where: { id: statusId },
    });

    if (!status) {
        throw new Error(`Status not found in tp_status. statusId=${statusId}`);
    }

    const exists = await prisma.userTpStatus.findFirst({
        where: {
            userId,
            talentPoolId,
            statusId,
        },
    });

    if (!exists) {
        await prisma.userTpStatus.create({
            data: {
                userId,
                talentPoolId,
                statusId,
                statusName: status.name,
                createdAt: new Date(),
            },
        });
    }

    return true;
}
