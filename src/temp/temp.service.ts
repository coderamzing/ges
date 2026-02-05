import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageDirection } from '@prisma/client';
import { TP_STATUS_MAP } from 'src/talent/talent.config';
import { OpenAIService } from '../openai/openai.service';
import { renderTemplate } from '../../utils/handlebar';

@Injectable()
export class TempService {
    constructor(
        private prisma: PrismaService,
        private openAIService: OpenAIService,
    ) { }

    private parseNullString(value: string | null | undefined): string | null {
        if (!value || value === 'null' || value === 'NULL' || value.trim() === '') {
            return null;
        }
        return value;
    }

    /**
     * Temp helper: interpret location fields from a full message thread.
     * Returns ONLY the fields required for prompt testing (no DB writes).
     */
    async interpretLocationFromMessages(messages: string): Promise<{
        currentCity: string | null;
        futureCity: string | null;
        futureCityStartAt: string | null;
        futureCityEndAt: string | null;
        currentCityEndAt: string | null;
        cityHome: string | null;
    }> {
        const text = (messages ?? '').trim();
        if (!text) {
            throw new BadRequestException('messages is required');
        }

        const promptRow = await this.prisma.aiPrompt.findFirst({
            where: { key: 'LOCATION_INTERPRETATION' },
        });
        if (!promptRow) {
            throw new BadRequestException('LOCATION_INTERPRETATION prompt not found');
        }

        const prompt = renderTemplate(promptRow.defs, { messages: text });
        const sysPrompt = promptRow.role ?? '';
        const response = await this.openAIService.query(prompt, sysPrompt);

        return {
            currentCity: this.parseNullString(response?.currentCity),
            futureCity: this.parseNullString(response?.futureCity),
            futureCityStartAt: response?.futureCityStartAt ?? null,
            futureCityEndAt: response?.futureCityEndAt ?? null,
            currentCityEndAt: response?.currentCityEndAt ?? null,
            cityHome: this.parseNullString(response?.cityHome),
        };
    }

