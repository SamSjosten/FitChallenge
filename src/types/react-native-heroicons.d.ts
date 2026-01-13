// Type declarations for react-native-heroicons
import * as React from "react";
import { SvgProps } from "react-native-svg";

type IconProps = SvgProps & {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

type IconComponent = React.FC<IconProps>;

// =============================================================================
// EXPO LINEAR GRADIENT
// =============================================================================
declare module "expo-linear-gradient" {
  import { ViewProps } from "react-native";

  export interface LinearGradientProps extends ViewProps {
    colors: string[];
    start?: { x: number; y: number } | [number, number];
    end?: { x: number; y: number } | [number, number];
    locations?: number[];
  }

  export class LinearGradient extends React.Component<LinearGradientProps> {}
}

// =============================================================================
// REACT NATIVE HEROICONS
// =============================================================================

declare module "react-native-heroicons/outline" {
  export const AcademicCapIcon: IconComponent;
  export const AdjustmentsHorizontalIcon: IconComponent;
  export const AdjustmentsVerticalIcon: IconComponent;
  export const ArchiveBoxIcon: IconComponent;
  export const ArrowDownIcon: IconComponent;
  export const ArrowLeftIcon: IconComponent;
  export const ArrowRightIcon: IconComponent;
  export const ArrowUpIcon: IconComponent;
  export const BellIcon: IconComponent;
  export const BookmarkIcon: IconComponent;
  export const CalendarIcon: IconComponent;
  export const ChartBarIcon: IconComponent;
  export const ChatBubbleLeftIcon: IconComponent;
  export const CheckIcon: IconComponent;
  export const CheckCircleIcon: IconComponent;
  export const ChevronDownIcon: IconComponent;
  export const ChevronLeftIcon: IconComponent;
  export const ChevronRightIcon: IconComponent;
  export const ChevronUpIcon: IconComponent;
  export const ClockIcon: IconComponent;
  export const Cog6ToothIcon: IconComponent;
  export const CogIcon: IconComponent;
  export const DocumentIcon: IconComponent;
  export const EllipsisHorizontalIcon: IconComponent;
  export const EllipsisVerticalIcon: IconComponent;
  export const EnvelopeIcon: IconComponent;
  export const ExclamationCircleIcon: IconComponent;
  export const ExclamationTriangleIcon: IconComponent;
  export const EyeIcon: IconComponent;
  export const EyeSlashIcon: IconComponent;
  export const FireIcon: IconComponent;
  export const FlagIcon: IconComponent;
  export const GiftIcon: IconComponent;
  export const GlobeAltIcon: IconComponent;
  export const HeartIcon: IconComponent;
  export const HomeIcon: IconComponent;
  export const InformationCircleIcon: IconComponent;
  export const LinkIcon: IconComponent;
  export const LockClosedIcon: IconComponent;
  export const LockOpenIcon: IconComponent;
  export const MagnifyingGlassIcon: IconComponent;
  export const MapPinIcon: IconComponent;
  export const MinusIcon: IconComponent;
  export const MoonIcon: IconComponent;
  export const PencilIcon: IconComponent;
  export const PhoneIcon: IconComponent;
  export const PhotoIcon: IconComponent;
  export const PlayIcon: IconComponent;
  export const PlusIcon: IconComponent;
  export const PlusCircleIcon: IconComponent;
  export const QuestionMarkCircleIcon: IconComponent;
  export const ShareIcon: IconComponent;
  export const ShieldCheckIcon: IconComponent;
  export const SparklesIcon: IconComponent;
  export const StarIcon: IconComponent;
  export const SunIcon: IconComponent;
  export const TrashIcon: IconComponent;
  export const TrophyIcon: IconComponent;
  export const UserIcon: IconComponent;
  export const UserCircleIcon: IconComponent;
  export const UserGroupIcon: IconComponent;
  export const UserPlusIcon: IconComponent;
  export const UsersIcon: IconComponent;
  export const XCircleIcon: IconComponent;
  export const XMarkIcon: IconComponent;
}

declare module "react-native-heroicons/solid" {
  export const AcademicCapIcon: IconComponent;
  export const AdjustmentsHorizontalIcon: IconComponent;
  export const AdjustmentsVerticalIcon: IconComponent;
  export const ArchiveBoxIcon: IconComponent;
  export const ArrowDownIcon: IconComponent;
  export const ArrowLeftIcon: IconComponent;
  export const ArrowRightIcon: IconComponent;
  export const ArrowUpIcon: IconComponent;
  export const BellIcon: IconComponent;
  export const BookmarkIcon: IconComponent;
  export const CalendarIcon: IconComponent;
  export const ChartBarIcon: IconComponent;
  export const ChatBubbleLeftIcon: IconComponent;
  export const CheckIcon: IconComponent;
  export const CheckCircleIcon: IconComponent;
  export const ChevronDownIcon: IconComponent;
  export const ChevronLeftIcon: IconComponent;
  export const ChevronRightIcon: IconComponent;
  export const ChevronUpIcon: IconComponent;
  export const ClockIcon: IconComponent;
  export const Cog6ToothIcon: IconComponent;
  export const CogIcon: IconComponent;
  export const DocumentIcon: IconComponent;
  export const EllipsisHorizontalIcon: IconComponent;
  export const EllipsisVerticalIcon: IconComponent;
  export const EnvelopeIcon: IconComponent;
  export const ExclamationCircleIcon: IconComponent;
  export const ExclamationTriangleIcon: IconComponent;
  export const EyeIcon: IconComponent;
  export const EyeSlashIcon: IconComponent;
  export const FireIcon: IconComponent;
  export const FlagIcon: IconComponent;
  export const GiftIcon: IconComponent;
  export const GlobeAltIcon: IconComponent;
  export const HeartIcon: IconComponent;
  export const HomeIcon: IconComponent;
  export const InformationCircleIcon: IconComponent;
  export const LinkIcon: IconComponent;
  export const LockClosedIcon: IconComponent;
  export const LockOpenIcon: IconComponent;
  export const MagnifyingGlassIcon: IconComponent;
  export const MapPinIcon: IconComponent;
  export const MinusIcon: IconComponent;
  export const MoonIcon: IconComponent;
  export const PencilIcon: IconComponent;
  export const PhoneIcon: IconComponent;
  export const PhotoIcon: IconComponent;
  export const PlayIcon: IconComponent;
  export const PlusIcon: IconComponent;
  export const PlusCircleIcon: IconComponent;
  export const QuestionMarkCircleIcon: IconComponent;
  export const ShareIcon: IconComponent;
  export const ShieldCheckIcon: IconComponent;
  export const SparklesIcon: IconComponent;
  export const StarIcon: IconComponent;
  export const SunIcon: IconComponent;
  export const TrashIcon: IconComponent;
  export const TrophyIcon: IconComponent;
  export const UserIcon: IconComponent;
  export const UserCircleIcon: IconComponent;
  export const UserGroupIcon: IconComponent;
  export const UserPlusIcon: IconComponent;
  export const UsersIcon: IconComponent;
  export const XCircleIcon: IconComponent;
  export const XMarkIcon: IconComponent;
}

declare module "react-native-heroicons/mini" {
  export const AcademicCapIcon: IconComponent;
  export const CheckIcon: IconComponent;
  export const ChevronDownIcon: IconComponent;
  export const ChevronLeftIcon: IconComponent;
  export const ChevronRightIcon: IconComponent;
  export const ChevronUpIcon: IconComponent;
  export const FireIcon: IconComponent;
  export const HomeIcon: IconComponent;
  export const PlusIcon: IconComponent;
  export const StarIcon: IconComponent;
  export const TrophyIcon: IconComponent;
  export const UserIcon: IconComponent;
  export const XMarkIcon: IconComponent;
}
