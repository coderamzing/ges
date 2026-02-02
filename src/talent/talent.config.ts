export const TP_STATUS_MAP = {
  ALL: 1,
  OPEN_CHAT: 2,
  DM_SENT: 3,
  FIRST_CHOICE: 9,
  BACKUP_GUEST: 10,
  BLACKLIST: 11,
  LIKED: 12,
} as const;

export const TP_STATUS_LABELS: Record<
  keyof typeof TP_STATUS_MAP,
  string
> = {
  ALL: "All",
  OPEN_CHAT: "Open Chat",
  DM_SENT: "DM Sent",
  FIRST_CHOICE: "First Choice",
  BACKUP_GUEST: "Back Up Guest",
  BLACKLIST: "Blacklist",
  LIKED: "Liked",
};