    /**
     * Temp helper: find the latest thread for (promoter, talentId) and return its messages + a prebuilt fullMessage.
     */
    async getTalentThreadByTalentId(
        talentId: string,
        promoterId: number,
        limit: number = 200,
        promoterUsernameOverride?: string,
    ): Promise<{
        thread: any;
        messages: any[];
        fullMessage: string;
    }> {
        const tid = (talentId ?? '').trim();
        if (!tid) {
            throw new BadRequestException('talentId is required');
        }

        const promoter = await (this.prisma as any).user.findUnique({
            where: { id: BigInt(promoterId) },
            select: { id: true, username: true },
        });
        const tokenPromoterUsername: string | null = promoter?.username ?? null;
        const requestedUsername = (promoterUsernameOverride ?? '').trim();
        // TEMP TOOLING: allow explicit promoter username override for prompt testing
        const promoterUsername: string | null = requestedUsername || tokenPromoterUsername;

        const take = Math.max(1, Math.min(Number(limit) || 200, 1000));

        if (!promoterUsername) {
            throw new BadRequestException('Unable to resolve promoter username from token');
        }

        console.log('promoterUsername', promoterUsername, tid);
        // STEP 1 (as requested): find threadId from thread table using username1 + username2
        const threadSafe: any = await this.prisma.thread.findFirst({
            where: {
                username1: promoterUsername,
                username2: tid,
            },
            orderBy: { created_at: 'desc' },
        });

        if (!threadSafe) {
            throw new NotFoundException(
                `Thread not found for talent ${tid} and promoter ${promoterUsername}`,
            );
        }

        // STEP 2: load all messages for that thread_id ordered by created_at asc
        const rawMessages: any[] = await this.prisma.message.findMany({
            where: { thread_id: threadSafe.id },
            orderBy: { tm: 'asc' },
            take,
        });

        if (!rawMessages.length) {
            throw new NotFoundException(`No messages found for thread ${threadSafe.id}`);
        }

        const mapped = rawMessages.map((m) => {
            const isFromPromoter =
                (m.sender !== null &&
                    m.sender !== undefined &&
                    m.sender.toString() === BigInt(promoterId).toString()) ||
                (!!promoterUsername && !!m.sender_username && m.sender_username === promoterUsername) ||
                (!!threadSafe.username1 && !!m.sender_username && m.sender_username === threadSafe.username1);

            const isFromTalent =
                (!!threadSafe.username2 && !!m.sender_username && m.sender_username === threadSafe.username2) ||
                (!!m.sender_username && m.sender_username === tid) ||
                (!!threadSafe.username2 && !!m.receiver_username && m.receiver_username === threadSafe.username2);

            const direction = isFromPromoter ? 'sent' : isFromTalent ? 'received' : 'unknown';
            const ts = m.tm || m.created_at || null;

            return {
                id: m.id,
                thread_id: m.thread_id,
                message: m.message ?? '',
                sender: m.sender,
                sender_username: m.sender_username,
                receiver: m.receiver,
                receiver_username: m.receiver_username,
                created_at: m.created_at,
                tm: m.tm,
                direction,
                timestamp: ts,
            };
        });

        const fullMessage =
            `Today's Date: ${new Date().toDateString()}\n\n` +
            `Conversation:\n\n` +
            rawMessages
                .map((m) => {
                    let label = 'Unknown';
                    if (!!threadSafe.username2 && m.sender_username === threadSafe.username2) {
                        label = 'Talent';
                    } else if (!!promoterUsername && m.sender_username === promoterUsername) {
                        label = 'Promoter';
                    } else if (!!threadSafe.username1 && m.sender_username === threadSafe.username1) {
                        label = 'Promoter';
                    } else if (m.sender && m.sender.toString() === BigInt(promoterId).toString()) {
                        label = 'Promoter';
                    } else if (m.sender_username === tid) {
                        label = 'Talent';
                    }

                    const ts = (m.created_at || m.tm);
                    const iso = ts ? new Date(ts as any).toISOString() : '';
                    return `[${iso}] ${label}: ${m.message ?? ''}`;
                })
                .join('\n\n');

        return {
            thread: {
                id: threadSafe.id,
                created_at: threadSafe.created_at,
                user_id: threadSafe.user_id,
                username1: threadSafe.username1,
                username2: threadSafe.username2,
                name2: threadSafe.name2,
                picture2: threadSafe.picture2,
            },
            messages: mapped,
            fullMessage,
        };
    }

    /**
     * Temp helper: load a thread by threadId and return its messages + a prebuilt fullMessage.
     */
    async getThreadById(
        threadId: string,
        limit: number = 200,
    ): Promise<{
        thread: any;
        messages: any[];
        fullMessage: string;
    }> {
        const id = (threadId ?? '').trim();
        if (!id) {
            throw new BadRequestException('threadId is required');
        }

        const thread = await this.prisma.thread.findUnique({
            where: { id },
        });

        if (!thread) {
            throw new NotFoundException(`Thread not found: ${id}`);
        }

        const take = Math.max(1, Math.min(Number(limit) || 200, 1000));
        const rawMessages: any[] = await this.prisma.message.findMany({
            where: { thread_id: thread.id },
            orderBy: { created_at: 'asc' },
            take,
        });

        if (!rawMessages.length) {
            throw new NotFoundException(`No messages found for thread ${id}`);
        }

        const messages = rawMessages.map((m) => {
            const direction =
                (thread.username1 && m.sender_username === thread.username1)
                    ? 'sent'
                    : (thread.username2 && m.sender_username === thread.username2)
                        ? 'received'
                        : 'unknown';

            const ts = m.created_at || m.tm || null;
            return {
                id: m.id,
                thread_id: m.thread_id,
                message: m.message ?? '',
                sender: m.sender,
                sender_username: m.sender_username,
                receiver: m.receiver,
                receiver_username: m.receiver_username,
                created_at: m.created_at,
                tm: m.tm,
                direction,
                timestamp: ts,
            };
        });

        const fullMessage =
            `Today's Date: ${new Date().toDateString()}\n\n` +
            `Conversation:\n\n` +
            rawMessages
                .map((m) => {
                    let label = 'Unknown';
                    if (thread.username2 && m.sender_username === thread.username2) label = 'Talent';
                    else if (thread.username1 && m.sender_username === thread.username1) label = 'Promoter';

                    const ts = m.created_at || m.tm;
                    const iso = ts ? new Date(ts as any).toISOString() : '';
                    return `[${iso}] ${label}: ${m.message ?? ''}`;
                })
                .join('\n\n');

        return {
            thread: {
                id: thread.id,
                created_at: thread.created_at,
                user_id: thread.user_id,
                username1: thread.username1,
                username2: thread.username2,
                name2: thread.name2,
                picture2: thread.picture2,
            },
            messages,
            fullMessage,
        };
    }

