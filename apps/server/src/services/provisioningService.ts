import { prisma } from "../db.js";
import { decodeProvisioningId } from "../security/provisioningId.js";

export async function resolveProvisioningApplication(provisioningId: string) {
  const payload = decodeProvisioningId(provisioningId);
  const application = await prisma.product.findFirst({
    where: {
      publicId: payload.applicationId,
      tenant: { publicId: payload.tenantId },
    },
    select: { id: true },
  });
  if (!application)
    throw new Error(
      "No registered application matches this client provisioning ID",
    );

  await prisma.$transaction(
    payload.modules.map((module) =>
      prisma.module.upsert({
        where: {
          productId_code: { productId: application.id, code: module.code },
        },
        create: {
          productId: application.id,
          code: module.code,
          name: module.name,
          description: module.description,
        },
        update: { name: module.name, description: module.description },
      }),
    ),
  );

  const advertisedCodes = payload.modules.map((module) => module.code);
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: application.id },
    include: {
      tenant: true,
      modules: {
        where: { enabled: true, code: { in: advertisedCodes } },
        orderBy: { code: "asc" },
      },
      _count: { select: { licenses: true } },
    },
  });
  return { payload, product };
}
