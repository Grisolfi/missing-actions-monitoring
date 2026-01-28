import { WebhookEventStatus } from '@prisma/client';
import { prisma } from './prisma.js';

export async function createWebhookEvent(data: {
    externalId: string;
    eventType: string;
    payload: any;
}) {
    return await prisma.webhookEvent.create({
        data: {
            ...data,
            status: WebhookEventStatus.PENDING,
            receivedAt: new Date(),
        },
    });
}

export async function findWebhookEventByExternalId(externalId: string) {
    return await prisma.webhookEvent.findUnique({
        where: { externalId },
    });
}

export async function updateWebhookEventStatus(id: string, status: WebhookEventStatus, error?: string) {
    return await prisma.webhookEvent.update({
        where: { id },
        data: {
            status,
            error,
            processedAt: status === WebhookEventStatus.PROCESSED || status === WebhookEventStatus.FAILED ? new Date() : undefined,
        },
    });
}
