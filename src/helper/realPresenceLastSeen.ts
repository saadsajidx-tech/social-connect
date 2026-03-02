import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
const ONLINE_THRESHOLD_MS = 90_000;
type Timestamp = FirebaseFirestoreTypes.Timestamp | null | undefined;

export function isUserTrulyOnline(lastSeen: Timestamp): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.toDate().getTime() < ONLINE_THRESHOLD_MS;
}

export function formatLastSeen(lastSeen: Timestamp): string {
  if (!lastSeen) return 'Last seen unknown';

  const diff = Date.now() - lastSeen.toDate().getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (diff < ONLINE_THRESHOLD_MS) return 'Online';
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  if (hours < 24) return `Last seen ${hours}h ago`;
  if (days < 7) return `Last seen ${days}d ago`;
  return `Last seen ${lastSeen.toDate().toLocaleDateString()}`;
}
