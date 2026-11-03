
import { Prisma } from "@prisma/client";

type DispatchNotificationEventParams = {
  companyId: number;
  eventCode: string;
  eventKey: string;
  payload: Prisma.InputJsonValue;
};

export async function dispatchNotificationEvent(
  tx: Prisma.TransactionClient,
  params: DispatchNotificationEventParams,
) {
  const {
    companyId,
    eventCode,
    eventKey,
    payload,
  } = params;

  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw new Error("Invalid companyId");
  }

  if (!eventCode.trim() || !eventKey.trim()) {
    throw new Error("eventCode and eventKey are required");
  }

  const event = await tx.notificationEvent.findUnique({
    where: { code: eventCode },
  });

  if (!event || !event.isActive) {
    throw new Error(
      `Notification event "${eventCode}" does not exist or is inactive`,
    );
  }

  const configs = await tx.notificationConfig.findMany({
    where: {
      companyId,
      trigger: "EVENT",
      eventId: event.id,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (configs.length === 0) {
    return {
      eventCode,
      totalConfigs: 0,
      createdJobs: 0,
    };
  }

  const result = await tx.notificationJob.createMany({
    data: configs.map((config) => ({
      configId: config.id,
      eventKey,
      payload,
      status: "PENDING",
      availableAt: new Date(),
    })),
    skipDuplicates: true,
  });

  return {
    eventCode,
    totalConfigs: configs.length,
    createdJobs: result.count,
  };
}
