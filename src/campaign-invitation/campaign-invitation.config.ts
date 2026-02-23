export const InvitationStatus = {
  PENDING: "pending",
  SENT: "sent",
  CONFIRMED: "confirmed",
  DECLINED: "declined",
  MAYBE: "maybe",
  IGNORED: "ignored",
  ATTENDED: "attended",
  INTERESTED: "interested",
  OPTOUT: "optout",
  MOVED: "moved",
  BLACKLIST: "blacklist",
  SOFT_DECLINE: "soft-decline",
  MANUALLY_CONFIRM: "manually-confirmed",
  MANUALLY_PENDING: "manually-pending",
  MANUALLY_DECLINED: "manually-declined",
} as const;

export type InvitationStatusType =
  typeof InvitationStatus[keyof typeof InvitationStatus];