import { cn } from '@/lib/utils';

const avatarColors = [
  'bg-[hsl(var(--avatar-1))]',
  'bg-[hsl(var(--avatar-2))]',
  'bg-[hsl(var(--avatar-3))]',
  'bg-[hsl(var(--avatar-4))]',
  'bg-[hsl(var(--avatar-5))]',
  'bg-[hsl(var(--avatar-6))]',
];

interface ConversationAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  imageUrl?: string | null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % avatarColors.length;
}

export function ConversationAvatar({ name, size = 'md', imageUrl }: ConversationAvatarProps) {
  const sizeClasses = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-base',
  };

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn(
          'shrink-0 rounded-full object-cover',
          sizeClasses[size]
        )}
      />
    );
  }

  const colorClass = avatarColors[getColorIndex(name)];

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium text-primary-foreground',
        'shrink-0',
        sizeClasses[size],
        colorClass
      )}
    >
      {getInitials(name)}
    </div>
  );
}
