export interface User {
  id: number;
  login: string;
  password_hash: string;
  phone: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: 'user' | 'operator' | 'admin';
  department: string | null;
  position_title: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserPublic {
  id: number;
  login: string;
  phone: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: string;
  department: string | null;
  position_title: string | null;
}

export interface Chat {
  id: number;
  name: string | null;
  type: 'direct' | 'group' | 'department';
  description: string | null;
  avatar_url: string | null;
  created_by: number;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: number;
  chat_id: number;
  sender_id: number;
  content: string | null;
  content_type: 'text' | 'image' | 'file' | 'voice' | 'system';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  reply_to: number | null;
  is_edited: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Conference {
  id: number;
  title: string;
  invite_link: string;
  created_by: number;
  is_recording: boolean;
  max_participants: number;
  status: 'scheduled' | 'active' | 'finished' | 'cancelled';
  scheduled_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
}

// WebSocket relay message types
export interface RelayMessage {
  type: string;
  [key: string]: unknown;
}

export interface JwtPayload {
  userId: number;
  role: string;
}
