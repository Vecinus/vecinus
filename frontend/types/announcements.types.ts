export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED';

export interface ImageFile {
    uri: string;
    name?: string;
    type?: string;
    mimeType?: string;
    size?: number | null;
    file?: unknown;
}

export interface Announcement {
    id: string;
    association_id: string;
    title: string;
    content: string;
    status: AnnouncementStatus;
    image_url: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    scheduled_date: string | null;
}

export interface AnnouncementCreate {
    title: string;
    content: string;
    status?: AnnouncementStatus;
    scheduled_date?: string;
    image?: ImageFile;
}

export interface AnnouncementUpdate {
    title?: string;
    content?: string;
    status?: AnnouncementStatus;
    scheduled_date?: string;
    image?: ImageFile;
}