    async getCampaignMessages(campaignId: number) {
        // 1) Load all invitations for this campaign that have a linked DM thread
        const invitations = await this.prisma.campaignInvitation.findMany({
            where: {
                campaignId,
                thread_id: {
                    not: null,
                },
            },
            select: {
                id: true,
                campaignId: true,
                eventId: true,
                promoterId: true,
                talentId: true,
                batch: true,
                status: true,
                invitationAt: true,
                isSeen: true,
                followupSent: true,
                thankYouSent: true,
                hasReplied: true,
                thread_id: true,
                createdAt: true,
            },
        });

        if (!invitations.length) {
            return [];
        }

        // 2) Load legacy DM messages from the `message` table by thread_id
        const threadIds = Array.from(
            new Set(
                invitations
                    .map((inv) => inv.thread_id)
                    .filter((id): id is string => !!id),
            ),
        );

        const legacyMessages = await this.prisma.message.findMany({
            where: {
                thread_id: {
                    in: threadIds,
                },
            },
            orderBy: {
                tm: 'asc',
            },
        });

        // Group messages by thread_id for fast lookup
        const messagesByThread = new Map<string, typeof legacyMessages>();
        for (const msg of legacyMessages) {
            if (!msg.thread_id) continue;
            if (!messagesByThread.has(msg.thread_id)) {
                messagesByThread.set(msg.thread_id, []);
            }
            messagesByThread.get(msg.thread_id)!.push(msg);
        }

        // 3) Load talents
        const talentIds = Array.from(
            new Set(invitations.map((inv) => inv.talentId)),
        );

        const talents = await this.prisma.talentPool.findMany({
            where: { id: { in: talentIds } },
            select: {
                id: true,
                name: true,
                profilePicture: true,
                cityHome: true,
                currentCity: true,
                currentCityEndAt: true,
                futureCity: true,
                futureCityStartAt: true,
                futureCityEndAt: true,
            },
        });

        const talentMap = new Map(talents.map((t) => [t.id, t]));

        // 4) Build response grouped by talent
        const result: any[] = [];

        for (const invitation of invitations) {
            const talent = talentMap.get(invitation.talentId) || {
                id: invitation.talentId,
                name: 'Unknown',
                profilePicture: null,
            };

            const threadMessages = invitation.thread_id
                ? messagesByThread.get(invitation.thread_id) || []
                : [];

            let mappedMessages = threadMessages.map((m) => {
                const isFromPromoter =
                    m.sender !== null &&
                    m.sender !== undefined &&
                    invitation.promoterId !== null &&
                    invitation.promoterId !== undefined &&
                    m.sender.toString() === invitation.promoterId.toString();

                const direction = isFromPromoter
                    ? MessageDirection.sent
                    : MessageDirection.received;

                const timestamp = m.tm || m.created_at || null;

                return {
                    id: m.id,
                    campaignId: invitation.campaignId,
                    promoterId: Number(invitation.promoterId),
                    invitationId: invitation.id,
                    talentId: invitation.talentId,
                    direction,
                    message: m.message ?? '',
                    sentAt: isFromPromoter ? timestamp : null,
                    receivedAt: !isFromPromoter ? timestamp : null,
                    createdAt: m.created_at,

                };
            });

            mappedMessages = mappedMessages.filter((m) => m.createdAt && invitation.createdAt && m.createdAt > invitation.createdAt);

            result.push({
                talent: {
                    ...talent,
                    // For UI convenience – use id as accountId when nothing else is available
                    accountId: (talent as any).accountId ?? talent.id,
                },
                invitation: {
                    id: invitation.id,
                    status: invitation.status,
                    batch: invitation.batch,
                    invitationAt: invitation.invitationAt,
                    isSeen: invitation.isSeen,
                    followupSent: invitation.followupSent,
                    thankYouSent: invitation.thankYouSent,
                    hasReplied: invitation.hasReplied,
                    threadId: invitation.thread_id,
                    createdAt: invitation.createdAt,
                },
                messages: mappedMessages,
            });
        }

        return result;
    }

    // async sendTalentMessage(
    //   campaignId: number,
    //   talentId: string,
    //   message: string,
    //   promoterId: number,
    // ) {
    //   const invitation = await this.prisma.campaignInvitation.findFirst({
    //     where: { campaignId, talentId },
    //   });

    //   if (!invitation) {
    //     throw new NotFoundException('Invitation not found');
    //   }

    //   return this.prisma.campaignMessage.create({
    //     data: {
    //       campaignId,
    //       promoterId: BigInt(promoterId),
    //       invitationId: invitation.id,
    //       talentId,
    //       direction: MessageDirection.received,
    //       message,
    //       receivedAt: new Date(),
    //     },
    //   });
    // }

    async sendTalentMessage(
        campaignId: number,
        talentId: string,
        message: string,
        promoterId: number,
    ) {
        const invitation = await this.prisma.campaignInvitation.findFirst({
            where: { campaignId, talentId },
        });

        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }


        if (!invitation.thread_id) {
            throw new NotFoundException('Thread not associated with invitation');
        }

        const thread = await this.prisma.thread.findFirst({
            where: {
                id: invitation.thread_id
            },
        });


        if (!thread) {
            throw new NotFoundException('Message thread not found');
        }
        const now = new Date();

        const promoter = await this.prisma.user.findUnique({
            where: {
                id: BigInt(promoterId),
            },
        });
        if (!promoter) {
            throw new NotFoundException('Promoter not found');
        }

        return this.prisma.message.create({
            data: {
                id: `${crypto.randomUUID()}`,
                created_at: now,
                dt: now,
                tm: now,
                message: message,
                sender: null,
                sender_username: talentId,
                receiver: BigInt(promoter.id),
                receiver_username: promoter.username,
                thread_id: thread.id,
                user_id: BigInt(promoter.id),
                invite: false,
                tmp: true,
                pending_reply: false,
            },
        });
    }


    async getTalentPromoterState(talentId: string, promoterId: number) {
        const state = await this.prisma.talentPromoterState.findUnique({
            where: {
                talentId_promoterId: {
                    talentId,
                    promoterId: BigInt(promoterId),
                },
            },
        });
        return state || {
            id: null,
            talentId,
            promoterId,
            trustScore: 0,
            lastContacted: null,
            lastReply: null,
            optedOut: false,
        };
    }

    async getTrustScoreLogs(talentId: string, promoterId: number) {
        return this.prisma.trustScoreLog.findMany({
            where: {
                talentId,
                promoterId: BigInt(promoterId),
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }


    async getBlacklistedTalents(promoterId: bigint) {
        const blacklist = await this.prisma.userTpStatus.findMany({
            where: {
                userId: promoterId,
                statusId: TP_STATUS_MAP.BLACKLIST,
            },
            include: {
                talentPool: true,
            },
            orderBy: {
                id: "desc",
            },
        });

        return blacklist;
    }

}
